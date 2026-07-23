import CoreLocation
import Foundation
import SQLite3

struct StoredEvent {
  let id: Int64
  let eventId: String
  let timestamp: String
  let source: String
  let name: String
  let tripId: String?
  let payload: String

  var dictionary: [String: Any?] {
    [
      "id": id,
      "eventId": eventId,
      "timestamp": timestamp,
      "source": source,
      "name": name,
      "tripId": tripId,
      "payload": payload
    ]
  }
}

struct TripSummary {
  let id: String
  let vehicleName: String?
  let triggerSource: String
  let startedAt: String
  let endedAt: String?
  let state: String
  let distanceMeters: Double
  let acceptedSamples: Int
  let rejectedSamples: Int

  var dictionary: [String: Any?] {
    [
      "id": id,
      "vehicleName": vehicleName,
      "triggerSource": triggerSource,
      "startedAt": startedAt,
      "endedAt": endedAt,
      "state": state,
      "distanceMeters": distanceMeters,
      "acceptedSamples": acceptedSamples,
      "rejectedSamples": rejectedSamples
    ]
  }
}

final class EventStore: @unchecked Sendable {
  static let shared = EventStore()

  private let queue = DispatchQueue(label: "com.ragessler.trip-event-store")
  private let isoFormatter = ISO8601DateFormatter()

  let databaseURL: URL

  private init() {
    let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    let directory = library.appendingPathComponent("LocalDatabase", isDirectory: true)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    databaseURL = directory.appendingPathComponent("car-stereo-spike.db")
    queue.sync { migrate() }
    protectDatabaseFiles()
  }

