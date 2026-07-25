import Foundation
import SQLite3
import Testing
@testable import MaintenanceStoreCore

@Test("creating a vehicle creates its authoritative initial odometer reading atomically")
func createsVehicleAndInitialReading() throws {
  let store = try LocalStore(path: ":memory:")

  #expect(throws: LocalStoreError.disclosureRequired) {
    try store.createVehicle(
      nickname: "Daily",
      year: 2020,
      make: "Honda",
      model: "Civic",
      initialOdometerMilliMiles: 42_125_000,
      now: 1_700_000_000_000
    )
  }
  _ = try store.acceptDisclosure(version: 1, now: 1_700_000_000_000)

  let vehicle = try store.createVehicle(
    nickname: "Daily",
    year: 2020,
    make: "Honda",
    model: "Civic",
    initialOdometerMilliMiles: 42_125_000,
    now: 1_700_000_000_000
  )

  #expect(vehicle.id == 1)
  #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == 42_125_000)
}

@Test("bootstrap retains the accepted disclosure version and created vehicle across store opens")
func retainsFirstRunState() throws {
  let directoryURL = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }

  let store = try LocalStore(path: databaseURL.path)
  #expect(try store.bootstrap().disclosureVersion == 0)
  _ = try store.acceptDisclosure(version: 3, now: 1)
  _ = try store.createVehicle(
    nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 42_125_000, now: 2
  )

  let reopenedStore = try LocalStore(path: databaseURL.path)
  #expect(try reopenedStore.bootstrap().disclosureVersion == 3)
  #expect(try reopenedStore.vehicles().map(\.nickname) == ["Daily"])
}

@Test("invalid vehicle input does not create a partial vehicle or odometer reading")
func rejectsInvalidVehicleAtomically() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)

  #expect(throws: LocalStoreError.invalidVehicle) {
    try store.createVehicle(
      nickname: "", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 2
    )
  }

  #expect(try store.vehicles().isEmpty)
}

@Test("concurrent vehicle creation returns each vehicle's generated identifier")
func returnsVehicleIdentifierFromItsTransaction() async throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let vehicles = try await withThrowingTaskGroup(of: (StoredVehicle, Int64).self) { group in
    for value in 0..<100 {
      group.addTask {
        let milliMiles = Int64(value)
        return (
          try store.createVehicle(
            nickname: "Vehicle \(value)", year: 2020, make: "Honda", model: "Civic",
            initialOdometerMilliMiles: milliMiles, now: 1
          ),
          milliMiles
        )
      }
    }

    var results: [(StoredVehicle, Int64)] = []
    for try await result in group {
      results.append(result)
    }
    return results
  }

  for (vehicle, milliMiles) in vehicles {
    #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == milliMiles)
  }
}

@Test("concurrent store opens migrate only once")
func serializesInitialMigration() async throws {
  let directoryURL = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer {
    try? FileManager.default.removeItem(at: directoryURL)
  }

  try await withThrowingTaskGroup(of: Void.self) { group in
    for _ in 0..<20 {
      group.addTask {
        _ = try LocalStore(path: databaseURL.path)
      }
    }
    try await group.waitForAll()
  }
}

@Test("tracking state is temporary and is cleared when a session stops")
func clearsTemporaryTrackingState() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(
    nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1
  )

  try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 3)
  #expect(try store.trackingState() == "tracking")

  try store.stopTracking()
  #expect(try store.trackingState() == "idle")
}

@Test("a competing vehicle cannot replace an active tracking session")
func rejectsCompetingTrackingStart() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let first = try store.createVehicle(nickname: "First", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)
  let second = try store.createVehicle(nickname: "Second", year: 2021, make: "Honda", model: "Fit", initialOdometerMilliMiles: 0, now: 2)
  try store.startTracking(vehicleId: first.id, source: "manual", now: 4)

  #expect(throws: LocalStoreError.trackingConflict) {
    try store.startTracking(vehicleId: second.id, source: "automatic", now: 5)
  }
}

