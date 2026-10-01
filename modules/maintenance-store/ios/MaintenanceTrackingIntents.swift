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
    let store = try TrackingIntentStore.open()
    return try identifiers.compactMap { identifier in
      guard let vehicle = try store.shortcutVehicle(identifier: identifier) else { return nil }
      return TrackingVehicle(vehicle, identifier: identifier)
    }
  }

  func suggestedEntities() async throws -> [TrackingVehicle] {
    let store = try TrackingIntentStore.open()
    return try store.shortcutVehicles().map { vehicle in
      TrackingVehicle(vehicle, identifier: try store.shortcutIdentifier(for: vehicle.id))
    }
  }
}

@available(iOS 16.0, *)
struct StartTripIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Trip"
  static let description = IntentDescription("Starts a trip for the selected vehicle.")
  static let openAppWhenRun = false

  @Parameter(title: "Vehicle") var vehicle: TrackingVehicle

  static var parameterSummary: some ParameterSummary { Summary("Start trip for \(\.$vehicle)") }

  func perform() async throws -> some IntentResult {
    guard let vehicleId = try TrackingIntentStore.open().shortcutVehicle(identifier: vehicle.id)?.id else { throw LocalStoreError.invalidVehicle }
    try await MainActor.run { try MaintenanceTrackingRuntime.shared.startAutomatic(vehicleID: vehicleId, now: TrackingIntentStore.now()) }
    return .result()
  }
}

@available(iOS 16.0, *)
struct EndTripIntent: AppIntent {
  static let title: LocalizedStringResource = "End Trip"
  static let description = IntentDescription("Ends the current automatic trip.")
  static let openAppWhenRun = false

  @Parameter(title: "Vehicle") var vehicle: TrackingVehicle

  static var parameterSummary: some ParameterSummary { Summary("End trip for \(\.$vehicle)") }

  func perform() async throws -> some IntentResult {
    guard let vehicleId = try TrackingIntentStore.open().shortcutVehicle(identifier: vehicle.id)?.id else { throw LocalStoreError.invalidVehicle }
    try await MainActor.run { try MaintenanceTrackingRuntime.shared.end(vehicleID: vehicleId, now: TrackingIntentStore.now()) }
    return .result()
  }
}

enum TrackingIntentStore {
  static func open() throws -> LocalStore {
    let directory = try storeDirectory()
    return try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
  }

  static func storeDirectory() throws -> URL {
    var directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("MaintenanceTracker", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var resourceValues = URLResourceValues(); resourceValues.isExcludedFromBackup = true
    try directory.setResourceValues(resourceValues)
    return directory
  }

  static func now() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }
}

@available(iOS 16.0, *)
private extension TrackingVehicle {
  init(_ vehicle: StoredVehicle, identifier: String) {
    id = identifier
    name = vehicle.nickname
    detail = "\(vehicle.year) \(vehicle.make) \(vehicle.model)"
  }
}
