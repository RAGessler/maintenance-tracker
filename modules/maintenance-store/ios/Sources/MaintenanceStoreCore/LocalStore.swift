import Foundation
import SQLite3

public enum LocalStoreError: Error, Equatable {
  case invalidVehicle
  case invalidMaintenanceRecord
  case invalidMaintenanceSchedule
  case invalidTrip
  case invalidPhoto
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

public struct StoredGarageVehicle: Sendable, Equatable {
  public let id: Int64
  public let nickname: String
  public let year: Int
  public let make: String
  public let model: String
  public let currentOdometerMilliMiles: Int64
  public let scheduleCount: Int
  public let trackingReadiness: String
}

public struct ManualOdometerReading: Sendable, Equatable {
  public let id: Int64
  public let milliMiles: Int64
  public let effectiveAt: Int64
}

public struct ConfirmedTripDistance: Sendable, Equatable {
  public let endedAt: Int64
  public let effectiveMilliMiles: Int64
}

public struct StoredTrip: Sendable, Equatable {
  public let id: Int64
  public let vehicleId: Int64?
  public let startedAt: Int64
  public let endedAt: Int64
  public let capturedMilliMiles: Int64?
  public let effectiveMilliMiles: Int64?
  public let disposition: String
  public let failureReason: String?
}

public struct StoredMaintenanceRecord: Sendable, Equatable {
  public let id: Int64
  public let vehicleId: Int64
  public let scheduleId: Int64?
  public let serviceName: String
  public let completedOn: String
  public let milliMiles: Int64
  public let note: String?
}

public struct StoredMaintenanceSchedule: Sendable, Equatable {
  public let id: Int64
  public let vehicleId: Int64
  public let serviceName: String
  public let sourceTemplateKey: String?
  public let sourceTemplateVersion: Int?
  public let mileageIntervalMilliMiles: Int64?
  public let dayInterval: Int?
  public let baselineDate: String
  public let baselineMilliMiles: Int64
  public let initialBaselineDate: String
  public let initialBaselineMilliMiles: Int64
}

public struct StoreBootstrap: Sendable, Equatable {
  public let disclosureAccepted: Bool
  public let disclosureVersion: Int
  public let schemaVersion: Int
}

/// The only owner of SQLite connections and durable product writes.
public final class LocalStore: @unchecked Sendable {
  public static let currentSchemaVersion = 2

  private var database: OpaquePointer?
  private static let writeLock = NSLock()

  public init(path: String) throws {
    var connection: OpaquePointer?
    guard sqlite3_open_v2(path, &connection, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK,
          let connection else {
      throw LocalStoreError.sqlite("Unable to open the local store")
    }
    database = connection
    do {
      try migrate(connection)
    } catch {
      sqlite3_close(connection)
      database = nil
      throw error
    }
  }

  deinit {
    close()
  }

  public func close() {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }
    guard let database else { return }
    sqlite3_close(database)
    self.database = nil
  }

  public func createVehicle(
    nickname: String,
    year: Int,
    make: String,
    model: String,
    initialOdometerMilliMiles: Int64,
    now: Int64
  ) throws -> StoredVehicle {
    let (normalizedNickname, normalizedMake, normalizedModel) = try normalizedVehicleFields(nickname: nickname, year: year, make: make, model: model)
    guard initialOdometerMilliMiles >= 0 else {
      throw LocalStoreError.invalidVehicle
    }

    var createdVehicleId: Int64?
    try transaction {
      try requireAcceptedDisclosure()
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
      createdVehicleId = vehicleId
    }

    guard let vehicleId = createdVehicleId else {
      throw LocalStoreError.sqlite("Vehicle transaction did not return an identifier")
    }
    return StoredVehicle(id: vehicleId, nickname: normalizedNickname, year: year, make: normalizedMake, model: normalizedModel)
  }

