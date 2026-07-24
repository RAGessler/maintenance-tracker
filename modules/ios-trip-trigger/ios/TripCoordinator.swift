import AVFAudio
import CoreLocation
import Foundation

public struct VehicleChoice: Sendable {
  public let id: String
  public let name: String

  public static let all = VehicleFingerprint.all.map {
    VehicleChoice(id: $0.id, name: $0.name)
  }
}

@MainActor
public final class TripCoordinator: NSObject, CLLocationManagerDelegate {
  public static let shared = TripCoordinator()

  private let eventStore = EventStore.shared
  private let locationManager = CLLocationManager()
  private let isoFormatter = ISO8601DateFormatter()
  private var routeObserver: NSObjectProtocol?
  private var deadlineTask: Task<Void, Never>?
  private var firstCandidateLocation: CLLocation?
  private var selectedRouteName: String?
  private var selectedRouteUID: String?
  private var selectedVehicleId: String?
  private var selectedVehicleName: String?

  var onEvent: ((StoredEvent) -> Void)?

  private override init() {
    super.init()
    locationManager.delegate = self
    locationManager.activityType = .automotiveNavigation
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.showsBackgroundLocationIndicator = true
    selectedRouteName = eventStore.runtime(key: "selected_route_name")
    selectedRouteUID = eventStore.runtime(key: "selected_route_uid")
    selectedVehicleId = eventStore.runtime(key: "selected_vehicle_id")
    selectedVehicleName = eventStore.runtime(key: "selected_vehicle_name")
    observeAudioRoutes()
    resumeTrackingIfNeeded()
  }

