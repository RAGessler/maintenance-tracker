import Testing
@testable import MaintenanceStoreCore

@Test("converts GPS meters to milli-miles without inflating mileage")
func convertsMetersToMilliMiles() {
  #expect(metersToMilliMiles(6_437.376) == 4_000)
}

@Test("automatic trips without matching route require review on normal completion")
func reviewsAutomaticTripWithoutRouteObservation() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(location: .init(timestamp: 2, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 0), now: 2)
  try engine.receive(location: .init(timestamp: 3, speedMetersPerSecond: 4, displacementMeters: 10, distanceMilliMiles: 1_250), now: 3)
  try engine.end(vehicleID: 7, now: 4)

  #expect(repository.finalizations == [.init(disposition: .reviewRequired, completion: .explicitEnd, reason: .routeNotCorroborated, distanceMilliMiles: 1_250)])
  #expect(repository.currentSession == nil)
}

@Test("automatic trips without route corroboration require review")
func reviewsAutomaticTripWithoutRouteCorroboration() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(location: .init(timestamp: 1, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 500), now: 1)
  try engine.end(vehicleID: 7, now: 2)

  #expect(repository.finalizations == [.init(disposition: .reviewRequired, completion: .explicitEnd, reason: .routeNotCorroborated, distanceMilliMiles: 500)])
}

@Test("automatic confirmation requires matching route and usable distance")
func confirmsOnlyWithRouteMovementAndDistance() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(location: .init(timestamp: 1, speedMetersPerSecond: 1, displacementMeters: 2, distanceMilliMiles: 700), now: 1)
  #expect(repository.currentSession?.cumulativeMilliMiles == 0)
  try engine.receive(route: .matching, now: 2)
  try engine.receive(location: .init(timestamp: 3, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 0), now: 3)
  try engine.receive(location: .init(timestamp: 4, speedMetersPerSecond: 4, displacementMeters: 10, distanceMilliMiles: 500), now: 4)
  try engine.end(vehicleID: 7, now: 5)
  #expect(repository.finalizations.last == .init(disposition: .confirmed, completion: .explicitEnd, reason: nil, distanceMilliMiles: 500))
}

@Test("invalid, negative, stale and overflowing aggregate fixes do not add mileage")
func rejectsInvalidAggregateFixes() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 10)
  try engine.receive(location: .init(timestamp: 9, speedMetersPerSecond: 3, displacementMeters: 100, distanceMilliMiles: 50), now: 11)
  try engine.receive(location: .init(timestamp: 11, speedMetersPerSecond: .infinity, displacementMeters: 0, distanceMilliMiles: 50), now: 11)
  try engine.receive(location: .init(timestamp: 11, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: -1), now: 11)
  #expect(repository.currentSession?.movementObserved == false)
  try engine.receive(location: .init(timestamp: 12, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: Int64.max), now: 12)
  try engine.receive(location: .init(timestamp: 13, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 1), now: 13)
  #expect(repository.currentSession?.cumulativeMilliMiles == Int64.max)
}

@Test("automatic trips without movement finalize as review candidates")
func finalizesNoMovementWithoutRevisionConstraintFailure() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)

  let engine = TrackingEngine(repository: store)
  prepareAutomaticSetup(store, vehicleID: vehicle.id, now: 2)
  try engine.startAutomatic(vehicleID: vehicle.id, now: 4)
  try engine.receive(route: .matching, now: 4)
  try engine.end(vehicleID: vehicle.id, now: 5)

  let trip = try #require(store.trips(for: vehicle.id).first)
  #expect(trip.disposition == "review_required")
  #expect(trip.failureReason == "movement_not_confirmed")
}

@Test("route loss enters grace and matching reconnect resumes the same session")
func resumesDuringReconnectGrace() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.routeLost(now: 5_000, carPlayActive: false)
  #expect(repository.currentSession?.state == .recovering)
  #expect(repository.currentSession?.reconnectDeadline == 185_000)
  try engine.receive(route: .matching, now: 6_000)
  #expect(repository.currentSession?.state == .awaitingMovement)
  #expect(repository.currentSession?.reconnectDeadline == nil)
}

@Test("passive route-loss completion remains review-required")
func retainsReviewCandidateAfterReconnectGraceExpires() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(route: .matching, now: 1)
  try engine.receive(location: .init(timestamp: 2, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 1_000), now: 2)
  try engine.routeLost(now: 3, carPlayActive: false)
  try engine.tick(now: 180_003)

  #expect(repository.finalizations.last?.disposition == .confirmed)
}

@Test("permission loss before reconciliation keeps an expired reconnect candidate under review")
func permissionFailureDoesNotTickExpiredReconnectGrace() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(route: .matching, now: 1)
  try engine.receive(location: .init(timestamp: 2, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 1_000), now: 2)
  try engine.routeLost(now: 3, carPlayActive: false)

  try engine.permissionLost(now: 180_004)

  #expect(repository.finalizations.last?.disposition == .reviewRequired)
  #expect(repository.finalizations.last?.reason == .locationPermissionLost)
  #expect(repository.finalizations.last?.completion == .notCompleted)
}

@Test("location failure before reconciliation keeps an expired reconnect candidate under review")
func locationFailureDoesNotTickExpiredReconnectGrace() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(route: .matching, now: 1)
  try engine.receive(location: .init(timestamp: 2, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 1_000), now: 2)
  try engine.routeLost(now: 3, carPlayActive: false)

  try engine.locationFailed(now: 180_004)

  #expect(repository.finalizations.last?.disposition == .reviewRequired)
  #expect(repository.finalizations.last?.reason == .locationFailed)
  #expect(repository.finalizations.last?.completion == .notCompleted)
}