@Test("archiving removes tracking setup, retains history, and restores without setup")
func archivesAndRestoresVehicleSafely() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }
  let store = try LocalStore(path: databaseURL.path)
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 42_000_000, now: 2)
  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }
  #expect(execute(database, "INSERT INTO trigger_configuration (vehicle_id, mode, created_at, updated_at) VALUES (\(vehicle.id), 'bluetooth_shortcut', 3, 3)") == SQLITE_OK)
  #expect(execute(database, "INSERT INTO route_binding (vehicle_id, kind, opaque_value, created_at) VALUES (\(vehicle.id), 'bluetooth_route', 'route-1', 3)") == SQLITE_OK)

  try store.archiveVehicle(id: vehicle.id, now: 4)
  #expect(try store.vehicles().isEmpty)
  #expect(try store.vehicles(archived: true).map(\.nickname) == ["Daily"])
  #expect(try scalar(database, "SELECT COUNT(*) FROM trigger_configuration WHERE vehicle_id = \(vehicle.id)") == 0)
  #expect(try scalar(database, "SELECT COUNT(*) FROM route_binding WHERE vehicle_id = \(vehicle.id)") == 0)
  #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == 42_000_000)

  try store.restoreVehicle(id: vehicle.id, now: 5)
  #expect(try store.vehicles().map(\.nickname) == ["Daily"])
  #expect(try scalar(database, "SELECT COUNT(*) FROM trigger_configuration WHERE vehicle_id = \(vehicle.id)") == 0)
}

@Test("archiving an actively tracked vehicle is blocked")
func blocksArchiveDuringActiveTrip() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 2)
  try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 3)

  #expect(throws: LocalStoreError.trackingConflict) {
    try store.archiveVehicle(id: vehicle.id, now: 4)
  }
  #expect(try store.vehicles().map(\.nickname) == ["Daily"])
}

@Test("editing a vehicle persists identity fields without changing its odometer")
func editsVehicleIdentity() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 42_000_000, now: 2)

  let edited = try store.updateVehicle(id: vehicle.id, nickname: "Road car", year: 2021, make: "Mazda", model: "3", now: 3)
  #expect(edited == StoredVehicle(id: vehicle.id, nickname: "Road car", year: 2021, make: "Mazda", model: "3"))
  #expect(try store.vehicles().first?.nickname == "Road car")
  #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == 42_000_000)
}

@Test("editing rejects invalid identity fields without partial changes")
func rejectsInvalidVehicleEdit() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 2)

  #expect(throws: LocalStoreError.invalidVehicle) {
    try store.updateVehicle(id: vehicle.id, nickname: "", year: 2020, make: "Honda", model: "Civic", now: 3)
  }
  #expect(try store.vehicles().first?.nickname == "Daily")
}

@Test("the v1 schema accepts only approved durable trip codes")
func constrainsPersistedTripCodes() throws {
  let directoryURL = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }

  let store = try LocalStore(path: databaseURL.path)
  #expect(try store.schemaVersion() == 1)

  var database: OpaquePointer?
  #expect(sqlite3_open(databaseURL.path, &database) == SQLITE_OK)
  guard let database else {
    Issue.record("Could not open schema test connection")
    return
  }
  defer { sqlite3_close(database) }

  let movementOutcomes = ["confirmed", "not_confirmed"]
  let completionOutcomes = ["explicit_end", "route_loss_after_grace", "not_completed"]
  let corroborationOutcomes = ["matched", "not_observed", "unknown", "conflicting"]
  let failureReasons = [
    "movement_not_confirmed", "unusable_distance", "location_permission_lost",
    "location_failed", "restoration_failed", "maximum_duration_exceeded",
  ]

  for movement in movementOutcomes {
    #expect(insertTrip(database, movement: movement) == SQLITE_OK)
  }
  for completion in completionOutcomes {
    #expect(insertTrip(database, completion: completion) == SQLITE_OK)
  }
  for corroboration in corroborationOutcomes {
    #expect(insertTrip(database, corroboration: corroboration) == SQLITE_OK)
  }
  #expect(insertTrip(database, source: "manual", corroboration: "not_required") == SQLITE_OK)
  for failureReason in failureReasons {
    #expect(insertTrip(database, failureReason: failureReason) == SQLITE_OK)
  }

  #expect(insertTrip(database, movement: "unknown") == SQLITE_CONSTRAINT)
  #expect(insertTrip(database, completion: "unknown") == SQLITE_CONSTRAINT)
  #expect(insertTrip(database, corroboration: "unsupported") == SQLITE_CONSTRAINT)
  #expect(insertTrip(database, failureReason: "unsupported") == SQLITE_CONSTRAINT)
  #expect(insertTrip(database, source: "automatic", corroboration: "not_required") == SQLITE_CONSTRAINT)

  let tripID = sqlite3_last_insert_rowid(database)
  let actions = ["finalized", "confirmed", "corrected", "reassigned", "rejected"]
  let dispositions = ["review_required", "confirmed", "rejected", "failed"]
  for (offset, action) in actions.enumerated() {
    #expect(insertRevision(database, tripID: tripID, revision: offset + 1, action: action) == SQLITE_OK)
  }
  for (offset, disposition) in dispositions.enumerated() {
    #expect(insertRevision(database, tripID: tripID, revision: actions.count + offset + 1, disposition: disposition) == SQLITE_OK)
  }
  #expect(insertRevision(database, tripID: tripID, revision: 10, action: "unsupported") == SQLITE_CONSTRAINT)
  #expect(insertRevision(database, tripID: tripID, revision: 11, disposition: "unsupported") == SQLITE_CONSTRAINT)
  #expect(insertRevision(database, tripID: tripID, revision: 12, reason: "unsupported") == SQLITE_CONSTRAINT)
}

