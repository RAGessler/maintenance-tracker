import ExpoModulesCore

public final class IosTripTriggerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("IosTripTrigger")
    Events("onEvent")

    OnStartObserving {
      Task { @MainActor in
        TripCoordinator.shared.onEvent = { [weak self] event in
          self?.sendEvent("onEvent", event.dictionary)
        }
      }
    }

    OnStopObserving {
      Task { @MainActor in TripCoordinator.shared.onEvent = nil }
    }

    AsyncFunction("getStatus") {
      await MainActor.run { TripCoordinator.shared.status() }
    }

    AsyncFunction("getEvents") { (limit: Int) in
      EventStore.shared.events(limit: limit).map(\.dictionary)
    }

    AsyncFunction("getTripSummaries") { (limit: Int) in
      EventStore.shared.tripSummaries(limit: limit).map(\.dictionary)
    }

    AsyncFunction("requestLocationPermissions") {
      await MainActor.run {
        TripCoordinator.shared.requestPermissions()
        return TripCoordinator.shared.status()
      }
    }

    AsyncFunction("configureCurrentRoute") {
      await MainActor.run {
        _ = TripCoordinator.shared.configureCurrentRoute()
        return TripCoordinator.shared.status()
      }
    }

    AsyncFunction("deleteAllData") {
      await MainActor.run {
        TripCoordinator.shared.deleteAllData()
        return TripCoordinator.shared.status()
      }
    }

    AsyncFunction("startTrip") { (source: String) in
      await MainActor.run {
        TripCoordinator.shared.startTrip(source: source)
        return TripCoordinator.shared.status()
      }
    }

    AsyncFunction("endTrip") { (source: String) in
      await MainActor.run {
        TripCoordinator.shared.endTrip(source: source)
        return TripCoordinator.shared.status()
      }
    }
  }
}
