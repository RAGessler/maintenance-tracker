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
    return identifiers.map { identifier in
      guard let vehicle = VehicleChoice.all.first(where: { $0.id == identifier }) else {
        return VehicleEntity(id: identifier, name: "Unavailable vehicle")
      }
      return VehicleEntity(id: vehicle.id, name: vehicle.name)
    }
  }

  func suggestedEntities() async throws -> [VehicleEntity] {
    VehicleChoice.all.map { VehicleEntity(id: $0.id, name: $0.name) }
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

  static var parameterSummary: some ParameterSummary {
    Summary("Start trip for \(\.$vehicle) using \(\.$trigger)")
  }

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

  static var parameterSummary: some ParameterSummary {
    Summary("End trip for \(\.$vehicle) using \(\.$trigger)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch TripCoordinator.shared.endTrip(source: trigger.rawValue, vehicleId: vehicle.id) {
    case "ended":
      return .result(dialog: "Trip ended for \(vehicle.name)")
    case "vehicle-mismatch":
      return .result(dialog: "A different vehicle is being tracked. No trip was ended.")
    case "carplay-active":
      return .result(dialog: "CarPlay is still active. Trip completion was deferred.")
    default:
      return .result(dialog: "There is no active trip to end")
    }
  }
}

@available(iOS 16.0, *)
struct ConfigureVehicleRouteIntent: AppIntent {
  static let title: LocalizedStringResource = "Configure Vehicle Route"
  static let description = IntentDescription("Binds the currently connected car audio route to a vehicle.")
  static let openAppWhenRun = false

  @Parameter(title: "Vehicle")
  var vehicle: VehicleEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Configure current route for \(\.$vehicle)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if TripCoordinator.shared.configureCurrentRoute(vehicleId: vehicle.id) {
      return .result(dialog: "Current route configured for \(vehicle.name)")
    }
    return .result(dialog: "Connect the vehicle audio route and try again")
  }
}

@available(iOS 16.0, *)
struct TripAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: StartTripIntent(),
      phrases: ["Start \(\.$vehicle) trip with \(.applicationName)"],
      shortTitle: "Start Trip",
      systemImageName: "car.fill"
    )
    AppShortcut(
      intent: EndTripIntent(),
      phrases: ["End \(\.$vehicle) trip with \(.applicationName)"],
      shortTitle: "End Trip",
      systemImageName: "stop.circle.fill"
    )
    AppShortcut(
      intent: ConfigureVehicleRouteIntent(),
      phrases: ["Configure \(\.$vehicle) route with \(.applicationName)"],
      shortTitle: "Configure Vehicle",
      systemImageName: "car.badge.gearshape"
    )
  }
}
