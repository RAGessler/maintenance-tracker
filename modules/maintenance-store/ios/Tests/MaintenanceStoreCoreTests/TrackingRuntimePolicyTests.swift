import Testing
@testable import MaintenanceStoreCore

@Test("runtime policy accepts ordered in-session fixes with current timestamps")
func acceptsCurrentOrderedFixes() {
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 20_000, now: 25_000, sessionStartedAt: 10_000, lastAcceptedTimestamp: 15_000) == .accept)
}

@Test("manual tracking accepts foreground authorization and requests only when not determined")
func manualAuthorizationIsForegroundOnly() {
  #expect(TrackingRuntimePolicy.manualPermissionDecision(for: .whenInUse) == .allowed)
  #expect(TrackingRuntimePolicy.manualPermissionDecision(for: .alwaysReduced) == .allowed)
  #expect(TrackingRuntimePolicy.manualPermissionDecision(for: .notDetermined) == .requestWhenInUse)
  #expect(TrackingRuntimePolicy.manualPermissionDecision(for: .denied) == .denied)
  #expect(TrackingRuntimePolicy.manualPermissionDecision(for: .restricted) == .denied)
}

@Test("runtime policy rejects stale, future, pre-session, and out-of-order fixes")
func rejectsInvalidTimestampOrder() {
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 1_000, now: 40_000, sessionStartedAt: 1_000, lastAcceptedTimestamp: nil) == .rejectStale)
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 70_001, now: 40_000, sessionStartedAt: 1_000, lastAcceptedTimestamp: nil) == .rejectStale)
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 9_999, now: 10_000, sessionStartedAt: 10_000, lastAcceptedTimestamp: nil) == .rejectStale)
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 19_999, now: 20_000, sessionStartedAt: 1_000, lastAcceptedTimestamp: 20_000) == .rejectStale)
}

@Test("runtime policy skips mileage across gaps over thirty seconds and accepts a new anchor")
func skipsDistanceAcrossLongGap() {
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 50_001, now: 50_001, sessionStartedAt: 1_000, lastAcceptedTimestamp: 20_000) == .skipDistance)
  #expect(TrackingRuntimePolicy.locationDecision(timestamp: 50_000, now: 50_000, sessionStartedAt: 1_000, lastAcceptedTimestamp: 20_000) == .accept)
}

@MainActor
@Test("permission gate rejects overlapping starts and resumes the single waiter")
func permissionGateRejectsOverlappingStartRequests() async throws {
  let gate = ForegroundPermissionRequestGate()
  var authorizationRequests = 0
  let firstRequest = Task {
    try await gate.waitForPermission(vehicleID: 7) { authorizationRequests += 1 }
  }
  await Task.yield()

  #expect(authorizationRequests == 1)
  #expect(gate.isRequestPending)
  await #expect(throws: ForegroundPermissionRequestGateError.requestInProgress) {
    try await gate.waitForPermission(vehicleID: 8) { authorizationRequests += 1 }
  }
  #expect(authorizationRequests == 1)
  #expect(gate.resolve(granted: true))
  let resolution = try await firstRequest.value
  #expect(gate.consume(resolution) == .granted)
  #expect(!gate.isRequestPending)
}

@MainActor
@Test("Stop cancels a pending permission start and a later grant cannot resume it")
func permissionGateCancellationPreventsLateStart() async throws {
  let gate = ForegroundPermissionRequestGate()
  var authorizationRequests = 0
  let pendingStart = Task {
    try await gate.waitForPermission(vehicleID: 7) { authorizationRequests += 1 }
  }
  await Task.yield()

  #expect(gate.cancel())
  let resolution = try await pendingStart.value
  #expect(gate.consume(resolution) == .cancelled)
  #expect(!gate.resolve(granted: true))
  #expect(!gate.isRequestPending)
  #expect(authorizationRequests == 1)
}

@MainActor
@Test("only a matching End cancels a pending permission start")
func permissionGateEndCancellationIsVehicleBound() async throws {
  let gate = ForegroundPermissionRequestGate()
  let pendingStart = Task {
    try await gate.waitForPermission(vehicleID: 7) {}
  }
  await Task.yield()

  #expect(!gate.cancel(vehicleID: 8))
  #expect(gate.isRequestPending)
  #expect(gate.cancel(vehicleID: 7))
  let resolution = try await pendingStart.value
  #expect(gate.consume(resolution) == .cancelled)
  #expect(!gate.resolve(granted: true))
}

@MainActor
@Test("grant then Stop in the same actor turn invalidates permission before consumption")
func permissionGateGrantThenStopCancelsUnconsumedCommand() async throws {
  let gate = ForegroundPermissionRequestGate()
  let pendingStart = Task {
    try await gate.waitForPermission(vehicleID: 7) {}
  }
  await Task.yield()

  #expect(gate.resolve(granted: true))
  #expect(gate.cancel())
  let resolution = try await pendingStart.value
  #expect(gate.consume(resolution) == .cancelled)
  #expect(!gate.isRequestPending)
}

@MainActor
@Test("grant then matching End invalidates permission before consumption")
func permissionGateGrantThenMatchingEndCancelsUnconsumedCommand() async throws {
  let gate = ForegroundPermissionRequestGate()
  let pendingStart = Task {
    try await gate.waitForPermission(vehicleID: 7) {}
  }
  await Task.yield()

  #expect(gate.resolve(granted: true))
  #expect(gate.cancel(vehicleID: 7))
  let resolution = try await pendingStart.value
  #expect(gate.consume(resolution) == .cancelled)
  #expect(!gate.isRequestPending)
}

@MainActor
@Test("grant retains command ownership until consumed and rejects an overlapping request")
func permissionGateRetainsGrantedCommandUntilConsumption() async throws {
  let gate = ForegroundPermissionRequestGate()
  let pendingStart = Task {
    try await gate.waitForPermission(vehicleID: 7) {}
  }
  await Task.yield()

  #expect(gate.resolve(granted: true))
  await #expect(throws: ForegroundPermissionRequestGateError.requestInProgress) {
    try await gate.waitForPermission(vehicleID: 8) {}
  }
  let resolution = try await pendingStart.value
  #expect(gate.consume(resolution) == .granted)
  let replacement = try gate.reserveGrantedPermission(vehicleID: 8)
  #expect(gate.consume(replacement) == .granted)
}

@MainActor
@Test("a cancelled command cannot apply failure cleanup to a replacement command")
func cancelledPermissionResultCannotAffectReplacementCommand() async throws {
  let gate = ForegroundPermissionRequestGate()
  let cancelledStart = Task {
    try await gate.waitForPermission(vehicleID: 7) {}
  }
  await Task.yield()
  #expect(gate.resolve(granted: true))
  #expect(gate.cancel(vehicleID: 7))

  let replacement = try gate.reserveGrantedPermission(vehicleID: 8)
  let staleResolution = try await cancelledStart.value
  #expect(gate.consume(staleResolution) == .cancelled)
  #expect(gate.consume(replacement) == .granted)
}