  @discardableResult
  func append(
    source: String,
    name: String,
    tripId: String?,
    payload: [String: Any] = [:],
    eventId: String = UUID().uuidString
  ) -> StoredEvent? {
    queue.sync {
      guard let db = openDatabase() else { return nil }
      defer { sqlite3_close(db) }

      let timestamp = isoFormatter.string(from: Date())
      let payloadData = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
      let payloadString = payloadData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
      let sql = "INSERT OR IGNORE INTO tracking_events (event_id, timestamp, source, name, trip_id, payload) VALUES (?, ?, ?, ?, ?, ?)"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return nil }
      defer { sqlite3_finalize(statement) }

      bind(eventId, at: 1, to: statement)
      bind(timestamp, at: 2, to: statement)
      bind(source, at: 3, to: statement)
      bind(name, at: 4, to: statement)
      bind(tripId, at: 5, to: statement)
      bind(payloadString, at: 6, to: statement)

      guard sqlite3_step(statement) == SQLITE_DONE else { return nil }
      return StoredEvent(
        id: sqlite3_last_insert_rowid(db),
        eventId: eventId,
        timestamp: timestamp,
        source: source,
        name: name,
        tripId: tripId,
        payload: payloadString
      )
    }
  }

  func events(limit: Int) -> [StoredEvent] {
    queue.sync {
      guard let db = openDatabase() else { return [] }
      defer { sqlite3_close(db) }

      let sql = "SELECT id, event_id, timestamp, source, name, trip_id, payload FROM tracking_events ORDER BY id DESC LIMIT ?"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
      defer { sqlite3_finalize(statement) }
      sqlite3_bind_int(statement, 1, Int32(max(1, min(limit, 1_000))))

      var result: [StoredEvent] = []
      while sqlite3_step(statement) == SQLITE_ROW {
        result.append(StoredEvent(
          id: sqlite3_column_int64(statement, 0),
          eventId: text(statement, column: 1) ?? "",
          timestamp: text(statement, column: 2) ?? "",
          source: text(statement, column: 3) ?? "",
          name: text(statement, column: 4) ?? "",
          tripId: text(statement, column: 5),
          payload: text(statement, column: 6) ?? "{}"
        ))
      }
      return result
    }
  }

  func setRuntime(key: String, value: String?) {
    queue.sync {
      guard let db = openDatabase() else { return }
      defer { sqlite3_close(db) }
      let sql = "INSERT INTO tracking_runtime_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
      defer { sqlite3_finalize(statement) }
      bind(key, at: 1, to: statement)
      bind(value, at: 2, to: statement)
      sqlite3_step(statement)
    }
  }

  func runtime(key: String) -> String? {
    queue.sync {
      guard let db = openDatabase() else { return nil }
      defer { sqlite3_close(db) }
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, "SELECT value FROM tracking_runtime_state WHERE key = ?", -1, &statement, nil) == SQLITE_OK else { return nil }
      defer { sqlite3_finalize(statement) }
      bind(key, at: 1, to: statement)
      return sqlite3_step(statement) == SQLITE_ROW ? text(statement, column: 0) : nil
    }
  }

  func appendLocation(_ location: CLLocation, tripId: String?, accepted: Bool, reason: String?) {
    queue.async {
      guard let db = self.openDatabase() else { return }
      defer { sqlite3_close(db) }
      let sql = "INSERT INTO location_samples (trip_id, timestamp, latitude, longitude, accuracy, speed, accepted, rejection_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
      defer { sqlite3_finalize(statement) }
      self.bind(tripId, at: 1, to: statement)
      self.bind(self.isoFormatter.string(from: location.timestamp), at: 2, to: statement)
      sqlite3_bind_double(statement, 3, location.coordinate.latitude)
      sqlite3_bind_double(statement, 4, location.coordinate.longitude)
      sqlite3_bind_double(statement, 5, location.horizontalAccuracy)
      sqlite3_bind_double(statement, 6, location.speed)
      sqlite3_bind_int(statement, 7, accepted ? 1 : 0)
      self.bind(reason, at: 8, to: statement)
      sqlite3_step(statement)
    }
  }

  func beginTrip(id: String, source: String) {
    queue.sync {
      guard let db = openDatabase() else { return }
      defer { sqlite3_close(db) }
      let sql = "INSERT OR IGNORE INTO trips (id, trigger_source, started_at, state) VALUES (?, ?, ?, ?)"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
      defer { sqlite3_finalize(statement) }
      bind(id, at: 1, to: statement)
      bind(source, at: 2, to: statement)
      bind(isoFormatter.string(from: Date()), at: 3, to: statement)
      bind("start-candidate", at: 4, to: statement)
      sqlite3_step(statement)
    }
  }

  func updateTrip(id: String?, state: String, ended: Bool) {
    guard let id else { return }
    queue.sync {
      guard let db = openDatabase() else { return }
      defer { sqlite3_close(db) }
      let sql = "UPDATE trips SET state = ?, ended_at = CASE WHEN ? = 1 THEN ? ELSE ended_at END WHERE id = ?"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
      defer { sqlite3_finalize(statement) }
      bind(state, at: 1, to: statement)
      sqlite3_bind_int(statement, 2, ended ? 1 : 0)
      bind(isoFormatter.string(from: Date()), at: 3, to: statement)
      bind(id, at: 4, to: statement)
      sqlite3_step(statement)
    }
  }

  func setTripVehicle(id: String?, vehicleName: String?) {
    guard let id else { return }
    queue.sync {
      guard let db = openDatabase() else { return }
      defer { sqlite3_close(db) }
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, "UPDATE trips SET vehicle_name = ? WHERE id = ?", -1, &statement, nil) == SQLITE_OK else { return }
      defer { sqlite3_finalize(statement) }
      bind(vehicleName, at: 1, to: statement)
      bind(id, at: 2, to: statement)
      sqlite3_step(statement)
    }
  }

  func tripSummaries(limit: Int) -> [TripSummary] {
    queue.sync {
      guard let db = openDatabase() else { return [] }
      defer { sqlite3_close(db) }
      let sql = """
        SELECT t.id, t.vehicle_name, t.trigger_source, t.started_at, t.ended_at, t.state,
          COALESCE((SELECT COUNT(*) FROM location_samples s WHERE s.trip_id = t.id AND s.accepted = 1), 0),
          COALESCE((SELECT COUNT(*) FROM location_samples s WHERE s.trip_id = t.id AND s.accepted = 0), 0)
        FROM trips t ORDER BY t.started_at DESC LIMIT ?
        """
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
      defer { sqlite3_finalize(statement) }
      sqlite3_bind_int(statement, 1, Int32(max(1, min(limit, 100))))
      var result: [TripSummary] = []
      while sqlite3_step(statement) == SQLITE_ROW {
        let id = text(statement, column: 0) ?? ""
        result.append(TripSummary(
          id: id,
          vehicleName: text(statement, column: 1),
          triggerSource: text(statement, column: 2) ?? "",
          startedAt: text(statement, column: 3) ?? "",
          endedAt: text(statement, column: 4),
          state: text(statement, column: 5) ?? "",
          distanceMeters: distance(forTrip: id, database: db),
          acceptedSamples: Int(sqlite3_column_int64(statement, 6)),
          rejectedSamples: Int(sqlite3_column_int64(statement, 7))
        ))
      }
      return result
    }
  }

  func clearAll() {
    queue.sync {
      guard let db = openDatabase() else { return }
      defer { sqlite3_close(db) }
      sqlite3_exec(
        db,
        "DELETE FROM location_samples; DELETE FROM tracking_events; DELETE FROM trips; DELETE FROM tracking_runtime_state;",
        nil,
        nil,
        nil
      )
    }
  }

  private func migrate() {
    guard let db = openDatabase() else { return }
    defer { sqlite3_close(db) }
    let sql = """
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS tracking_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        name TEXT NOT NULL,
        trip_id TEXT,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tracking_runtime_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY NOT NULL,
        trigger_source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        state TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS location_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT,
        timestamp TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL NOT NULL,
        speed REAL NOT NULL,
        accepted INTEGER NOT NULL,
        rejection_reason TEXT
      );
      """
    sqlite3_exec(db, sql, nil, nil, nil)
    sqlite3_exec(db, "ALTER TABLE trips ADD COLUMN vehicle_name TEXT", nil, nil, nil)
  }

  private func protectDatabaseFiles() {
    for url in [databaseURL, URL(fileURLWithPath: databaseURL.path + "-wal"), URL(fileURLWithPath: databaseURL.path + "-shm")] {
      guard FileManager.default.fileExists(atPath: url.path) else { continue }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      var mutableURL = url
      try? mutableURL.setResourceValues(values)
      try? FileManager.default.setAttributes(
        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
        ofItemAtPath: url.path
      )
    }
  }

  private func openDatabase() -> OpaquePointer? {
    var db: OpaquePointer?
    guard sqlite3_open_v2(databaseURL.path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      if db != nil { sqlite3_close(db) }
      return nil
    }
    sqlite3_busy_timeout(db, 5_000)
    return db
  }

  private func bind(_ value: String?, at index: Int32, to statement: OpaquePointer?) {
    if let value {
      sqlite3_bind_text(statement, index, value, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    } else {
      sqlite3_bind_null(statement, index)
    }
  }

  private func text(_ statement: OpaquePointer?, column: Int32) -> String? {
    guard let value = sqlite3_column_text(statement, column) else { return nil }
    return String(cString: value)
  }

  private func distance(forTrip id: String, database db: OpaquePointer?) -> Double {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(
      db,
      "SELECT timestamp, latitude, longitude, accuracy, speed FROM location_samples WHERE trip_id = ? AND accepted = 1 ORDER BY timestamp ASC, id ASC",
      -1,
      &statement,
      nil
    ) == SQLITE_OK else { return 0 }
    defer { sqlite3_finalize(statement) }
    bind(id, at: 1, to: statement)
    var previous: CLLocation?
    var total = 0.0
    while sqlite3_step(statement) == SQLITE_ROW {
      let latitude = sqlite3_column_double(statement, 1)
      let longitude = sqlite3_column_double(statement, 2)
      let accuracy = sqlite3_column_double(statement, 3)
      let speed = sqlite3_column_double(statement, 4)
      guard (-90...90).contains(latitude), (-180...180).contains(longitude), accuracy <= 50, speed <= 55 else { continue }
      let current = CLLocation(latitude: latitude, longitude: longitude)
      if let previous {
        let segment = current.distance(from: previous)
        // Ignore tiny movements that are within the uncertainty of both fixes.
        if segment > max(5, accuracy) {
          total += segment
        }
      }
      previous = current
    }
    return total
  }
}
