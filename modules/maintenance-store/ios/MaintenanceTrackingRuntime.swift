import AVFAudio
import CoreLocation
import Foundation

@MainActor
final class MaintenanceTrackingRuntime: NSObject, @preconcurrency CLLocationManagerDelegate {
  static let shared = MaintenanceTrackingRuntime()

  private let locationManager = CLLocationManager()
  private var routeObserver: NSObjectProtocol?
  private var firstAcceptedLocation: CLLocation?
  private var lastAcceptedLocation: CLLocation?

  private override init() {
    super.init()
    locationManager.delegate = self
    locationManager.activityType = .automotiveNavigation
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.pausesLocationUpdatesAutomatically = false
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] _ in Task { @MainActor in self?.handleRouteChange() } }
  }

  deinit { if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) } }

  func startAutomatic(vehicleID: Int64, now: Int64) throws {
    guard locationManager.authorizationStatus == .authorizedAlways,
          locationManager.accuracyAuthorization == .fullAccuracy else { throw LocalStoreError.trackingConflict }
    let engine = try self.engine()
    try engine.startAutomatic(vehicleID: vehicleID, now: now)
    firstAcceptedLocation = nil
    lastAcceptedLocation = nil
    locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    locationManager.distanceFilter = 25
    locationManager.startUpdatingLocation()
    handleRouteChange()
  }

  func end(vehicleID: Int64, now: Int64) throws {
    try engine().end(vehicleID: vehicleID, now: now)
    stopLocationUpdatesIfIdle()
  }

  func resume(now: Int64) {
    do {
      let engine = try engine()
      try engine.tick(now: now)
      guard try store().session() != nil else { return }
      guard locationManager.authorizationStatus == .authorizedAlways,
            locationManager.accuracyAuthorization == .fullAccuracy else {
        try engine.permissionLost(now: now)
        return
      }
      locationManager.startUpdatingLocation()
      handleRouteChange()
    } catch {
      try? engine().restorationFailed(now: now)
      stopLocationUpdatesIfIdle()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard manager.authorizationStatus != .authorizedAlways || manager.accuracyAuthorization != .fullAccuracy else { return }
    try? engine().permissionLost(now: Self.now())
    stopLocationUpdatesIfIdle()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    for location in locations where accepted(location) {
      do {
        let distance = lastAcceptedLocation.map { Int64(($0.distance(from: location) / 1_609.344 * 1_000_000).rounded()) } ?? 0
        let displacement = firstAcceptedLocation.map { $0.distance(from: location) } ?? 0
        try engine().receive(location: TrackingLocation(timestamp: Int64(location.timestamp.timeIntervalSince1970 * 1_000), speedMetersPerSecond: max(0, location.speed), displacementMeters: displacement, distanceMilliMiles: distance), now: Self.now())
        if firstAcceptedLocation == nil { firstAcceptedLocation = location }
        lastAcceptedLocation = location
      } catch {
        try? engine().locationFailed(now: Self.now())
        stopLocationUpdatesIfIdle()
      }
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    try? engine().locationFailed(now: Self.now())
    stopLocationUpdatesIfIdle()
  }

  private func handleRouteChange() {
    do {
      let store = try store()
      guard let session = try store.session(), session.source == .automatic else { return }
      let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
      let vehicleRoutes = outputs.filter { $0.portType == .carAudio || $0.portType == .bluetoothA2DP || $0.portType == .bluetoothHFP || $0.portType == .bluetoothLE }
      if vehicleRoutes.isEmpty {
        try engine().routeLost(now: Self.now(), carPlayActive: false)
      } else if let route = vehicleRoutes.first {
        let kind = route.portType == .carAudio ? "carplay_route" : "bluetooth_route"
        let evidence = try store.routeEvidence(for: session.vehicleID, kind: kind, opaqueValue: route.uid)
        if evidence == .unknown && route.portType == .carAudio && session.routeEvidence == .matching {
          // A wireless Bluetooth disconnect while CarPlay remains active is a handoff, never an end.
          return
        }
        try engine().receive(route: evidence, now: Self.now())
      }
      stopLocationUpdatesIfIdle()
    } catch {
      try? engine().restorationFailed(now: Self.now())
      stopLocationUpdatesIfIdle()
    }
  }

  private func accepted(_ location: CLLocation) -> Bool {
    abs(location.timestamp.timeIntervalSinceNow) <= 30 && location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= 50 && location.speed <= 55
  }

  private func stopLocationUpdatesIfIdle() {
    guard (try? store().session()) == nil else { return }
    locationManager.stopUpdatingLocation()
    firstAcceptedLocation = nil
    lastAcceptedLocation = nil
  }

  private func engine() throws -> TrackingEngine { TrackingEngine(repository: try store()) }

  private func store() throws -> LocalStore {
    let directory = try TrackingIntentStore.storeDirectory()
    return try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
  }

  static func now() -> Int64 { Int64(Date().timeIntervalSince1970 * 1_000) }
}
