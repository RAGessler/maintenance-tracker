import AppIntents
internal import IosTripTrigger

@available(iOS 16.0, *)
enum TripTriggerSource: String, AppEnum {
  case carplay
  case bluetooth

  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Trip trigger")
  static let caseDisplayRepresentations: [TripTriggerSource: DisplayRepresentation] = [
    .carplay: "CarPlay",
    .bluetooth: "Bluetooth stereo"
  ]
}

@available(iOS 16.0, *)
struct VehicleEntity: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Vehicle")
  static let defaultQuery = VehicleEntityQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }
}

@available(iOS 16.0, *)
struct VehicleEntityQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [VehicleEntity] {
    let vehicles = await MainActor.run { TripCoordinator.shared.availableVehicles() }
    return identifiers.map { identifier in
      guard let vehicle = vehicles.first(where: { $0.id == identifier }) else {
        return VehicleEntity(id: identifier, name: "Unavailable vehicle")
      }
      return VehicleEntity(id: vehicle.id, name: vehicle.name)
    }
  }

  func suggestedEntities() async throws -> [VehicleEntity] {
    await MainActor.run {
      TripCoordinator.shared.availableVehicles().map { VehicleEntity(id: $0.id, name: $0.name) }
    }
  }
}

@available(iOS 16.0, *)
struct StartTripIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Trip"
  static let description = IntentDescription("Starts a mileage candidate from a CarPlay or Bluetooth automation.")
  static let openAppWhenRun = false

  @Parameter(title: "Trigger", default: .carplay)
  var trigger: TripTriggerSource

  @Parameter(title: "Vehicle")
  var vehicle: VehicleEntity

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch TripCoordinator.shared.startTrip(source: trigger.rawValue, vehicleId: vehicle.id) {
    case "started":
      return .result(dialog: "Trip candidate started for \(vehicle.name)")
    case "always-location-required":
      return .result(dialog: "Open Maintenance Tracker and grant Always Location first")
    case "vehicle-unavailable":
      return .result(dialog: "That vehicle is no longer available. Choose another vehicle in this automation.")
    case "vehicle-route-mismatch":
      return .result(dialog: "The connected route belongs to a different vehicle. No trip was started.")
    case "vehicle-route-unrecognized":
      return .result(dialog: "The connected route is not recognized. No trip was started.")
    default:
      return .result(dialog: "A trip is already being tracked")
    }
  }
}

@available(iOS 16.0, *)
struct EndTripIntent: AppIntent {
  static let title: LocalizedStringResource = "End Trip"
  static let description = IntentDescription("Ends the active mileage trip.")
  static let openAppWhenRun = false

  @Parameter(title: "Vehicle")
  var vehicle: VehicleEntity

  @Parameter(title: "Trigger", default: .carplay)
  var trigger: TripTriggerSource

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch TripCoordinator.shared.endTrip(source: trigger.rawValue, vehicleId: vehicle.id) {
    case "ended":
      return .result(dialog: "Trip ended for \(vehicle.name)")
    case "vehicle-mismatch":
      return .result(dialog: "A different vehicle is being tracked. No trip was ended.")
    default:
      return .result(dialog: "There is no active trip to end")
    }
  }
}

@available(iOS 16.0, *)
struct TripAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: StartTripIntent(),
      phrases: ["Start a trip with \(.applicationName)"],
      shortTitle: "Start Trip",
      systemImageName: "car.fill"
    )
    AppShortcut(
      intent: EndTripIntent(),
      phrases: ["End my trip with \(.applicationName)"],
      shortTitle: "End Trip",
      systemImageName: "stop.circle.fill"
    )
  }
}
