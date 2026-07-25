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