@Test("a failed migration rolls back and a corrected store retries from the same version")
func retriesFailedMigrationWithoutDestructiveFallback() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }

  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }
  #expect(execute(database, "CREATE TABLE vehicle (id INTEGER PRIMARY KEY)") == SQLITE_OK)

  #expect(throws: LocalStoreError.self) {
    _ = try LocalStore(path: databaseURL.path)
  }
  #expect(try userVersion(database) == 0)
  #expect(try tableExists(database, named: "installation_state") == false)

  #expect(execute(database, "DROP TABLE vehicle") == SQLITE_OK)
  let store = try LocalStore(path: databaseURL.path)
  #expect(try store.schemaVersion() == LocalStore.currentSchemaVersion)
}

@Test("a newer schema remains untouched and blocks opening")
func refusesNewerSchemaWithoutFallback() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }

  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }
  #expect(execute(database, "PRAGMA user_version = 2") == SQLITE_OK)

  #expect(throws: LocalStoreError.unsupportedSchema(2)) {
    _ = try LocalStore(path: databaseURL.path)
  }
  #expect(try userVersion(database) == 2)
  #expect(try tableExists(database, named: "installation_state") == false)
}

@Test("reconciliation removes stale files and missing photo references without deleting referenced files")
func reconcilesPhotoFiles() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  let photosURL = directoryURL.appendingPathComponent("photos", isDirectory: true)
  defer { try? FileManager.default.removeItem(at: directoryURL) }
  try FileManager.default.createDirectory(at: photosURL, withIntermediateDirectories: true)
  let store = try LocalStore(path: databaseURL.path)
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(
    nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1
  )
  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }
  #expect(execute(database, "INSERT INTO photo_asset (vehicle_id, relative_filename, media_type, byte_count, checksum, created_at) VALUES (\(vehicle.id), 'referenced.jpg', 'image/jpeg', 1, 'a', 1)") == SQLITE_OK)
  #expect(execute(database, "INSERT INTO vehicle (nickname, year, make, model, created_at, updated_at) VALUES ('Other', 2021, 'Honda', 'Fit', 1, 1)") == SQLITE_OK)
  #expect(execute(database, "INSERT INTO photo_asset (vehicle_id, relative_filename, media_type, byte_count, checksum, created_at) VALUES (2, 'missing.jpg', 'image/jpeg', 1, 'b', 1)") == SQLITE_OK)
  try Data("photo".utf8).write(to: photosURL.appendingPathComponent("referenced.jpg"))
  try Data("stale".utf8).write(to: photosURL.appendingPathComponent("stale.tmp"))
  try Data("unreferenced".utf8).write(to: photosURL.appendingPathComponent("unreferenced.jpg"))

  try store.reconcilePhotoFiles(in: photosURL)

  #expect(FileManager.default.fileExists(atPath: photosURL.appendingPathComponent("referenced.jpg").path))
  #expect(!FileManager.default.fileExists(atPath: photosURL.appendingPathComponent("stale.tmp").path))
  #expect(!FileManager.default.fileExists(atPath: photosURL.appendingPathComponent("unreferenced.jpg").path))
  #expect(try scalar(database, "SELECT COUNT(*) FROM photo_asset") == 1)

  try FileManager.default.removeItem(at: photosURL)
  try store.reconcilePhotoFiles(in: photosURL)
  #expect(try scalar(database, "SELECT COUNT(*) FROM photo_asset") == 1)
}