@Test("deadline and location failures retain review candidates")
func finalizesDeadlineAndLocationFailuresForReview() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.tick(now: 600_000)
  #expect(repository.finalizations.last?.reason == .movementNotConfirmed)

  try engine.startAutomatic(vehicleID: 7, now: 700_000)
  try engine.locationFailed(now: 701_000)
  #expect(repository.finalizations.last?.reason == .locationFailed)

  try engine.startAutomatic(vehicleID: 7, now: 800_000)
  try engine.permissionLost(now: 801_000)
  #expect(repository.finalizations.last?.reason == .locationPermissionLost)

  try engine.startAutomatic(vehicleID: 7, now: 900_000)
  try engine.restorationFailed(now: 901_000)
  #expect(repository.finalizations.last?.reason == .restorationFailed)
}

@Test("stale session updates cannot save over a replacement session")
func rejectsStaleSessionSave() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 10)
  let staleSession = try #require(repository.currentSession)
  repository.currentSession = TrackingSession(vehicleID: 7, source: .automatic, state: .awaitingMovement, startedAt: 20, movementDeadline: 600_020, maximumDurationDeadline: 43_200_020)
  #expect(throws: TrackingEngineError.conflict) {
    try repository.save(staleSession)
  }
}

@Test("wrong-vehicle end is rejected before an overdue deadline can finalize")
func wrongVehicleEndDoesNotTickOrFinalize() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)
  try engine.startAutomatic(vehicleID: 7, now: 0)

  #expect(throws: TrackingEngineError.wrongVehicle) { try engine.end(vehicleID: 8, now: 600_000) }
  #expect(repository.currentSession?.vehicleID == 7)
  #expect(repository.finalizations.isEmpty)

  try engine.end(vehicleID: 7, now: 600_001)
  #expect(repository.currentSession == nil)
  #expect(repository.finalizations.last?.reason == .movementNotConfirmed)
}

@Test("SQLite wrong-vehicle end leaves an overdue persisted session untouched")
func persistedWrongVehicleEndDoesNotMutateTrip() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 2)
  try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 10)
  let active = try #require(try store.session())
  let engine = TrackingEngine(repository: store)

  #expect(throws: TrackingEngineError.wrongVehicle) {
    try engine.end(vehicleID: vehicle.id + 1, now: active.maximumDurationDeadline)
  }
  #expect(try store.session() == active)
  #expect(try store.trips(for: vehicle.id).isEmpty)

  try engine.end(vehicleID: vehicle.id, now: active.maximumDurationDeadline)
  #expect(try store.session() == nil)
  #expect(try store.trips(for: vehicle.id).first?.failureReason == "maximum_duration_exceeded")
}

@Test("SQLite finalization writes the automatic trip state and revision before clearing the session")
func atomicallyFinalizesPersistedAutomaticTrip() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)
  try store.configureShortcut(for: vehicle.id, mode: "bluetooth_shortcut", now: 2)
  try store.recordShortcutTest(for: vehicle.id, now: 3)
  let engine = TrackingEngine(repository: store)

  prepareAutomaticSetup(store, vehicleID: vehicle.id, now: 2)
  try engine.startAutomatic(vehicleID: vehicle.id, now: 5)
  try engine.receive(route: .matching, now: 6)
  try engine.receive(location: .init(timestamp: 7, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 900), now: 7)
  try engine.end(vehicleID: vehicle.id, now: 8)

  #expect(try store.trackingState() == "idle")
  let trip = try #require(store.trips(for: vehicle.id).first)
  #expect(trip.disposition == "confirmed")
  #expect(trip.effectiveMilliMiles == 900)
  #expect(try store.tripRevisions(for: trip.id).map(\.action) == ["finalized"])
}

@Test("automatic starts cannot adopt a manual session and manual fallback deadlines use milliseconds")
func keepsManualSessionsSeparateFromAutomaticCommands() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)
  try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 2)

  #expect(throws: LocalStoreError.trackingConflict) { try store.beginAutomatic(vehicleID: vehicle.id, now: 3) }
  #expect(try store.session()?.maximumDurationDeadline == 43_200_002)
}

private final class InMemoryTrackingRepository: TrackingSessionRepository {
  var currentSession: TrackingSession?
  var finalizations: [TrackingFinalization] = []

  func beginAutomatic(vehicleID: Int64, now: Int64) throws -> TrackingSession {
    guard currentSession == nil else { throw TrackingEngineError.conflict }
    let session = TrackingSession(vehicleID: vehicleID, source: .automatic, state: .awaitingMovement, startedAt: now, movementDeadline: now + 600_000, maximumDurationDeadline: now + 43_200_000)
    self.currentSession = session
    return session
  }

  func session() throws -> TrackingSession? { currentSession }
  func save(_ session: TrackingSession) throws {
    guard let currentSession, currentSession.vehicleID == session.vehicleID, currentSession.source == session.source, currentSession.startedAt == session.startedAt else { throw TrackingEngineError.conflict }
    self.currentSession = session
  }
  func finalize(_ finalization: TrackingFinalization, session: TrackingSession, now: Int64) throws {
    guard let currentSession, currentSession.vehicleID == session.vehicleID, currentSession.source == session.source, currentSession.startedAt == session.startedAt else { throw TrackingEngineError.conflict }
    finalizations.append(finalization)
    self.currentSession = nil
  }
}

private func prepareAutomaticSetup(_ store: LocalStore, vehicleID: Int64, now: Int64) {
  try! store.configureShortcut(for: vehicleID, mode: "bluetooth_shortcut", now: now)
  try! store.recordShortcutTest(for: vehicleID, now: now + 1)
  try! store.recordRouteObservation(for: vehicleID, kind: "bluetooth_route", opaqueValue: "route-\(vehicleID)", now: now + 2)
}
