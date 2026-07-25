import Foundation
import SQLite3

public enum LocalStoreError: Error, Equatable {
  case invalidVehicle
  case disclosureRequired
  case trackingConflict
  case sqlite(String)
  case unsupportedSchema(Int)
}

public struct StoredVehicle: Sendable, Equatable {
  public let id: Int64
  public let nickname: String
  public let year: Int
  public let make: String
  public let model: String
}

public struct ManualOdometerReading: Sendable, Equatable {
  public let milliMiles: Int64
  public let effectiveAt: Int64
}

public struct StoreBootstrap: Sendable, Equatable {
  public let disclosureAccepted: Bool
  public let schemaVersion: Int
}

/// The only owner of SQLite connections and durable product writes.
public final class LocalStore: @unchecked Sendable {
  public static let currentSchemaVersion = 1

  private var database: OpaquePointer?
  private static let writeLock = NSLock()

  public init(path: String) throws {
    var connection: OpaquePointer?
    guard sqlite3_open_v2(path, &connection, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK,
          let connection else {
      throw LocalStoreError.sqlite("Unable to open the local store")
    }
    database = connection
    try configure(connection)
    try migrate(connection)
    try clearTemporaryPreciseState()
  }

  deinit {
    if let database {
      sqlite3_close(database)
    }
  }

  public func createVehicle(
    nickname: String,
    year: Int,
    make: String,
    model: String,
    initialOdometerMilliMiles: Int64,
    now: Int64
  ) throws -> StoredVehicle {
    let normalizedNickname = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedMake = make.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedNickname.isEmpty,
          !normalizedMake.isEmpty,
          !normalizedModel.isEmpty,
          year >= 1886,
          initialOdometerMilliMiles >= 0 else {
      throw LocalStoreError.invalidVehicle
    }

    try transaction {
      let vehicleId = try insert(
        """
        INSERT INTO vehicle (nickname, year, make, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [.text(normalizedNickname), .integer(Int64(year)), .text(normalizedMake), .text(normalizedModel), .integer(now), .integer(now)]
      )
      _ = try insert(
        """
        INSERT INTO manual_odometer_reading (vehicle_id, effective_at, milli_miles, origin, created_at)
        VALUES (?, ?, ?, 'initial', ?)
        """,
        [.integer(vehicleId), .integer(now), .integer(initialOdometerMilliMiles), .integer(now)]
      )
    }

    let id = sqlite3_last_insert_rowid(database)
    // The odometer insert is last; fetch the vehicle ID from the reading rather than exposing SQL to callers.
    let vehicleId = try scalarInt64(
      "SELECT vehicle_id FROM manual_odometer_reading WHERE id = ?",
      [.integer(id)]
    )
    return StoredVehicle(id: vehicleId, nickname: normalizedNickname, year: year, make: normalizedMake, model: normalizedModel)
  }

  public func latestManualOdometer(for vehicleId: Int64) throws -> ManualOdometerReading? {
    guard let row = try queryOne(
      """
      SELECT milli_miles, effective_at FROM manual_odometer_reading
      WHERE vehicle_id = ? ORDER BY effective_at DESC, id DESC LIMIT 1
      """,
      [.integer(vehicleId)]
    ) else {
      return nil
    }
    return ManualOdometerReading(milliMiles: row[0], effectiveAt: row[1])
  }

  public func schemaVersion() throws -> Int {
    Int(try scalarInt64("PRAGMA user_version", []))
  }

  public func bootstrap() throws -> StoreBootstrap {
    guard let row = try queryOne("SELECT disclosure_version FROM installation_state WHERE id = 1", []) else {
      throw LocalStoreError.sqlite("Missing installation state")
    }
    return StoreBootstrap(disclosureAccepted: row[0] > 0, schemaVersion: try schemaVersion())
  }

  public func acceptDisclosure(version: Int, now: Int64) throws -> StoreBootstrap {
    guard version > 0 else { throw LocalStoreError.sqlite("Disclosure version must be positive") }
    try transaction {
      try run(
        "UPDATE installation_state SET disclosure_version = ?, disclosure_accepted_at = ? WHERE id = 1",
        [.integer(Int64(version)), .integer(now)]
      )
    }
    return try bootstrap()
  }

  public func trackingState() throws -> String {
    guard let row = try queryOne(
      "SELECT CASE WHEN lifecycle_state = 'tracking' THEN 1 ELSE 0 END FROM tracking_session WHERE id = 1",
      []
    ) else {
      return "idle"
    }
    return row[0] == 1 ? "tracking" : "idle"
  }

  public func startTracking(vehicleId: Int64, source: String, now: Int64) throws {
    guard source == "manual" || source == "automatic" else {
      throw LocalStoreError.sqlite("Unsupported tracking source")
    }
    try transaction {
      guard (try queryOne("SELECT disclosure_version FROM installation_state WHERE id = 1", [])?[0] ?? 0) > 0 else {
        throw LocalStoreError.disclosureRequired
      }
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(vehicleId)]) != nil else {
        throw LocalStoreError.sqlite("Vehicle is unavailable")
      }
      if let activeVehicleId = try queryOne("SELECT intended_vehicle_id FROM tracking_session WHERE id = 1", [])?[0] {
        guard activeVehicleId == vehicleId else { throw LocalStoreError.trackingConflict }
        return
      }
      try run(
        """
        INSERT INTO tracking_session (id, intended_vehicle_id, source, lifecycle_state, started_at, updated_at,
          corroboration_observed, movement_observed, cumulative_milli_miles, quality_counters_json)
        VALUES (1, ?, ?, 'tracking', ?, ?, 0, 0, 0, '{}')
        """,
        [.integer(vehicleId), .text(source), .integer(now), .integer(now)]
      )
    }
  }

  public func stopTracking() throws {
    try transaction {
      try run("DELETE FROM tracking_session WHERE id = 1", [])
    }
  }

  private func configure(_ connection: OpaquePointer) throws {
    try execute("PRAGMA foreign_keys = ON")
    try execute("PRAGMA journal_mode = WAL")
    try execute("PRAGMA busy_timeout = 5000")
    try execute("PRAGMA synchronous = FULL")
  }

  private func migrate(_ connection: OpaquePointer) throws {
    let version = Int(try scalarInt64("PRAGMA user_version", []))
    guard version <= Self.currentSchemaVersion else {
      throw LocalStoreError.unsupportedSchema(version)
    }
    if version == 0 {
      try transaction {
        try execute(schemaV1)
        try execute("PRAGMA user_version = 1")
        try validateForeignKeys()
      }
    }
  }

  private func transaction(_ body: () throws -> Void) throws {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }
    try execute("BEGIN IMMEDIATE")
    do {
      try body()
      try execute("COMMIT")
    } catch {
      try? execute("ROLLBACK")
      throw error
    }
  }

  private enum Binding {
    case integer(Int64)
    case text(String)
  }

  private func insert(_ sql: String, _ values: [Binding]) throws -> Int64 {
    try run(sql, values)
    return sqlite3_last_insert_rowid(database)
  }

  private func scalarInt64(_ sql: String, _ values: [Binding]) throws -> Int64 {
    guard let row = try queryOne(sql, values) else {
      throw LocalStoreError.sqlite("Expected one row")
    }
    return row[0]
  }

  private func queryOne(_ sql: String, _ values: [Binding]) throws -> [Int64]? {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }
    try bind(values, to: statement)
    switch sqlite3_step(statement) {
    case SQLITE_ROW:
      return (0..<sqlite3_column_count(statement)).map { sqlite3_column_int64(statement, $0) }
    case SQLITE_DONE: return nil
    default: throw failure(database)
    }
  }

  private func run(_ sql: String, _ values: [Binding]) throws {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }
    try bind(values, to: statement)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw failure(database) }
  }

  private func execute(_ sql: String) throws {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var error: UnsafeMutablePointer<CChar>?
    guard sqlite3_exec(database, sql, nil, nil, &error) == SQLITE_OK else {
      let message = error.map { String(cString: $0) } ?? "SQLite operation failed"
      sqlite3_free(error)
      throw LocalStoreError.sqlite(message)
    }
  }

  private func validateForeignKeys() throws {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, "PRAGMA foreign_key_check", -1, &statement, nil) == SQLITE_OK, let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }
    if sqlite3_step(statement) == SQLITE_ROW {
      throw LocalStoreError.sqlite("Foreign-key validation failed")
    }
  }

  private func clearTemporaryPreciseState() throws {
    try transaction {
      try run("UPDATE tracking_session SET first_fix_blob = NULL, last_fix_blob = NULL", [])
    }
  }

  private func bind(_ values: [Binding], to statement: OpaquePointer) throws {
    for (offset, value) in values.enumerated() {
      let index = Int32(offset + 1)
      let result: Int32
      switch value {
      case .integer(let integer): result = sqlite3_bind_int64(statement, index, integer)
      case .text(let text): result = sqlite3_bind_text(statement, index, text, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
      }
      guard result == SQLITE_OK else { throw LocalStoreError.sqlite("Could not bind SQLite value") }
    }
  }

  private func failure(_ database: OpaquePointer) -> LocalStoreError {
    LocalStoreError.sqlite(String(cString: sqlite3_errmsg(database)))
  }
}

private let schemaV1 = """
CREATE TABLE installation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), disclosure_version INTEGER, disclosure_accepted_at INTEGER
);
INSERT INTO installation_state (id) VALUES (1);
CREATE TABLE vehicle (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, year INTEGER NOT NULL, make TEXT NOT NULL,
  model TEXT NOT NULL, archived_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX vehicle_active_nickname ON vehicle(archived_at, nickname COLLATE NOCASE);
CREATE TABLE photo_asset (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL UNIQUE REFERENCES vehicle(id) ON DELETE CASCADE,
  relative_filename TEXT NOT NULL UNIQUE, media_type TEXT NOT NULL, byte_count INTEGER NOT NULL CHECK(byte_count >= 0),
  checksum TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE trigger_configuration (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('bluetooth_shortcut', 'wired_carplay_shortcut')),
  setup_completed_at INTEGER, tested_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(vehicle_id, mode)
);
CREATE UNIQUE INDEX one_wired_carplay_assignment ON trigger_configuration(mode) WHERE mode = 'wired_carplay_shortcut';
CREATE TABLE route_binding (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('bluetooth_route', 'carplay_route')), opaque_value TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(kind, opaque_value)
);
CREATE INDEX route_binding_vehicle ON route_binding(vehicle_id);
CREATE TABLE manual_odometer_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  effective_at INTEGER NOT NULL, milli_miles INTEGER NOT NULL CHECK(milli_miles >= 0),
  origin TEXT NOT NULL CHECK(origin IN ('initial', 'manual')), created_at INTEGER NOT NULL
);
CREATE INDEX odometer_latest ON manual_odometer_reading(vehicle_id, effective_at DESC, id DESC);
CREATE TABLE maintenance_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, source_template_key TEXT, mileage_interval INTEGER CHECK(mileage_interval > 0),
  day_interval INTEGER CHECK(day_interval > 0), initial_baseline_date TEXT NOT NULL CHECK(initial_baseline_date GLOB '????-??-??'), initial_baseline_milli_miles INTEGER NOT NULL CHECK(initial_baseline_milli_miles >= 0),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  CHECK(mileage_interval IS NOT NULL OR day_interval IS NOT NULL)
);
CREATE INDEX maintenance_schedule_vehicle ON maintenance_schedule(vehicle_id);
CREATE TABLE maintenance_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES maintenance_schedule(id) ON DELETE SET NULL, service_name TEXT NOT NULL,
  completed_on TEXT NOT NULL CHECK(completed_on GLOB '????-??-??'), milli_miles INTEGER NOT NULL CHECK(milli_miles >= 0), note TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX maintenance_record_vehicle_date ON maintenance_record(vehicle_id, completed_on DESC);
CREATE INDEX maintenance_record_schedule_date ON maintenance_record(schedule_id, completed_on DESC);
CREATE TABLE trip (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL CHECK(source IN ('automatic', 'manual')),
  proposed_vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE SET NULL, started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL,
  captured_milli_miles INTEGER CHECK(captured_milli_miles >= 0), movement_outcome TEXT NOT NULL,
  normal_completion_outcome TEXT NOT NULL, route_corroboration_outcome TEXT NOT NULL,
  quality_counters_json TEXT NOT NULL, failure_reason TEXT
);
CREATE INDEX trip_ended_at ON trip(ended_at DESC);
CREATE INDEX trip_proposed_vehicle ON trip(proposed_vehicle_id);
CREATE TABLE trip_state (
  trip_id INTEGER PRIMARY KEY REFERENCES trip(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE SET NULL, effective_milli_miles INTEGER CHECK(effective_milli_miles >= 0),
  disposition TEXT NOT NULL CHECK(disposition IN ('review_required', 'confirmed', 'rejected', 'failed')), updated_at INTEGER NOT NULL
);
CREATE INDEX trip_state_vehicle_disposition ON trip_state(vehicle_id, disposition, trip_id);
CREATE TABLE trip_revision (
  id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL, occurred_at INTEGER NOT NULL, actor TEXT NOT NULL CHECK(actor IN ('system', 'user')),
  action TEXT NOT NULL, vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE SET NULL,
  effective_milli_miles INTEGER CHECK(effective_milli_miles >= 0), disposition TEXT NOT NULL,
  reason TEXT, UNIQUE(trip_id, revision_number)
);
CREATE INDEX trip_revision_vehicle ON trip_revision(vehicle_id);
CREATE TABLE tracking_session (
  id INTEGER PRIMARY KEY CHECK(id = 1), intended_vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE SET NULL,
  trigger_configuration_id INTEGER REFERENCES trigger_configuration(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK(source IN ('automatic', 'manual')), lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('tracking', 'recovering')),
  started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  reconnect_deadline INTEGER, movement_deadline INTEGER, maximum_duration_deadline INTEGER,
  corroboration_observed INTEGER NOT NULL CHECK(corroboration_observed IN (0, 1)), movement_observed INTEGER NOT NULL CHECK(movement_observed IN (0, 1)), cumulative_milli_miles INTEGER NOT NULL CHECK(cumulative_milli_miles >= 0),
  quality_counters_json TEXT NOT NULL, first_fix_blob BLOB, last_fix_blob BLOB
);
CREATE INDEX tracking_session_intended_vehicle ON tracking_session(intended_vehicle_id);
CREATE INDEX tracking_session_trigger_configuration ON tracking_session(trigger_configuration_id);
CREATE TABLE diagnostic_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  severity TEXT NOT NULL, category TEXT NOT NULL, event_code TEXT NOT NULL, vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES trip(id) ON DELETE CASCADE, detail_schema_version INTEGER NOT NULL,
  sanitized_details_json TEXT NOT NULL, utf8_byte_count INTEGER NOT NULL CHECK(utf8_byte_count >= 0)
);
CREATE INDEX diagnostic_expiry ON diagnostic_event(expires_at);
CREATE INDEX diagnostic_occurred_at ON diagnostic_event(occurred_at);
CREATE INDEX diagnostic_vehicle ON diagnostic_event(vehicle_id);
CREATE INDEX diagnostic_trip ON diagnostic_event(trip_id);
"""
