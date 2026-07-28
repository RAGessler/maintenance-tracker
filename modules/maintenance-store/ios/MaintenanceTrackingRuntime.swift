import CoreLocation
import Foundation

@MainActor
final class MaintenanceTrackingRuntime: NSObject, @preconcurrency CLLocationManagerDelegate {
  static let shared = MaintenanceTrackingRuntime()

  private let locationManager = CLLocationManager()
  private var firstAcceptedLocation: CLLocation?
  private var lastAcceptedLocation: CLLocation?
  private var shouldRequestAlways = false

  private override init() {
    super.init()
    locationManager.delegate = self
    locationManager.activityType = .automotiveNavigation
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.pausesLocationUpdatesAutomatically = false
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
    guard locationManager.authorizationStatus == .authorizedAlways,
          locationManager.accuracyAuthorization == .fullAccuracy else { throw LocalStoreError.trackingPermissionRequired }
    let engine = try self.engine()
    try engine.startAutomatic(vehicleID: vehicleID, now: now)
    firstAcceptedLocation = nil
    lastAcceptedLocation = nil
    locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    locationManager.distanceFilter = 25
    locationManager.startUpdatingLocation()
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
    } catch {
      try? engine().restorationFailed(now: now)
      stopLocationUpdatesIfIdle()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    if manager.authorizationStatus == .authorizedWhenInUse, shouldRequestAlways {
      shouldRequestAlways = false
      manager.requestAlwaysAuthorization()
      return
    }
    guard manager.authorizationStatus != .authorizedAlways || manager.accuracyAuthorization != .fullAccuracy else { return }
    try? engine().permissionLost(now: Self.now())
    stopLocationUpdatesIfIdle()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    for location in locations where accepted(location) {
      do {
        let distance = lastAcceptedLocation.map { metersToMilliMiles($0.distance(from: location)) } ?? 0
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
