import AppIntents
import Foundation

@available(iOS 16.0, *)
struct TrackingVehicle: AppEntity, Identifiable {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Vehicle")
  static let defaultQuery = TrackingVehicleQuery()

  let id: String
  let name: String
  let detail: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)", subtitle: "\(detail)")
  }
}

@available(iOS 16.0, *)
struct TrackingVehicleQuery: EntityQuery {
  func entities(for identifiers: [TrackingVehicle.ID]) async throws -> [TrackingVehicle] {
    let wanted = Set(identifiers)
    return try TrackingIntentStore.open().shortcutVehicles()
      .map(TrackingVehicle.init)
      .filter { wanted.contains($0.id) }
  }

  func suggestedEntities() async throws -> [TrackingVehicle] {
    try TrackingIntentStore.open().shortcutVehicles().map(TrackingVehicle.init)
  }
}

@available(iOS 16.0, *)
struct StartTripIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Trip"
  static let description = IntentDescription("Starts a trip for the selected vehicle.")
  static let openAppWhenRun = false

  @Parameter(title: "Vehicle") var vehicle: TrackingVehicle

  func perform() async throws -> some IntentResult {
    guard let vehicleId = Int64(vehicle.id) else { throw LocalStoreError.invalidVehicle }
    let store = try TrackingIntentStore.open()
    try store.startTracking(vehicleId: vehicleId, source: "automatic", now: TrackingIntentStore.now(), automaticSetupReady: true)
    return .result()
  }
}

@available(iOS 16.0, *)
struct EndTripIntent: AppIntent {
  static let title: LocalizedStringResource = "End Trip"
  static let description = IntentDescription("Ends the current automatic trip.")
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult {
    try TrackingIntentStore.open().stopTracking(now: TrackingIntentStore.now())
    return .result()
  }
}

private enum TrackingIntentStore {
  static func open() throws -> LocalStore {
    var directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("MaintenanceTracker", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try directory.setResourceValues(resourceValues)
    return try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
  }

  static func now() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }
}

@available(iOS 16.0, *)
private extension TrackingVehicle {
  init(_ vehicle: StoredVehicle) {
    id = String(vehicle.id)
    name = vehicle.nickname
    detail = "\(vehicle.year) \(vehicle.make) \(vehicle.model)"
  }
}
