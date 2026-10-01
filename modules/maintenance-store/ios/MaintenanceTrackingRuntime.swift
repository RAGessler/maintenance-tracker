import CoreLocation
import AVFAudio
import Foundation

@MainActor
final class MaintenanceTrackingRuntime: NSObject, @preconcurrency CLLocationManagerDelegate {
  static let shared = MaintenanceTrackingRuntime()

  private struct SessionIdentity: Equatable {
    let vehicleID: Int64
    let source: TrackingSource
    let startedAt: Int64

    init(_ session: TrackingSession) {
      vehicleID = session.vehicleID
      source = session.source
      startedAt = session.startedAt
    }
  }

  private let locationManager = CLLocationManager()
  private var firstAcceptedLocation: CLLocation?
  private var lastAcceptedLocation: CLLocation?
  private var lastAcceptedTimestamp: Int64?
  private var ownedSession: SessionIdentity?
  private var shouldRequestAlways = false
  private var deadlineTimer: Timer?
  private var routeObserver: NSObjectProtocol?
  private let foregroundPermissionGate = ForegroundPermissionRequestGate()

  private override init() {
    super.init()
    locationManager.delegate = self
    locationManager.activityType = .automotiveNavigation
    locationManager.pausesLocationUpdatesAutomatically = false
    routeObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: AVAudioSession.sharedInstance(), queue: .main) { [weak self] _ in
      Task { @MainActor in
        guard let self else { return }
        do {
          try self.observeAutomaticRoute(now: Self.now())
          try self.reconcileAfterCommand(now: Self.now())
        } catch { self.failClosed(.locationFailed, now: Self.now()) }
      }
    }
  }

  func locationPermissionStatus() -> String {
    switch locationManager.authorizationStatus {
    case .notDetermined: return "not_determined"
    case .authorizedWhenInUse: return "when_in_use"
    case .authorizedAlways:
      return locationManager.accuracyAuthorization == .fullAccuracy ? "always" : "always_reduced"
    case .denied: return "denied"
    case .restricted: return "restricted"
    @unknown default: return "unavailable"
    }
  }

  func requestLocationPermission() {
    switch locationManager.authorizationStatus {
    case .notDetermined:
      shouldRequestAlways = true
      locationManager.requestWhenInUseAuthorization()
    case .authorizedWhenInUse:
      shouldRequestAlways = false
      locationManager.requestAlwaysAuthorization()
    default:
      break
    }
  }

  func startAutomatic(vehicleID: Int64, now: Int64) throws {
    if try receiveSetupCommand(vehicleID: vehicleID, isStart: true, now: now) { return }
    do {
      try prepareForNewCommand(vehicleID: vehicleID, source: .automatic, now: now)
      guard hasPreciseAlwaysPermission else {
        failClosed(.locationPermissionLost, now: now)
        throw LocalStoreError.trackingPermissionRequired
      }

      let engine = try self.engine()
      try engine.startAutomatic(vehicleID: vehicleID, now: now)
      guard let session = try store().session() else { throw LocalStoreError.trackingConflict }
      adopt(session, preservingExistingAnchors: true)
      try observeAutomaticRoute(now: now)
      guard try store().session() != nil else { throw TrackingSetupFailure.routeMismatch }
      beginLocationCollection(for: session)
      scheduleDeadline(for: session, now: now)
    } catch let error as LocalStoreError where isNonDestructiveCommandRejection(error) {
      throw error
    } catch {
      failClosed(.locationFailed, now: Self.now())
      throw error
    }
  }

  func startManual(vehicleID: Int64, now: Int64) async throws {
    do {
      try validateStartTarget(vehicleID: vehicleID, source: .manual)
      let permissionResolution = try await requestForegroundPermission(vehicleID: vehicleID)
      switch foregroundPermissionGate.consume(permissionResolution) {
      case .granted:
        break
      case .denied:
        throw LocalStoreError.trackingPermissionRequired
      case .cancelled:
        throw LocalStoreError.trackingConflict
      }
      // Another command may have changed the active session while the system prompt was open.
      try validateStartTarget(vehicleID: vehicleID, source: .manual)
      let startedAt = Self.now()
      try prepareForNewCommand(vehicleID: vehicleID, source: .manual, now: startedAt)

      try store().startTracking(vehicleId: vehicleID, source: "manual", now: startedAt)
      guard let session = try store().session() else { throw LocalStoreError.trackingConflict }
      adopt(session, preservingExistingAnchors: true)
      beginLocationCollection(for: session)
      scheduleDeadline(for: session, now: startedAt)
    } catch let error as LocalStoreError where isNonDestructiveCommandRejection(error) {
      throw error
    } catch {
      failClosed(.locationFailed, now: Self.now())
      throw error
    }
  }

  func end(vehicleID: Int64, now: Int64) throws {
    if try receiveSetupCommand(vehicleID: vehicleID, isStart: false, now: now) { return }
    do {
      if let active = try store().session(), active.vehicleID != vehicleID {
        throw TrackingEngineError.wrongVehicle
      }
      foregroundPermissionGate.cancel(vehicleID: vehicleID)
      try finishFromForeground(targetVehicleID: vehicleID, now: now)
    } catch TrackingEngineError.wrongVehicle {
      throw TrackingEngineError.wrongVehicle
    } catch {
      failClosed(.locationFailed, now: now)
      throw error
    }
  }

  func stop(now: Int64) throws {
    do {
      foregroundPermissionGate.cancel()
      try finishFromForeground(targetVehicleID: nil, now: now)
    } catch {
      failClosed(.locationFailed, now: now)
      throw error
    }
  }

  func cancelPendingManualStartForSetupTest() {
    foregroundPermissionGate.cancel()
  }

  /// Foreground reconciliation is synchronous on MainActor so snapshots never race a detached resume.
  func resume(now: Int64) throws {
    do {
      guard let persistedSession = try store().session() else {
        resetTransientState()
        return
      }
      guard ownedSession == SessionIdentity(persistedSession) else {
        failClosed(.restorationFailed, now: now)
        return
      }
      guard permissionIsUsable(for: persistedSession.source) else {
        failClosed(.locationPermissionLost, now: now)
        return
      }
      try observeAutomaticRoute(now: now)
      try engine().tick(now: now)
      guard let session = try store().session() else {
        resetTransientState()
        return
      }
      guard ownedSession == SessionIdentity(session) else {
        failClosed(.restorationFailed, now: now)
        return
      }
      guard permissionIsUsable(for: session.source) else {
        failClosed(.locationPermissionLost, now: now)
        return
      }
      beginLocationCollection(for: session)
      scheduleDeadline(for: session, now: now)
    } catch {
      failClosed(.restorationFailed, now: now)
      throw error
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let now = Self.now()
    foregroundPermissionGate.resolve(granted: hasForegroundLocationPermission)
    do {
      try reconcileOwnedSession(now: now)
    } catch {
      failClosed(.locationFailed, now: now)
      return
    }
    if manager.authorizationStatus == .authorizedWhenInUse, shouldRequestAlways {
      shouldRequestAlways = false
      manager.requestAlwaysAuthorization()
      return
    }

    do {
      guard let session = try store().session() else { return }
      guard permissionIsUsable(for: session.source) else {
        failClosed(.locationPermissionLost, now: now)
        return
      }
      beginLocationCollection(for: session)
    } catch {
      failClosed(.locationFailed, now: now)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    let now = Self.now()
    do {
      try observeAutomaticRoute(now: now)
      try reconcileOwnedSession(now: now)
      guard let session = try store().session(), ownedSession == SessionIdentity(session) else { return }

      for location in locations {
        guard location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= 50,
              location.coordinate.latitude.isFinite,
              (-90...90).contains(location.coordinate.latitude),
              location.coordinate.longitude.isFinite,
              (-180...180).contains(location.coordinate.longitude),
              location.speed <= 55 else { continue }
        let timestampValue = location.timestamp.timeIntervalSince1970 * 1_000
        guard timestampValue.isFinite,
              timestampValue >= Double(Int64.min),
              timestampValue < Double(Int64.max) else { continue }
        let timestamp = Int64(timestampValue)
        switch TrackingRuntimePolicy.locationDecision(
          timestamp: timestamp,
          now: now,
          sessionStartedAt: session.startedAt,
          lastAcceptedTimestamp: lastAcceptedTimestamp
        ) {
        case .rejectStale:
          continue
        case .accept:
          let distanceMeters = lastAcceptedLocation.map { $0.distance(from: location) } ?? 0
          let displacement = firstAcceptedLocation.map { $0.distance(from: location) } ?? 0
          guard distanceMeters.isFinite, distanceMeters >= 0,
                displacement.isFinite, displacement >= 0 else { continue }
          let distance = metersToMilliMiles(distanceMeters)
          try engine().receive(location: TrackingLocation(
            timestamp: timestamp,
            speedMetersPerSecond: max(0, location.speed),
            displacementMeters: displacement,
            distanceMilliMiles: distance
          ), now: now)
          firstAcceptedLocation = firstAcceptedLocation ?? location
          lastAcceptedLocation = location
          lastAcceptedTimestamp = timestamp
          try reconcileAfterCommand(now: now)
          guard ownedSession != nil else { return }
        case .skipDistance:
          let displacement = firstAcceptedLocation.map { $0.distance(from: location) } ?? 0
          guard displacement.isFinite, displacement >= 0 else { continue }
          try engine().receive(location: TrackingLocation(
            timestamp: timestamp,
            speedMetersPerSecond: max(0, location.speed),
            displacementMeters: displacement,
            distanceMilliMiles: 0
          ), now: now)
          // Re-anchor without adding straight-line mileage across the observation gap.
          firstAcceptedLocation = firstAcceptedLocation ?? location
          lastAcceptedLocation = location
          lastAcceptedTimestamp = timestamp
          try reconcileAfterCommand(now: now)
          guard ownedSession != nil else { return }
        }
      }
    } catch {
      failClosed(.locationFailed, now: now)
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let now = Self.now()
    failClosed(.locationFailed, now: now)
  }

  private var hasPreciseAlwaysPermission: Bool {
    locationManager.authorizationStatus == .authorizedAlways && locationManager.accuracyAuthorization == .fullAccuracy
  }

  private var hasForegroundLocationPermission: Bool {
    TrackingRuntimePolicy.manualPermissionDecision(for: currentLocationAuthorization) == .allowed
  }

  private func requestForegroundPermission(vehicleID: Int64) async throws -> ForegroundPermissionRequestGate.Resolution {
    switch TrackingRuntimePolicy.manualPermissionDecision(for: currentLocationAuthorization) {
    case .allowed:
      do {
        return try foregroundPermissionGate.reserveGrantedPermission(vehicleID: vehicleID)
      } catch ForegroundPermissionRequestGateError.requestInProgress {
        throw LocalStoreError.trackingConflict
      }
    case .denied:
      throw LocalStoreError.trackingPermissionRequired
    case .requestWhenInUse:
      do {
        return try await foregroundPermissionGate.waitForPermission(vehicleID: vehicleID) { [weak self] in
          self?.locationManager.requestWhenInUseAuthorization()
        }
      } catch ForegroundPermissionRequestGateError.requestInProgress {
        throw LocalStoreError.trackingConflict
      }
    }
  }

  private var currentLocationAuthorization: TrackingRuntimePolicy.LocationAuthorization {
    switch locationManager.authorizationStatus {
    case .notDetermined: return .notDetermined
    case .authorizedWhenInUse: return .whenInUse
    case .authorizedAlways:
      return locationManager.accuracyAuthorization == .fullAccuracy ? .alwaysPrecise : .alwaysReduced
    case .denied: return .denied
    case .restricted: return .restricted
    @unknown default: return .unavailable
    }
  }

  private func validateStartTarget(vehicleID: Int64, source: TrackingSource) throws {
    let repository = try store()
    try repository.withTrackingTransition {
      guard try repository.shortcutVehicles().contains(where: { $0.id == vehicleID }) else {
        throw LocalStoreError.invalidVehicle
      }
      if let active = try repository.session() {
        guard active.vehicleID == vehicleID, active.source == source else { throw LocalStoreError.trackingConflict }
      }
    }
  }

  private func finishFromForeground(targetVehicleID: Int64?, now: Int64) throws {
    let repository = try store()
    try repository.withTrackingTransition {
      guard let persisted = try repository.session() else {
        resetTransientState()
        return
      }
      if let targetVehicleID, targetVehicleID != persisted.vehicleID {
        throw TrackingEngineError.wrongVehicle
      }

      let engine = TrackingEngine(repository: repository)
      let identity = SessionIdentity(persisted)
      guard ownedSession == identity else {
        try engine.restorationFailed(now: now)
        resetTransientState()
        guard try repository.session() == nil else { throw LocalStoreError.trackingConflict }
        return
      }
      guard permissionIsUsable(for: persisted.source) else {
        try engine.permissionLost(now: now)
        resetTransientState()
        guard try repository.session() == nil else { throw LocalStoreError.trackingConflict }
        return
      }

      try observeAutomaticRoute(now: now)
      try engine.end(vehicleID: persisted.vehicleID, now: now)
      guard try repository.session() == nil else {
        throw LocalStoreError.trackingConflict
      }
      resetTransientState()
    }
  }

  private func permissionIsUsable(for source: TrackingSource) -> Bool {
    source == .automatic ? hasPreciseAlwaysPermission : hasForegroundLocationPermission
  }

  private func prepareForNewCommand(vehicleID: Int64, source: TrackingSource, now: Int64) throws {
    let repository = try store()
    var restorationAttempted = false
    var permissionRejected = false
    var failureOnError: TrackingFailure = .locationFailed
    do {
      try repository.withTrackingTransition {
        guard try repository.shortcutVehicles().contains(where: { $0.id == vehicleID }) else {
          throw LocalStoreError.invalidVehicle
        }
        if let session = try repository.session() {
          // Reject attribution/source conflicts before any restoration, deadline or permission action.
          guard session.vehicleID == vehicleID, session.source == source else { throw LocalStoreError.trackingConflict }
          let engine = TrackingEngine(repository: repository)
          guard ownedSession == SessionIdentity(session) else {
            restorationAttempted = true
            failureOnError = .restorationFailed
            try engine.restorationFailed(now: now)
            resetTransientState()
            guard try repository.session() == nil else { throw LocalStoreError.trackingConflict }
            return
          }
          guard permissionIsUsable(for: session.source) else {
            failureOnError = .locationPermissionLost
            try engine.permissionLost(now: now)
            resetTransientState()
            permissionRejected = true
            return
          }
          try engine.tick(now: now)
          guard let afterTick = try repository.session() else {
            resetTransientState()
            return
          }
          guard ownedSession == SessionIdentity(afterTick) else {
            restorationAttempted = true
            failureOnError = .restorationFailed
            try engine.restorationFailed(now: now)
            resetTransientState()
            guard try repository.session() == nil else { throw LocalStoreError.trackingConflict }
            return
          }
          guard permissionIsUsable(for: afterTick.source) else {
            failureOnError = .locationPermissionLost
            try engine.permissionLost(now: now)
            resetTransientState()
            permissionRejected = true
            return
          }
          scheduleDeadline(for: afterTick, now: now)
        } else {
          resetTransientState()
        }
      }
      if permissionRejected { throw LocalStoreError.trackingPermissionRequired }
    } catch {
      if let error = error as? LocalStoreError {
        switch error {
        case .invalidVehicle, .trackingSetupIncomplete, .trackingPermissionRequired:
          throw error
        case .trackingConflict where !restorationAttempted:
          throw error
        default:
          break
        }
      }
      failClosed(failureOnError, now: now)
      throw error
    }
  }

  private func isNonDestructiveCommandRejection(_ error: LocalStoreError) -> Bool {
    switch error {
    case .invalidVehicle, .trackingConflict, .trackingSetupIncomplete, .trackingPermissionRequired:
      return true
    default:
      return false
    }
  }

  private func reconcileOwnedSession(now: Int64) throws {
    guard let beforeTick = try store().session() else {
      resetTransientState()
      return
    }
    guard ownedSession == SessionIdentity(beforeTick) else {
      failClosed(.restorationFailed, now: now)
      return
    }
    guard permissionIsUsable(for: beforeTick.source) else {
      failClosed(.locationPermissionLost, now: now)
      return
    }
    try engine().tick(now: now)
    guard let session = try store().session() else {
      resetTransientState()
      return
    }
    guard ownedSession == SessionIdentity(session) else {
      failClosed(.restorationFailed, now: now)
      return
    }
    scheduleDeadline(for: session, now: now)
  }

  private func reconcileAfterCommand(now: Int64) throws {
    guard let session = try store().session() else {
      resetTransientState()
      return
    }
    guard ownedSession == SessionIdentity(session) else {
      failClosed(.restorationFailed, now: now)
      return
    }
    scheduleDeadline(for: session, now: now)
  }

  private func adopt(_ session: TrackingSession, preservingExistingAnchors: Bool) {
    let identity = SessionIdentity(session)
    guard ownedSession != identity else { return }
    ownedSession = identity
    if !preservingExistingAnchors || firstAcceptedLocation == nil {
      firstAcceptedLocation = nil
      lastAcceptedLocation = nil
      lastAcceptedTimestamp = nil
    }
  }

  private func beginLocationCollection(for session: TrackingSession) {
    locationManager.allowsBackgroundLocationUpdates = session.source == .automatic && hasPreciseAlwaysPermission
    locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    locationManager.distanceFilter = 25
    locationManager.startUpdatingLocation()
  }

  private func scheduleDeadline(for session: TrackingSession, now: Int64) {
    deadlineTimer?.invalidate()
    let nextDeadline = [session.movementDeadline, session.reconnectDeadline, session.maximumDurationDeadline]
      .compactMap { $0 }
      .min()
    guard let nextDeadline else { return }
    let delay = max(0.05, (Double(nextDeadline) - Double(now)) / 1_000)
    let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
      Task { @MainActor in
        guard let self else { return }
        self.deadlineTimer = nil
         do {
           try self.observeAutomaticRoute(now: Self.now())
           try self.reconcileOwnedSession(now: Self.now())
          try self.reconcileAfterCommand(now: Self.now())
        } catch {
          self.failClosed(.locationFailed, now: Self.now())
        }
      }
    }
    deadlineTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func failClosed(_ failure: TrackingFailure, now: Int64) {
    defer { resetTransientState() }
    do {
      let engine = try self.engine()
      switch failure {
      case .locationPermissionLost: try engine.permissionLost(now: now)
      case .restorationFailed: try engine.restorationFailed(now: now)
      default: try engine.locationFailed(now: now)
      }
    } catch {
      // Keep teardown unconditional if storage or finalization is unavailable.
    }
  }

  private func resetTransientState() {
    deadlineTimer?.invalidate()
    deadlineTimer = nil
    locationManager.stopUpdatingLocation()
    firstAcceptedLocation = nil
    lastAcceptedLocation = nil
    lastAcceptedTimestamp = nil
    ownedSession = nil
  }

  private func engine() throws -> TrackingEngine { TrackingEngine(repository: try store()) }

  private func observeAutomaticRoute(now: Int64) throws {
    let repository = try store()
    try repository.withTrackingTransition {
      guard let session = try repository.session(), session.source == .automatic,
            ownedSession == SessionIdentity(session) else { return }
      let engine = TrackingEngine(repository: repository)
      guard permissionIsUsable(for: session.source) else {
        try engine.permissionLost(now: now)
        resetTransientState()
        return
      }
      if let route = try MaintenanceAudioRoute.current() {
        try engine.receive(route: repository.routeEvidence(for: session.vehicleID, kind: route.kind, opaqueValue: route.opaqueValue), now: now)
      } else if session.routeEvidence == .matching && session.state != .recovering {
        try engine.routeLost(now: now, carPlayActive: false)
      }
      if try repository.session() == nil { resetTransientState() }
    }
  }

  private func receiveSetupCommand(vehicleID: Int64, isStart: Bool, now: Int64) throws -> Bool {
    // A setup test is native-owned and persists across React Native/process absence.
    // It intercepts the saved actions before normal trip creation or completion.
    let result = try store().receiveSetupCommand(vehicleID: vehicleID, isStart: isStart,
      route: try MaintenanceAudioRoute.current(), locationReady: hasPreciseAlwaysPermission, now: now)
    switch result {
    case .notTesting: return false
    case .handled: return true
    case .rejected(let failure): throw failure
    }
  }

  private func store() throws -> LocalStore {
    let directory = try TrackingIntentStore.storeDirectory()
    return try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
  }

  static func now() -> Int64 { Int64(Date().timeIntervalSince1970 * 1_000) }
}
