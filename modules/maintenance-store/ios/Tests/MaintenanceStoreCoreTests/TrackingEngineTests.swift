import Testing
@testable import MaintenanceStoreCore

@Test("automatic trips only confirm after trigger route movement and normal completion")
func confirmsOnlyCompleteCorroboratedAutomaticTrip() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(route: .matching, now: 1)
  try engine.receive(location: .init(timestamp: 2, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 0), now: 2)
  try engine.receive(location: .init(timestamp: 3, speedMetersPerSecond: 4, displacementMeters: 10, distanceMilliMiles: 1_250), now: 3)
  try engine.end(vehicleID: 7, now: 4)

  #expect(repository.finalizations == [.init(disposition: .confirmed, completion: .explicitEnd, reason: nil, distanceMilliMiles: 1_250)])
  #expect(repository.currentSession == nil)
}

@Test("automatic trips fail closed when route corroboration is missing")
func retainsReviewCandidateWithoutRouteCorroboration() throws {
  let repository = InMemoryTrackingRepository()
  let engine = TrackingEngine(repository: repository)

  try engine.startAutomatic(vehicleID: 7, now: 0)
  try engine.receive(location: .init(timestamp: 1, speedMetersPerSecond: 3, displacementMeters: 0, distanceMilliMiles: 500), now: 1)
  try engine.end(vehicleID: 7, now: 2)

  #expect(repository.finalizations == [.init(disposition: .reviewRequired, completion: .explicitEnd, reason: .routeNotCorroborated, distanceMilliMiles: 500)])
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

  #expect(repository.finalizations.last?.disposition == .reviewRequired)
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
}

@Test("SQLite finalization writes the automatic trip state and revision before clearing the session")
func atomicallyFinalizesPersistedAutomaticTrip() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 0)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)
  try store.configureShortcut(for: vehicle.id, mode: "bluetooth_shortcut", now: 2)
  try store.recordShortcutTest(for: vehicle.id, now: 3)
  try store.recordRouteObservation(for: vehicle.id, kind: "bluetooth_route", opaqueValue: "route", now: 4)
  let engine = TrackingEngine(repository: store)

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
  func save(_ session: TrackingSession) throws { self.currentSession = session }
  func finalize(_ finalization: TrackingFinalization, session: TrackingSession, now: Int64) throws {
    finalizations.append(finalization)
    self.currentSession = nil
  }
}
