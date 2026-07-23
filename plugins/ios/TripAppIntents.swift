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
struct StartTripIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Trip"
  static let description = IntentDescription("Starts a mileage candidate from a CarPlay or Bluetooth automation.")
  static let openAppWhenRun = false

  @Parameter(title: "Trigger", default: .carplay)
  var trigger: TripTriggerSource

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch TripCoordinator.shared.startTrip(source: trigger.rawValue) {
    case "started":
      return .result(dialog: "Trip candidate started")
    case "always-location-required":
      return .result(dialog: "Open Maintenance Tracker and grant Always Location first")
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

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if TripCoordinator.shared.endTrip(source: "carplay") == "ended" {
      return .result(dialog: "Trip ended")
    }
    return .result(dialog: "There is no active trip to end")
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