  public func updateVehicle(id: Int64, nickname: String, year: Int, make: String, model: String, now: Int64) throws -> StoredVehicle {
    let (normalizedNickname, normalizedMake, normalizedModel) = try normalizedVehicleFields(nickname: nickname, year: year, make: make, model: model)
    try transaction {
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(id)]) != nil else { throw LocalStoreError.invalidVehicle }
      try run("UPDATE vehicle SET nickname = ?, year = ?, make = ?, model = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL", [.text(normalizedNickname), .integer(Int64(year)), .text(normalizedMake), .text(normalizedModel), .integer(now), .integer(id)])
    }
    return StoredVehicle(id: id, nickname: normalizedNickname, year: year, make: normalizedMake, model: normalizedModel)
  }

  public func archiveVehicle(id: Int64, now: Int64) throws {
    try transaction {
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(id)]) != nil else { throw LocalStoreError.invalidVehicle }
      if try queryOne("SELECT intended_vehicle_id FROM tracking_session WHERE id = 1 AND intended_vehicle_id = ? AND lifecycle_state IN ('tracking', 'recovering')", [.integer(id)]) != nil { throw LocalStoreError.trackingConflict }
      try run("DELETE FROM trigger_configuration WHERE vehicle_id = ?", [.integer(id)])
      try run("DELETE FROM route_binding WHERE vehicle_id = ?", [.integer(id)])
      try run("UPDATE vehicle SET archived_at = ?, updated_at = ? WHERE id = ?", [.integer(now), .integer(now), .integer(id)])
    }
  }

  public func restoreVehicle(id: Int64, now: Int64) throws {
    try transaction {
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NOT NULL", [.integer(id)]) != nil else { throw LocalStoreError.invalidVehicle }
      try run("UPDATE vehicle SET archived_at = NULL, updated_at = ? WHERE id = ?", [.integer(now), .integer(id)])
    }
  }

  public func latestManualOdometer(for vehicleId: Int64) throws -> ManualOdometerReading? {
    guard let row = try queryOne(
      """
      SELECT id, milli_miles, effective_at FROM manual_odometer_reading
      WHERE vehicle_id = ? ORDER BY effective_at DESC, id DESC LIMIT 1
      """,
      [.integer(vehicleId)]
    ) else {
      return nil
    }
    return ManualOdometerReading(id: row[0], milliMiles: row[1], effectiveAt: row[2])
  }

  public func manualOdometerReadings(for vehicleId: Int64) throws -> [ManualOdometerReading] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    let sql = "SELECT id, milli_miles, effective_at FROM manual_odometer_reading WHERE vehicle_id = ? ORDER BY effective_at DESC, id DESC"
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure(database) }
    defer { sqlite3_finalize(statement) }
    try bind([.integer(vehicleId)], to: statement)
    var readings: [ManualOdometerReading] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      readings.append(ManualOdometerReading(
        id: sqlite3_column_int64(statement, 0), milliMiles: sqlite3_column_int64(statement, 1), effectiveAt: sqlite3_column_int64(statement, 2)
      ))
    }
    return readings
  }

  public func appendManualOdometerReading(vehicleId: Int64, milliMiles: Int64, effectiveAt: Int64, now: Int64) throws -> ManualOdometerReading {
    guard milliMiles >= 0 else { throw LocalStoreError.invalidVehicle }
    var readingId: Int64 = 0
    try transaction {
      try requireAcceptedDisclosure()
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(vehicleId)]) != nil else {
        throw LocalStoreError.invalidVehicle
      }
      readingId = try insert(
        "INSERT INTO manual_odometer_reading (vehicle_id, effective_at, milli_miles, origin, created_at) VALUES (?, ?, ?, 'manual', ?)",
        [.integer(vehicleId), .integer(effectiveAt), .integer(milliMiles), .integer(now)]
      )
    }
    guard let reading = try manualOdometerReadings(for: vehicleId).first(where: { $0.id == readingId }) else {
      throw LocalStoreError.sqlite("Manual odometer transaction did not return a reading")
    }
    return reading
  }

  public func confirmedTripDistances(for vehicleId: Int64) throws -> [ConfirmedTripDistance] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    let sql = "SELECT trip.ended_at, trip_state.effective_milli_miles FROM trip JOIN trip_state ON trip_state.trip_id = trip.id WHERE trip_state.vehicle_id = ? AND trip_state.disposition = 'confirmed' ORDER BY trip.ended_at, trip.id"
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure(database) }
    defer { sqlite3_finalize(statement) }
    try bind([.integer(vehicleId)], to: statement)
    var trips: [ConfirmedTripDistance] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      trips.append(ConfirmedTripDistance(endedAt: sqlite3_column_int64(statement, 0), effectiveMilliMiles: sqlite3_column_int64(statement, 1)))
    }
    return trips
  }

  public func maintenanceRecords(for vehicleId: Int64) throws -> [StoredMaintenanceRecord] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    let sql = "SELECT id, vehicle_id, schedule_id, service_name, completed_on, milli_miles, note FROM maintenance_record WHERE vehicle_id = ? ORDER BY completed_on DESC, id DESC"
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure(database) }
    defer { sqlite3_finalize(statement) }
    try bind([.integer(vehicleId)], to: statement)
    var records: [StoredMaintenanceRecord] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let serviceName = sqlite3_column_text(statement, 3), let completedOn = sqlite3_column_text(statement, 4) else { throw LocalStoreError.sqlite("Maintenance record was missing required text") }
      records.append(StoredMaintenanceRecord(
        id: sqlite3_column_int64(statement, 0), vehicleId: sqlite3_column_int64(statement, 1),
        scheduleId: sqlite3_column_type(statement, 2) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 2),
        serviceName: String(cString: serviceName), completedOn: String(cString: completedOn),
        milliMiles: sqlite3_column_int64(statement, 5),
        note: sqlite3_column_type(statement, 6) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(statement, 6)!)
      ))
    }
    return records
  }

  public func createMaintenanceRecord(vehicleId: Int64, serviceName: String, completedOn: String, milliMiles: Int64, note: String?, now: Int64) throws -> StoredMaintenanceRecord {
    let normalizedName = serviceName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedName.isEmpty, validCivilDate(completedOn), milliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceRecord }
    var recordId: Int64 = 0
    try transaction {
      try requireAcceptedDisclosure()
      guard try queryOne("SELECT id FROM vehicle WHERE id = ?", [.integer(vehicleId)]) != nil else { throw LocalStoreError.invalidMaintenanceRecord }
      recordId = try insert("INSERT INTO maintenance_record (vehicle_id, service_name, completed_on, milli_miles, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [.integer(vehicleId), .text(normalizedName), .text(completedOn), .integer(milliMiles), note.map(Binding.text) ?? .text(""), .integer(now), .integer(now)])
      if note == nil { try run("UPDATE maintenance_record SET note = NULL WHERE id = ?", [.integer(recordId)]) }
    }
    guard let record = try maintenanceRecords(for: vehicleId).first(where: { $0.id == recordId }) else { throw LocalStoreError.sqlite("Maintenance record transaction did not return an identifier") }
    return record
  }

  public func updateMaintenanceRecord(id: Int64, vehicleId: Int64, serviceName: String, completedOn: String, milliMiles: Int64, note: String?, now: Int64) throws -> StoredMaintenanceRecord {
    let normalizedName = serviceName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedName.isEmpty, validCivilDate(completedOn), milliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceRecord }
    try transaction {
      guard try queryOne("SELECT id FROM maintenance_record WHERE id = ? AND vehicle_id = ?", [.integer(id), .integer(vehicleId)]) != nil else { throw LocalStoreError.invalidMaintenanceRecord }
      try run("UPDATE maintenance_record SET service_name = ?, completed_on = ?, milli_miles = ?, note = ?, updated_at = ? WHERE id = ? AND vehicle_id = ?", [.text(normalizedName), .text(completedOn), .integer(milliMiles), note.map(Binding.text) ?? .text(""), .integer(now), .integer(id), .integer(vehicleId)])
      if note == nil { try run("UPDATE maintenance_record SET note = NULL WHERE id = ?", [.integer(id)]) }
    }
    guard let record = try maintenanceRecords(for: vehicleId).first(where: { $0.id == id }) else { throw LocalStoreError.sqlite("Maintenance record disappeared after update") }
    return record
  }

  public func deleteMaintenanceRecord(id: Int64) throws {
    try transaction {
      guard try queryOne("SELECT id FROM maintenance_record WHERE id = ?", [.integer(id)]) != nil else { throw LocalStoreError.invalidMaintenanceRecord }
      try run("DELETE FROM maintenance_record WHERE id = ?", [.integer(id)])
    }
  }

  public func maintenanceSchedules(for vehicleId: Int64) throws -> [StoredMaintenanceSchedule] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    let sql = """
      SELECT schedule.id, schedule.vehicle_id, schedule.service_name, schedule.source_template_key,
        schedule.source_template_version, schedule.mileage_interval, schedule.day_interval,
        COALESCE((SELECT completed_on FROM maintenance_record WHERE schedule_id = schedule.id ORDER BY completed_on DESC, id DESC LIMIT 1), schedule.initial_baseline_date),
        COALESCE((SELECT milli_miles FROM maintenance_record WHERE schedule_id = schedule.id ORDER BY completed_on DESC, id DESC LIMIT 1), schedule.initial_baseline_milli_miles),
        schedule.initial_baseline_date, schedule.initial_baseline_milli_miles
      FROM maintenance_schedule AS schedule WHERE schedule.vehicle_id = ? ORDER BY schedule.service_name COLLATE NOCASE, schedule.id
      """
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure(database) }
    defer { sqlite3_finalize(statement) }
    try bind([.integer(vehicleId)], to: statement)
    var schedules: [StoredMaintenanceSchedule] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let serviceName = sqlite3_column_text(statement, 2), let baselineDate = sqlite3_column_text(statement, 7) else { throw LocalStoreError.sqlite("Maintenance schedule was missing required text") }
      schedules.append(StoredMaintenanceSchedule(
        id: sqlite3_column_int64(statement, 0), vehicleId: sqlite3_column_int64(statement, 1), serviceName: String(cString: serviceName),
        sourceTemplateKey: sqlite3_column_type(statement, 3) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(statement, 3)!),
        sourceTemplateVersion: sqlite3_column_type(statement, 4) == SQLITE_NULL ? nil : Int(sqlite3_column_int64(statement, 4)),
        mileageIntervalMilliMiles: sqlite3_column_type(statement, 5) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 5),
        dayInterval: sqlite3_column_type(statement, 6) == SQLITE_NULL ? nil : Int(sqlite3_column_int64(statement, 6)),
        baselineDate: String(cString: baselineDate), baselineMilliMiles: sqlite3_column_int64(statement, 8),
        initialBaselineDate: String(cString: sqlite3_column_text(statement, 9)!), initialBaselineMilliMiles: sqlite3_column_int64(statement, 10)
      ))
    }
    return schedules
  }

  public func createMaintenanceSchedule(vehicleId: Int64, serviceName: String, sourceTemplateKey: String?, sourceTemplateVersion: Int?, mileageIntervalMilliMiles: Int64?, dayInterval: Int?, baselineDate: String, baselineMilliMiles: Int64, now: Int64) throws -> StoredMaintenanceSchedule {
    try validateSchedule(serviceName: serviceName, mileageIntervalMilliMiles: mileageIntervalMilliMiles, dayInterval: dayInterval, baselineDate: baselineDate, baselineMilliMiles: baselineMilliMiles)
    var scheduleId: Int64 = 0
    try transaction {
      try requireAcceptedDisclosure()
      guard try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(vehicleId)]) != nil else { throw LocalStoreError.invalidMaintenanceSchedule }
      scheduleId = try insert("INSERT INTO maintenance_schedule (vehicle_id, service_name, source_template_key, source_template_version, mileage_interval, day_interval, initial_baseline_date, initial_baseline_milli_miles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [.integer(vehicleId), .text(serviceName.trimmingCharacters(in: .whitespacesAndNewlines)), sourceTemplateKey.map(Binding.text) ?? .null, sourceTemplateVersion.map { .integer(Int64($0)) } ?? .null, mileageIntervalMilliMiles.map(Binding.integer) ?? .null, dayInterval.map { .integer(Int64($0)) } ?? .null, .text(baselineDate), .integer(baselineMilliMiles), .integer(now), .integer(now)])
    }
    guard let schedule = try maintenanceSchedules(for: vehicleId).first(where: { $0.id == scheduleId }) else { throw LocalStoreError.sqlite("Maintenance schedule transaction did not return an identifier") }
    return schedule
  }

  public func updateMaintenanceSchedule(id: Int64, serviceName: String, mileageIntervalMilliMiles: Int64?, dayInterval: Int?, baselineDate: String, baselineMilliMiles: Int64, now: Int64) throws -> StoredMaintenanceSchedule {
    try validateSchedule(serviceName: serviceName, mileageIntervalMilliMiles: mileageIntervalMilliMiles, dayInterval: dayInterval, baselineDate: baselineDate, baselineMilliMiles: baselineMilliMiles)
    var vehicleId: Int64 = 0
    try transaction {
      guard let row = try queryOne("SELECT vehicle_id FROM maintenance_schedule WHERE id = ?", [.integer(id)]) else { throw LocalStoreError.invalidMaintenanceSchedule }
      vehicleId = row[0]
      try run("UPDATE maintenance_schedule SET service_name = ?, mileage_interval = ?, day_interval = ?, initial_baseline_date = ?, initial_baseline_milli_miles = ?, updated_at = ? WHERE id = ?", [.text(serviceName.trimmingCharacters(in: .whitespacesAndNewlines)), mileageIntervalMilliMiles.map(Binding.integer) ?? .null, dayInterval.map { .integer(Int64($0)) } ?? .null, .text(baselineDate), .integer(baselineMilliMiles), .integer(now), .integer(id)])
    }
    guard let schedule = try maintenanceSchedules(for: vehicleId).first(where: { $0.id == id }) else { throw LocalStoreError.sqlite("Maintenance schedule disappeared after update") }
    return schedule
  }

  public func deleteMaintenanceSchedule(id: Int64) throws {
    try transaction {
      guard try queryOne("SELECT id FROM maintenance_schedule WHERE id = ?", [.integer(id)]) != nil else { throw LocalStoreError.invalidMaintenanceSchedule }
      try run("DELETE FROM maintenance_schedule WHERE id = ?", [.integer(id)])
    }
  }

  public func completeMaintenanceSchedule(id: Int64, completedOn: String, milliMiles: Int64, note: String?, now: Int64) throws -> StoredMaintenanceRecord {
    guard validCivilDate(completedOn), milliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceRecord }
    var vehicleId: Int64 = 0
    var recordId: Int64 = 0
    try transaction {
      try requireAcceptedDisclosure()
      guard let schedule = try queryOne("SELECT vehicle_id FROM maintenance_schedule WHERE id = ?", [.integer(id)]) else {
        throw LocalStoreError.invalidMaintenanceSchedule
      }
      vehicleId = schedule[0]
      recordId = try insert(
        "INSERT INTO maintenance_record (vehicle_id, schedule_id, service_name, completed_on, milli_miles, note, created_at, updated_at) SELECT vehicle_id, id, service_name, ?, ?, ?, ?, ? FROM maintenance_schedule WHERE id = ?",
        [.text(completedOn), .integer(milliMiles), note.map(Binding.text) ?? .null, .integer(now), .integer(now), .integer(id)]
      )
    }
    guard let record = try maintenanceRecords(for: vehicleId).first(where: { $0.id == recordId }) else {
      throw LocalStoreError.sqlite("Maintenance completion transaction did not return an identifier")
    }
    return record
  }

  public func vehicles(archived: Bool = false) throws -> [StoredGarageVehicle] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, archived ? archivedGarageVehiclesQuery : garageVehiclesQuery, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }

    var vehicles: [StoredGarageVehicle] = []
    while true {
      let result = sqlite3_step(statement)
      if result == SQLITE_DONE { break }
      guard result == SQLITE_ROW else { throw failure(database) }
      guard let nickname = sqlite3_column_text(statement, 1),
            let make = sqlite3_column_text(statement, 3),
            let model = sqlite3_column_text(statement, 4),
            let trackingReadiness = sqlite3_column_text(statement, 7) else {
        throw LocalStoreError.sqlite("Vehicle row was missing required text")
      }
      vehicles.append(StoredGarageVehicle(
        id: sqlite3_column_int64(statement, 0),
        nickname: String(cString: nickname),
        year: Int(sqlite3_column_int64(statement, 2)),
        make: String(cString: make),
        model: String(cString: model),
        currentOdometerMilliMiles: sqlite3_column_int64(statement, 5),
        scheduleCount: Int(sqlite3_column_int64(statement, 6)),
        trackingReadiness: String(cString: trackingReadiness)
      ))
    }
    return vehicles
  }

  public func schemaVersion() throws -> Int {
    Int(try scalarInt64("PRAGMA user_version", []))
  }

  public func bootstrap() throws -> StoreBootstrap {
    guard let row = try queryOne("SELECT disclosure_version FROM installation_state WHERE id = 1", []) else {
      throw LocalStoreError.sqlite("Missing installation state")
    }
    return StoreBootstrap(
      disclosureAccepted: row[0] > 0,
      disclosureVersion: Int(row[0]),
      schemaVersion: try schemaVersion()
    )
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
      """
      SELECT CASE lifecycle_state
        WHEN 'tracking' THEN 2
        WHEN 'recovering' THEN 1
        ELSE 0
      END FROM tracking_session WHERE id = 1
      """,
      []
    ) else {
      return "idle"
    }
    switch row[0] {
    case 2: return "tracking"
    case 1: return "recovering"
    default: return "idle"
    }
  }

  public func startTracking(vehicleId: Int64, source: String, now: Int64) throws {
    guard source == "manual" || source == "automatic" else {
      throw LocalStoreError.sqlite("Unsupported tracking source")
    }
    try transaction {
      try requireAcceptedDisclosure()
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

  public func stopTracking(now: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)) throws {
    try transaction {
      guard let session = try queryOne("SELECT intended_vehicle_id, started_at, movement_observed, cumulative_milli_miles FROM tracking_session WHERE id = 1", []) else { return }
      let hasUsableDistance = session[2] == 1 && session[3] > 0
      let tripId = try insert(
        "INSERT INTO trip (source, proposed_vehicle_id, started_at, ended_at, captured_milli_miles, movement_outcome, normal_completion_outcome, route_corroboration_outcome, quality_counters_json, failure_reason) VALUES ('manual', ?, ?, ?, ?, ?, 'explicit_end', 'not_required', '{}', ?)",
        [.integer(session[0]), .integer(session[1]), .integer(now), hasUsableDistance ? .integer(session[3]) : .null, .text(hasUsableDistance ? "confirmed" : "not_confirmed"), hasUsableDistance ? .null : .text("movement_not_confirmed")]
      )
      try run("INSERT INTO trip_state (trip_id, vehicle_id, effective_milli_miles, disposition, updated_at) VALUES (?, ?, ?, ?, ?)", [.integer(tripId), .integer(session[0]), hasUsableDistance ? .integer(session[3]) : .null, .text(hasUsableDistance ? "confirmed" : "review_required"), .integer(now)])
      try run("INSERT INTO trip_revision (trip_id, revision_number, occurred_at, actor, action, vehicle_id, effective_milli_miles, disposition) VALUES (?, 1, ?, 'system', 'finalized', ?, ?, ?)", [.integer(tripId), .integer(now), .integer(session[0]), hasUsableDistance ? .integer(session[3]) : .null, .text(hasUsableDistance ? "confirmed" : "review_required")])
      try run("DELETE FROM tracking_session WHERE id = 1", [])
    }
  }

  public func trips(for vehicleId: Int64) throws -> [StoredTrip] {
    try storedTrips("WHERE trip_state.vehicle_id = ?", [.integer(vehicleId)])
  }

  public func reviewTrip(id: Int64, action: String, effectiveMilliMiles: Int64?, vehicleId: Int64?, now: Int64) throws -> StoredTrip {
    guard ["confirm", "correct", "reassign", "reject"].contains(action) else { throw LocalStoreError.invalidTrip }
    try transaction {
      guard let state = try queryOne("SELECT vehicle_id, effective_milli_miles FROM trip_state WHERE trip_id = ?", [.integer(id)]) else { throw LocalStoreError.invalidTrip }
      var nextVehicleId = state[0]
      let hasNoEffectiveDistance = try queryOne("SELECT effective_milli_miles IS NULL FROM trip_state WHERE trip_id = ?", [.integer(id)])?[0] == 1
      var nextEffective: Int64? = hasNoEffectiveDistance ? nil : state[1]
      var disposition = "review_required"
      let revisionAction = action == "correct" ? "corrected" : action == "reassign" ? "reassigned" : action == "reject" ? "rejected" : "confirmed"
      if action == "reject" {
        disposition = "rejected"
        nextEffective = nil
      } else if action == "reassign" {
        guard let vehicleId, try queryOne("SELECT id FROM vehicle WHERE id = ? AND archived_at IS NULL", [.integer(vehicleId)]) != nil else { throw LocalStoreError.invalidTrip }
        nextVehicleId = vehicleId
        disposition = nextEffective == nil ? "review_required" : "confirmed"
      } else {
        if let effectiveMilliMiles { guard effectiveMilliMiles > 0 else { throw LocalStoreError.invalidTrip }; nextEffective = effectiveMilliMiles }
        guard let nextEffective, nextEffective > 0 else { throw LocalStoreError.invalidTrip }
        disposition = "confirmed"
      }
      let revision = try scalarInt64("SELECT COALESCE(MAX(revision_number), 0) + 1 FROM trip_revision WHERE trip_id = ?", [.integer(id)])
      try run("UPDATE trip_state SET vehicle_id = ?, effective_milli_miles = ?, disposition = ?, updated_at = ? WHERE trip_id = ?", [.integer(nextVehicleId), nextEffective.map(Binding.integer) ?? .null, .text(disposition), .integer(now), .integer(id)])
      try run("INSERT INTO trip_revision (trip_id, revision_number, occurred_at, actor, action, vehicle_id, effective_milli_miles, disposition) VALUES (?, ?, ?, 'user', ?, ?, ?, ?)", [.integer(id), .integer(revision), .integer(now), .text(revisionAction), .integer(nextVehicleId), nextEffective.map(Binding.integer) ?? .null, .text(disposition)])
    }
    guard let trip = try storedTrips("WHERE trip.id = ?", [.integer(id)]).first else { throw LocalStoreError.invalidTrip }
    return trip
  }

  public func reconcilePhotoFiles(in directoryURL: URL) throws {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }

    let fileManager = FileManager.default
    guard fileManager.fileExists(atPath: directoryURL.path) else { return }
    let missingAssetIDs = try photoAssets().compactMap { asset in
      guard let url = photoFileURL(for: asset.filename, in: directoryURL),
            fileManager.fileExists(atPath: url.path) else {
        return asset.id
      }
      return nil
    }
    try transactionLocked {
      for id in missingAssetIDs {
        try run("DELETE FROM photo_asset WHERE id = ?", [.integer(id)])
      }
    }
    let referencedFilenames = Set(try photoAssets().map(\.filename))
    for fileURL in try fileManager.contentsOfDirectory(
      at: directoryURL,
      includingPropertiesForKeys: [.isRegularFileKey],
      options: []
    ) {
      let resourceValues = try fileURL.resourceValues(forKeys: [.isRegularFileKey])
      guard resourceValues.isRegularFile == true,
            referencedFilenames.contains(fileURL.lastPathComponent) == false else {
        continue
      }
      try fileManager.removeItem(at: fileURL)
    }
  }

  public func replaceHeroPhoto(for vehicleId: Int64, jpegData: Data, in directoryURL: URL, now: Int64) throws {
    guard !jpegData.isEmpty, jpegData.count <= 2_000_000 else { throw LocalStoreError.invalidPhoto }
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }

    let fileManager = FileManager.default
    try fileManager.createDirectory(
      at: directoryURL,
      withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.complete]
    )
    let filename = "\(UUID().uuidString.lowercased()).jpg"
    let fileURL = directoryURL.appendingPathComponent(filename)
    try jpegData.write(to: fileURL, options: .atomic)
    try fileManager.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: fileURL.path)
    let oldFilename: String?

    do {
      oldFilename = try heroPhotoFilename(for: vehicleId)
      try transactionLocked {
        guard try queryOne("SELECT id FROM vehicle WHERE id = ?", [.integer(vehicleId)]) != nil else {
          throw LocalStoreError.invalidVehicle
        }
        try run(
          """
          INSERT INTO photo_asset (vehicle_id, relative_filename, media_type, byte_count, checksum, created_at)
          VALUES (?, ?, 'image/jpeg', ?, ?, ?)
          ON CONFLICT(vehicle_id) DO UPDATE SET relative_filename = excluded.relative_filename,
            media_type = excluded.media_type, byte_count = excluded.byte_count, checksum = excluded.checksum,
            created_at = excluded.created_at
          """,
          [.integer(vehicleId), .text(filename), .integer(Int64(jpegData.count)), .text(UUID().uuidString), .integer(now)]
        )
      }
    } catch {
      try? fileManager.removeItem(at: fileURL)
      throw error
    }
    if let oldFilename, let oldFileURL = photoFileURL(for: oldFilename, in: directoryURL) {
      // A later open reconciles a stale file without misreporting a committed replacement as failed.
      try? fileManager.removeItem(at: oldFileURL)
    }
  }

  public func removeHeroPhoto(for vehicleId: Int64, in directoryURL: URL) throws {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }

    let filename = try heroPhotoFilename(for: vehicleId)
    try transactionLocked {
      try run("DELETE FROM photo_asset WHERE vehicle_id = ?", [.integer(vehicleId)])
    }
    if let filename, let fileURL = photoFileURL(for: filename, in: directoryURL) {
      // A later open reconciles a stale file without misreporting a committed removal as failed.
      try? FileManager.default.removeItem(at: fileURL)
    }
  }

  public func heroPhotoFilenames() throws -> [String] {
    try photoAssets().map(\.filename)
  }

  public func heroPhotoFilename(for vehicleId: Int64) throws -> String? {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, "SELECT relative_filename FROM photo_asset WHERE vehicle_id = ?", -1, &statement, nil) == SQLITE_OK,
          let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }
    try bind([.integer(vehicleId)], to: statement)
    guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
    guard let filename = sqlite3_column_text(statement, 0) else {
      throw LocalStoreError.sqlite("Photo asset was missing its filename")
    }
    return String(cString: filename)
  }

  private func configure(_ connection: OpaquePointer) throws {
    try execute("PRAGMA foreign_keys = ON")
    try execute("PRAGMA journal_mode = WAL")
    try execute("PRAGMA synchronous = FULL")
  }

  private func migrate(_ connection: OpaquePointer) throws {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }
    guard sqlite3_busy_timeout(connection, 5000) == SQLITE_OK else {
      throw LocalStoreError.sqlite("Could not configure SQLite busy timeout")
    }
    let initialVersion = Int(try scalarInt64("PRAGMA user_version", []))
    guard initialVersion <= Self.currentSchemaVersion else {
      throw LocalStoreError.unsupportedSchema(initialVersion)
    }
    try configure(connection)
    try transactionLocked {
      let version = Int(try scalarInt64("PRAGMA user_version", []))
      guard version <= Self.currentSchemaVersion else {
        throw LocalStoreError.unsupportedSchema(version)
      }
      if version == 0 {
        try execute(schemaV1)
        try execute("PRAGMA user_version = 1")
      }
      if version <= 1 {
        try execute("ALTER TABLE maintenance_schedule ADD COLUMN source_template_version INTEGER CHECK(source_template_version > 0)")
        try execute("PRAGMA user_version = 2")
      }
      try validateForeignKeys()
    }
  }

  private func transaction(_ body: () throws -> Void) throws {
    Self.writeLock.lock()
    defer { Self.writeLock.unlock() }
    try transactionLocked(body)
  }

  private func requireAcceptedDisclosure() throws {
    guard (try queryOne("SELECT disclosure_version FROM installation_state WHERE id = 1", [])?[0] ?? 0) > 0 else {
      throw LocalStoreError.disclosureRequired
    }
  }

  private func normalizedVehicleFields(nickname: String, year: Int, make: String, model: String) throws -> (String, String, String) {
    let normalizedNickname = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedMake = make.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedNickname.isEmpty, !normalizedMake.isEmpty, !normalizedModel.isEmpty, year >= 1886 else { throw LocalStoreError.invalidVehicle }
    return (normalizedNickname, normalizedMake, normalizedModel)
  }

  private func validateSchedule(serviceName: String, mileageIntervalMilliMiles: Int64?, dayInterval: Int?, baselineDate: String, baselineMilliMiles: Int64) throws {
    guard !serviceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          mileageIntervalMilliMiles.map({ $0 > 0 }) ?? true,
          dayInterval.map({ $0 > 0 }) ?? true,
          mileageIntervalMilliMiles != nil || dayInterval != nil,
          validCivilDate(baselineDate), baselineMilliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceSchedule }
  }

  private func transactionLocked(_ body: () throws -> Void) throws {
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
    case null
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

  private func storedTrips(_ clause: String, _ values: [Binding]) throws -> [StoredTrip] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    let sql = "SELECT trip.id, trip_state.vehicle_id, trip.started_at, trip.ended_at, trip.captured_milli_miles, trip_state.effective_milli_miles, trip_state.disposition, trip.failure_reason FROM trip JOIN trip_state ON trip_state.trip_id = trip.id \(clause) ORDER BY trip.ended_at DESC, trip.id DESC"
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure(database) }
    defer { sqlite3_finalize(statement) }
    try bind(values, to: statement)
    var trips: [StoredTrip] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let disposition = sqlite3_column_text(statement, 6) else { throw LocalStoreError.sqlite("Trip state was missing disposition") }
      trips.append(StoredTrip(
        id: sqlite3_column_int64(statement, 0), vehicleId: sqlite3_column_type(statement, 1) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 1),
        startedAt: sqlite3_column_int64(statement, 2), endedAt: sqlite3_column_int64(statement, 3),
        capturedMilliMiles: sqlite3_column_type(statement, 4) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 4),
        effectiveMilliMiles: sqlite3_column_type(statement, 5) == SQLITE_NULL ? nil : sqlite3_column_int64(statement, 5),
        disposition: String(cString: disposition), failureReason: sqlite3_column_type(statement, 7) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(statement, 7)!)))
    }
    return trips
  }

  private func photoAssets() throws -> [(id: Int64, filename: String)] {
    guard let database else { throw LocalStoreError.sqlite("Store is closed") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, "SELECT id, relative_filename FROM photo_asset", -1, &statement, nil) == SQLITE_OK,
          let statement else {
      throw failure(database)
    }
    defer { sqlite3_finalize(statement) }

    var assets: [(id: Int64, filename: String)] = []
    while true {
      switch sqlite3_step(statement) {
      case SQLITE_DONE:
        return assets
      case SQLITE_ROW:
        guard let filename = sqlite3_column_text(statement, 1) else {
          throw LocalStoreError.sqlite("Photo asset was missing its filename")
        }
        assets.append((sqlite3_column_int64(statement, 0), String(cString: filename)))
      default:
        throw failure(database)
      }
    }
  }

  private func photoFileURL(for filename: String, in directoryURL: URL) -> URL? {
    guard !filename.isEmpty,
          !filename.contains("/"),
          !filename.contains("\\"),
          filename != ".",
          filename != ".." else {
      return nil
    }
    return directoryURL.appendingPathComponent(filename, isDirectory: false)
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

  private func bind(_ values: [Binding], to statement: OpaquePointer) throws {
    for (offset, value) in values.enumerated() {
      let index = Int32(offset + 1)
      let result: Int32
      switch value {
      case .null: result = sqlite3_bind_null(statement, index)
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

let garageVehiclesQuery = """
  SELECT vehicle.id, vehicle.nickname, vehicle.year, vehicle.make, vehicle.model, manual_odometer_reading.milli_miles,
    (SELECT COUNT(*) FROM maintenance_schedule WHERE vehicle_id = vehicle.id),
    CASE WHEN EXISTS (SELECT 1 FROM trigger_configuration WHERE vehicle_id = vehicle.id) THEN 'automatic_setup' ELSE 'manual_only' END
  FROM vehicle
  JOIN manual_odometer_reading ON manual_odometer_reading.id = (
    SELECT id FROM manual_odometer_reading
    WHERE vehicle_id = vehicle.id ORDER BY effective_at DESC, id DESC LIMIT 1
  )
  WHERE vehicle.archived_at IS NULL
  ORDER BY vehicle.nickname COLLATE NOCASE, vehicle.id
  """

let archivedGarageVehiclesQuery = """
  SELECT vehicle.id, vehicle.nickname, vehicle.year, vehicle.make, vehicle.model, manual_odometer_reading.milli_miles,
    (SELECT COUNT(*) FROM maintenance_schedule WHERE vehicle_id = vehicle.id),
    CASE WHEN EXISTS (SELECT 1 FROM trigger_configuration WHERE vehicle_id = vehicle.id) THEN 'automatic_setup' ELSE 'manual_only' END
  FROM vehicle
  JOIN manual_odometer_reading ON manual_odometer_reading.id = (
    SELECT id FROM manual_odometer_reading
    WHERE vehicle_id = vehicle.id ORDER BY effective_at DESC, id DESC LIMIT 1
  )
  WHERE vehicle.archived_at IS NOT NULL
  ORDER BY vehicle.nickname COLLATE NOCASE, vehicle.id
  """

private func validCivilDate(_ value: String) -> Bool {
  guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return false }
  let parts = value.split(separator: "-").compactMap { Int($0) }
  guard parts.count == 3 else { return false }
  var components = DateComponents()
  components.calendar = Calendar(identifier: .gregorian)
  components.year = parts[0]
  components.month = parts[1]
  components.day = parts[2]
  guard let date = components.calendar?.date(from: components) else { return false }
  let resolved = components.calendar?.dateComponents([.year, .month, .day], from: date)
  return resolved?.year == parts[0] && resolved?.month == parts[1] && resolved?.day == parts[2]
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
  captured_milli_miles INTEGER CHECK(captured_milli_miles >= 0),
  movement_outcome TEXT NOT NULL CHECK(movement_outcome IN ('confirmed', 'not_confirmed')),
  normal_completion_outcome TEXT NOT NULL CHECK(normal_completion_outcome IN ('explicit_end', 'route_loss_after_grace', 'not_completed')),
  route_corroboration_outcome TEXT NOT NULL CHECK(route_corroboration_outcome IN ('matched', 'not_observed', 'unknown', 'conflicting', 'not_required')),
  quality_counters_json TEXT NOT NULL,
  failure_reason TEXT CHECK(failure_reason IS NULL OR failure_reason IN ('movement_not_confirmed', 'unusable_distance', 'location_permission_lost', 'location_failed', 'restoration_failed', 'maximum_duration_exceeded')),
  CHECK((source = 'manual' AND route_corroboration_outcome = 'not_required') OR (source = 'automatic' AND route_corroboration_outcome <> 'not_required'))
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
  action TEXT NOT NULL CHECK(action IN ('finalized', 'confirmed', 'corrected', 'reassigned', 'rejected')),
  vehicle_id INTEGER REFERENCES vehicle(id) ON DELETE SET NULL,
  effective_milli_miles INTEGER CHECK(effective_milli_miles >= 0),
  disposition TEXT NOT NULL CHECK(disposition IN ('review_required', 'confirmed', 'rejected', 'failed')),
  reason TEXT CHECK(reason IS NULL), UNIQUE(trip_id, revision_number)
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