@Test("representative garage and odometer reads use their approved indexes")
func usesApprovedReadIndexes() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }
  _ = try LocalStore(path: databaseURL.path)
  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }

  let garagePlan = try queryPlan(database, garageVehiclesQuery)
  #expect(garagePlan.contains("vehicle_active_nickname"))
  #expect(garagePlan.contains("odometer_latest"))
}

@Test("the v1 store enforces and validates foreign-key relationships")
func enforcesForeignKeys() throws {
  let directoryURL = try temporaryDirectory()
  let databaseURL = directoryURL.appendingPathComponent("store.sqlite")
  defer { try? FileManager.default.removeItem(at: directoryURL) }
  _ = try LocalStore(path: databaseURL.path)
  let database = try openDatabase(at: databaseURL)
  defer { sqlite3_close(database) }
  #expect(execute(database, "PRAGMA foreign_keys = ON") == SQLITE_OK)

  #expect(execute(database, "INSERT INTO manual_odometer_reading (vehicle_id, effective_at, milli_miles, origin, created_at) VALUES (999, 1, 0, 'manual', 1)") == SQLITE_CONSTRAINT)
  #expect(try scalar(database, "SELECT COUNT(*) FROM pragma_foreign_key_check") == 0)
}

private func insertTrip(
  _ database: OpaquePointer,
  source: String = "automatic",
  movement: String = "confirmed",
  completion: String = "explicit_end",
  corroboration: String = "matched",
  failureReason: String? = nil
) -> Int32 {
  let failureValue = failureReason.map { "'\($0)'" } ?? "NULL"
  return execute(
    database,
    """
    INSERT INTO trip (
      source, started_at, ended_at, movement_outcome, normal_completion_outcome,
      route_corroboration_outcome, quality_counters_json, failure_reason
    ) VALUES (
      '\(source)', 1, 2, '\(movement)', '\(completion)', '\(corroboration)', '{}', \(failureValue)
    )
    """
  )
}

private func insertRevision(
  _ database: OpaquePointer,
  tripID: Int64,
  revision: Int,
  action: String = "finalized",
  disposition: String = "review_required",
  reason: String? = nil
) -> Int32 {
  let reasonValue = reason.map { "'\($0)'" } ?? "NULL"
  return execute(
    database,
    """
    INSERT INTO trip_revision (
      trip_id, revision_number, occurred_at, actor, action, disposition, reason
    ) VALUES (
      \(tripID), \(revision), 1, 'system', '\(action)', '\(disposition)', \(reasonValue)
    )
    """
  )
}

private func execute(_ database: OpaquePointer, _ sql: String) -> Int32 {
  var error: UnsafeMutablePointer<CChar>?
  let result = sqlite3_exec(database, sql, nil, nil, &error)
  sqlite3_free(error)
  return result
}

private func temporaryDirectory() throws -> URL {
  let directoryURL = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
  return directoryURL
}

private func openDatabase(at url: URL) throws -> OpaquePointer {
  var database: OpaquePointer?
  guard sqlite3_open(url.path, &database) == SQLITE_OK, let database else {
    throw LocalStoreError.sqlite("Could not open test database")
  }
  return database
}

private func scalar(_ database: OpaquePointer, _ sql: String) throws -> Int64 {
  var statement: OpaquePointer?
  guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
    throw LocalStoreError.sqlite("Could not prepare test query")
  }
  defer { sqlite3_finalize(statement) }
  guard sqlite3_step(statement) == SQLITE_ROW else {
    throw LocalStoreError.sqlite("Test query returned no row")
  }
  return sqlite3_column_int64(statement, 0)
}

private func userVersion(_ database: OpaquePointer) throws -> Int64 {
  try scalar(database, "PRAGMA user_version")
}

private func tableExists(_ database: OpaquePointer, named name: String) throws -> Bool {
  try scalar(database, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '\(name)'") == 1
}

private func queryPlan(_ database: OpaquePointer, _ sql: String) throws -> String {
  var statement: OpaquePointer?
  guard sqlite3_prepare_v2(database, "EXPLAIN QUERY PLAN \(sql)", -1, &statement, nil) == SQLITE_OK, let statement else {
    throw LocalStoreError.sqlite("Could not prepare query plan")
  }
  defer { sqlite3_finalize(statement) }
  var details: [String] = []
  while sqlite3_step(statement) == SQLITE_ROW {
    guard let detail = sqlite3_column_text(statement, 3) else { continue }
    details.append(String(cString: detail))
  }
  return details.joined(separator: "\n")
}