  deinit {
    if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) }
  }

  public func requestPermissions() {
    emit(source: "location", name: "permission-requested")
    switch locationManager.authorizationStatus {
    case .notDetermined:
      locationManager.requestWhenInUseAuthorization()
    case .authorizedWhenInUse:
      locationManager.requestAlwaysAuthorization()
    default:
      break
    }
  }

  @discardableResult
  public func startTrip(source: String, vehicleId: String? = nil, eventId: String = UUID().uuidString) -> String {
    let currentState = state
    if currentState != "idle" && currentState != "completed" && currentState != "failed" {
      emit(source: source, name: "start-ignored-already-tracking", payload: ["state": currentState], eventId: eventId)
      return "already-tracking"
    }

    let requestedVehicle = vehicleId.flatMap { id in
      VehicleChoice.all.contains(where: { $0.id == id }) ? VehicleFingerprint.identified(by: id) : nil
    }
    if vehicleId != nil && requestedVehicle == nil {
      emit(source: source, name: "start-rejected-vehicle-unavailable", payload: ["vehicleId": vehicleId!], eventId: eventId)
      return "vehicle-unavailable"
    }

    let newTripId = UUID().uuidString
    eventStore.setRuntime(key: "trip_id", value: newTripId)
    eventStore.setRuntime(key: "trigger_source", value: source)
    eventStore.setRuntime(key: "failure_reason", value: nil)
    eventStore.setRuntime(key: "requested_vehicle_id", value: requestedVehicle?.id)
    eventStore.setRuntime(key: "requested_vehicle_name", value: requestedVehicle?.name)
    eventStore.beginTrip(id: newTripId, source: source)
    eventStore.setTripVehicle(id: newTripId, vehicleName: requestedVehicle?.name)
    eventStore.setRuntime(key: "candidate_deadline", value: isoFormatter.string(from: Date().addingTimeInterval(600)))
    if source != "manual" {
      eventStore.setRuntime(key: "route_capture_deadline", value: isoFormatter.string(from: Date().addingTimeInterval(60)))
    }
    transition(to: "start-candidate", source: source, eventId: eventId)
    firstCandidateLocation = nil
    captureSelectedRoute()
    if state == "failed" {
      return eventStore.runtime(key: "failure_reason") ?? "failed"
    }

    guard locationManager.authorizationStatus == .authorizedAlways else {
      transition(to: "failed", source: "location", payload: ["reason": "always-location-required"])
      clearDeadlines()
      return "always-location-required"
    }

    locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    locationManager.distanceFilter = 25
    locationManager.startUpdatingLocation()
    transition(to: "awaiting-movement", source: source)
    scheduleNextDeadline()
    return "started"
  }

  @discardableResult
  public func endTrip(source: String, vehicleId: String? = nil, eventId: String = UUID().uuidString) -> String {
    guard ["start-candidate", "awaiting-movement", "active", "reconnect-grace-period"].contains(state) else {
      emit(source: source, name: "end-ignored-no-active-trip", eventId: eventId)
      return "no-active-trip"
    }
    if let vehicleId, vehicleId != eventStore.runtime(key: "requested_vehicle_id") {
      emit(source: source, name: "end-rejected-vehicle-mismatch", payload: [
        "activeVehicleId": eventStore.runtime(key: "requested_vehicle_id") ?? "none",
        "requestedVehicleId": vehicleId
      ], eventId: eventId)
      return "vehicle-mismatch"
    }
    if source == "bluetooth" && AVAudioSession.sharedInstance().currentRoute.outputs.contains(where: { $0.portType == .carAudio }) {
      emit(source: source, name: "end-deferred-carplay-active", payload: [
        "state": state,
        "vehicleId": vehicleId ?? "none"
      ], eventId: eventId)
      return "carplay-active"
    }
    locationManager.stopUpdatingLocation()
    clearDeadlines()
    transition(to: "completed", source: source, eventId: eventId)
    return "ended"
  }

  public func configureCurrentRoute(vehicleId: String? = nil) -> Bool {
    let carPortTypes: Set<AVAudioSession.Port> = [.carAudio, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE]
    guard let port = AVAudioSession.sharedInstance().currentRoute.outputs.first(where: { carPortTypes.contains($0.portType) }) else {
      emit(source: "user", name: "car-route-configuration-failed", payload: ["reason": "no-car-route"])
      return false
    }
    if let vehicleId {
      guard let vehicle = VehicleFingerprint.identified(by: vehicleId) else {
        emit(source: "user", name: "car-route-configuration-failed", payload: ["reason": "vehicle-unavailable"])
        return false
      }
      let identity = routeIdentity(port)
      for otherVehicle in VehicleFingerprint.all where otherVehicle.id != vehicle.id {
        if eventStore.runtime(key: "vehicle_route_uid_\(otherVehicle.id)") == identity {
          eventStore.setRuntime(key: "vehicle_route_uid_\(otherVehicle.id)", value: nil)
          eventStore.setRuntime(key: "vehicle_route_type_\(otherVehicle.id)", value: nil)
        }
      }
      eventStore.setRuntime(key: "vehicle_route_uid_\(vehicle.id)", value: identity)
      eventStore.setRuntime(key: "vehicle_route_type_\(vehicle.id)", value: port.portType.rawValue)
      emit(source: "user", name: "vehicle-route-configured", payload: [
        "type": port.portType.rawValue,
        "vehicleId": vehicle.id
      ])
    }
    eventStore.setRuntime(key: "configured_route_uid", value: port.uid)
    eventStore.setRuntime(key: "configured_route_name", value: port.portName)
    eventStore.setRuntime(key: "configured_route_type", value: port.portType.rawValue)
    emit(source: "user", name: "car-route-configured", payload: ["name": port.portName, "type": port.portType.rawValue])
    return true
  }

  public func availableVehicles() -> [VehicleChoice] {
    VehicleChoice.all
  }

  public func deleteAllData() {
    locationManager.stopUpdatingLocation()
    deadlineTask?.cancel()
    selectedRouteName = nil
    selectedRouteUID = nil
    selectedVehicleId = nil
    selectedVehicleName = nil
    eventStore.clearAll()
  }

  public func status() -> [String: Any?] {
    [
      "state": state,
      "locationAuthorization": authorizationDescription,
      "currentRoute": currentRouteDictionaries(),
      "selectedRouteName": selectedRouteName,
      "requestedVehicleName": eventStore.runtime(key: "requested_vehicle_name"),
      "selectedVehicleName": selectedVehicleName,
      "currentVehicleName": currentVehicle?.name,
      "configuredRouteName": eventStore.runtime(key: "configured_route_name"),
      "tripId": tripId,
      "graceDeadline": eventStore.runtime(key: "grace_deadline"),
      "databaseUri": eventStore.databaseURL.absoluteString
    ]
  }

  public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    emit(source: "location", name: "authorization-changed", payload: ["authorization": authorizationDescription])
    if manager.authorizationStatus == .authorizedWhenInUse {
      manager.requestAlwaysAuthorization()
    }
  }

  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    for location in locations {
      process(location)
    }
  }

  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    emit(source: "location", name: "location-error", payload: ["message": error.localizedDescription])
  }

  private var state: String { eventStore.runtime(key: "state") ?? "idle" }
  private var tripId: String? { eventStore.runtime(key: "trip_id") }

  private var authorizationDescription: String {
    switch locationManager.authorizationStatus {
    case .notDetermined: return "not-determined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "when-in-use"
    @unknown default: return "unknown"
    }
  }

  private func process(_ location: CLLocation) {
    evaluateDeadlines()
    guard ["awaiting-movement", "active", "reconnect-grace-period"].contains(state) else { return }
    let age = abs(location.timestamp.timeIntervalSinceNow)
    let rejectionReason: String?
    if age > 30 {
      rejectionReason = "stale"
    } else if location.horizontalAccuracy < 0 || location.horizontalAccuracy > 50 {
      rejectionReason = "poor-accuracy"
    } else if location.speed > 55 {
      rejectionReason = "implausible-speed"
    } else {
      rejectionReason = nil
    }
    eventStore.appendLocation(location, tripId: tripId, accepted: rejectionReason == nil, reason: rejectionReason)

    if let rejectionReason {
      emit(source: "location", name: "sample-rejected", payload: ["reason": rejectionReason, "accuracy": location.horizontalAccuracy])
      return
    }

    emit(source: "location", name: "sample-accepted", payload: [
      "accuracy": location.horizontalAccuracy,
      "speed": location.speed
    ])

    if state == "awaiting-movement" {
      if firstCandidateLocation == nil { firstCandidateLocation = location }
      let displacement = firstCandidateLocation?.distance(from: location) ?? 0
      if location.speed >= 3 || displacement >= 100 {
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 10
        eventStore.setRuntime(key: "candidate_deadline", value: nil)
        eventStore.setRuntime(key: "route_capture_deadline", value: nil)
        transition(to: "active", source: "location", payload: ["displacement": displacement, "speed": location.speed])
        scheduleNextDeadline()
      }
    }
  }

  private func observeAudioRoutes() {
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      Task { @MainActor in self?.handleRouteChange(notification) }
    }
  }

  private func handleRouteChange(_ notification: Notification) {
    let oldRoute = notification.userInfo?[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription
    let oldPorts = oldRoute?.outputs.map(portDictionary) ?? []
    let newPorts = currentRouteDictionaries()
    emit(source: "audio-route", name: "route-changed", payload: ["old": oldPorts, "new": newPorts])

    if selectedRouteName == nil && ["awaiting-movement", "active"].contains(state) {
      captureSelectedRoute()
    }

    guard ["awaiting-movement", "active", "reconnect-grace-period"].contains(state),
          let selectedRouteName else { return }
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    let selectedVehicle = VehicleFingerprint.named(selectedVehicleName)
    let routeIsPresent = selectedVehicle.map { fingerprint in
      outputs.contains { matchingVehicle($0)?.id == fingerprint.id }
    } ?? outputs.contains { $0.uid == selectedRouteUID }
    if routeIsPresent {
      if state == "reconnect-grace-period" {
        eventStore.setRuntime(key: "grace_deadline", value: nil)
        let restoredState = eventStore.runtime(key: "pre_route_loss_state") ?? "active"
        transition(to: restoredState, source: "audio-route", payload: ["route": selectedRouteName])
        scheduleNextDeadline()
      }
    } else if state != "reconnect-grace-period" {
      let deadline = Date().addingTimeInterval(180)
      eventStore.setRuntime(key: "pre_route_loss_state", value: state)
      eventStore.setRuntime(key: "grace_deadline", value: isoFormatter.string(from: deadline))
      transition(to: "reconnect-grace-period", source: "audio-route", payload: ["missingRoute": selectedRouteName])
      scheduleNextDeadline()
    }
  }

  private func captureSelectedRoute() {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    let source = eventStore.runtime(key: "trigger_source") ?? "manual"
    let configuredUID = eventStore.runtime(key: "configured_route_uid")
    let port: AVAudioSessionPortDescription?
    if source == "carplay" {
      port = outputs.first { $0.portType == .carAudio }
    } else if source == "bluetooth" {
      port = outputs.first { matchingVehicle($0)?.isCarPlay == false }
        ?? outputs.first { $0.uid == configuredUID }
        ?? outputs.first { matchingVehicle($0)?.isCarPlay == true }
    } else {
      port = outputs.first { $0.uid == configuredUID } ?? outputs.first { $0.portType == .carAudio }
    }
    selectedRouteName = port?.portName
    selectedRouteUID = port?.uid
    let matchedVehicle = port.flatMap(matchingVehicle)
    selectedVehicleId = matchedVehicle?.id
    selectedVehicleName = matchedVehicle?.name
    eventStore.setRuntime(key: "selected_route_name", value: selectedRouteName)
    eventStore.setRuntime(key: "selected_route_uid", value: selectedRouteUID)
    eventStore.setRuntime(key: "selected_vehicle_id", value: selectedVehicleId)
    eventStore.setRuntime(key: "selected_vehicle_name", value: selectedVehicleName)
    let requestedVehicleId = eventStore.runtime(key: "requested_vehicle_id")
    if let requestedVehicleId, port != nil {
      guard let matchedVehicle else {
        failTrip(reason: "vehicle-route-unrecognized")
        return
      }
      guard requestedVehicleId == matchedVehicle.id else {
        emit(source: "audio-route", name: "vehicle-route-mismatch", payload: [
          "requestedVehicleId": requestedVehicleId,
          "observedVehicleId": matchedVehicle.id
        ])
        failTrip(reason: "vehicle-route-mismatch")
        return
      }
    }
    if requestedVehicleId == nil {
      eventStore.setTripVehicle(id: tripId, vehicleName: selectedVehicleName)
    }
    if port != nil {
      eventStore.setRuntime(key: "route_capture_deadline", value: nil)
    }
    emit(source: "audio-route", name: "route-selected", payload: ["route": selectedRouteName ?? "none", "vehicle": selectedVehicleName ?? "unknown"])
    scheduleNextDeadline()
  }

  private func currentRouteDictionaries() -> [[String: String]] {
    AVAudioSession.sharedInstance().currentRoute.outputs.map(portDictionary)
  }

  private func portDictionary(_ port: AVAudioSessionPortDescription) -> [String: String] {
    ["name": port.portName, "type": port.portType.rawValue, "uid": port.uid, "vehicle": matchingVehicle(port)?.name ?? "unknown"]
  }

  private var currentVehicle: VehicleFingerprint? {
    AVAudioSession.sharedInstance().currentRoute.outputs.compactMap(matchingVehicle).first
  }

  private func matchingVehicle(_ port: AVAudioSessionPortDescription) -> VehicleFingerprint? {
    let identity = routeIdentity(port)
    return VehicleFingerprint.all.first {
      eventStore.runtime(key: "vehicle_route_uid_\($0.id)") == identity
    } ?? VehicleFingerprint.matching(port)
  }

  private func routeIdentity(_ port: AVAudioSessionPortDescription) -> String {
    port.portType == .carAudio ? VehicleFingerprint.normalizedCarPlayUID(port.uid) : port.uid
  }

  private func transition(to newState: String, source: String, payload: [String: Any] = [:], eventId: String = UUID().uuidString) {
    let oldState = state
    eventStore.setRuntime(key: "state", value: newState)
    eventStore.updateTrip(id: tripId, state: newState, ended: newState == "completed" || newState == "failed")
    emit(source: source, name: "state-transition", payload: payload.merging(["from": oldState, "to": newState]) { current, _ in current }, eventId: eventId)
  }

  private func resumeTrackingIfNeeded() {
    evaluateDeadlines()
    guard ["awaiting-movement", "active", "reconnect-grace-period"].contains(state),
          locationManager.authorizationStatus == .authorizedAlways else { return }
    locationManager.desiredAccuracy = state == "awaiting-movement"
      ? kCLLocationAccuracyHundredMeters
      : kCLLocationAccuracyBestForNavigation
    locationManager.distanceFilter = state == "awaiting-movement" ? 25 : 10
    locationManager.startUpdatingLocation()
    emit(source: "restoration", name: "location-tracking-restored", payload: ["state": state])
    scheduleNextDeadline()
  }

  private func evaluateDeadlines() {
    let now = Date()
    if deadlineHasExpired("grace_deadline", now: now) {
      endTrip(source: "route-grace-expired")
    } else if selectedRouteUID == nil && deadlineHasExpired("route_capture_deadline", now: now) {
      failTrip(reason: "car-route-not-captured")
    } else if state == "awaiting-movement" && deadlineHasExpired("candidate_deadline", now: now) {
      failTrip(reason: "movement-not-confirmed")
    }
  }

  private func deadlineHasExpired(_ key: String, now: Date) -> Bool {
    guard let raw = eventStore.runtime(key: key), let deadline = isoFormatter.date(from: raw) else { return false }
    return deadline <= now
  }

  private func scheduleNextDeadline() {
    deadlineTask?.cancel()
    let dates = ["grace_deadline", "route_capture_deadline", "candidate_deadline"].compactMap {
      eventStore.runtime(key: $0).flatMap(isoFormatter.date(from:))
    }
    guard let next = dates.min() else { return }
    let delay = max(0, next.timeIntervalSinceNow)
    deadlineTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
      guard !Task.isCancelled else { return }
      self?.evaluateDeadlines()
    }
  }

  private func failTrip(reason: String) {
    locationManager.stopUpdatingLocation()
    clearDeadlines()
    eventStore.setRuntime(key: "failure_reason", value: reason)
    transition(to: "failed", source: "state-machine", payload: ["reason": reason])
  }

  private func clearDeadlines() {
    deadlineTask?.cancel()
    for key in ["grace_deadline", "route_capture_deadline", "candidate_deadline", "pre_route_loss_state"] {
      eventStore.setRuntime(key: key, value: nil)
    }
  }

  private func emit(source: String, name: String, payload: [String: Any] = [:], eventId: String = UUID().uuidString) {
    if let event = eventStore.append(source: source, name: name, tripId: tripId, payload: payload, eventId: eventId) {
      onEvent?(event)
    }
  }
}
