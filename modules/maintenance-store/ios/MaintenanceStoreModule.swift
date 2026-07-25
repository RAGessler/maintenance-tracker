import ExpoModulesCore

public class MaintenanceStoreModule: Module {
  private var store: LocalStore?

  public func definition() -> ModuleDefinition {
    Name("MaintenanceStore")

    AsyncFunction("getBootstrap") { () throws -> [String: Any] in
      let bootstrap = try self.localStore().bootstrap()
      return ["disclosureAccepted": bootstrap.disclosureAccepted, "schemaVersion": bootstrap.schemaVersion]
    }

    AsyncFunction("acceptDisclosure") { (version: Int) throws -> [String: Any] in
      let bootstrap = try self.localStore().acceptDisclosure(version: version, now: Self.now())
      return ["disclosureAccepted": bootstrap.disclosureAccepted, "schemaVersion": bootstrap.schemaVersion]
    }

    AsyncFunction("createVehicle") {
      (nickname: String, year: Int, make: String, model: String, initialOdometerMilliMiles: String) throws -> [String: Any] in
      guard !initialOdometerMilliMiles.isEmpty,
            initialOdometerMilliMiles.allSatisfy(\.isNumber),
            let milliMiles = Int64(initialOdometerMilliMiles),
            milliMiles >= 0 else {
        throw LocalStoreError.invalidVehicle
      }
      let vehicle = try self.localStore().createVehicle(
        nickname: nickname,
        year: year,
        make: make,
        model: model,
        initialOdometerMilliMiles: milliMiles,
        now: Self.now()
      )
      return ["id": String(vehicle.id), "nickname": vehicle.nickname, "year": vehicle.year, "make": vehicle.make, "model": vehicle.model]
    }

    AsyncFunction("getTrackingSnapshot") { () throws -> [String: String] in
      ["state": try self.localStore().trackingState()]
    }

    AsyncFunction("startTracking") { (vehicleId: String, source: String) throws -> [String: String] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      try self.localStore().startTracking(vehicleId: nativeVehicleId, source: source, now: Self.now())
      return ["state": try self.localStore().trackingState()]
    }

    AsyncFunction("stopTracking") { () throws -> [String: String] in
      try self.localStore().stopTracking()
      return ["state": "idle"]
    }
  }

  private func localStore() throws -> LocalStore {
    if let store { return store }
    var directory = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("MaintenanceTracker", isDirectory: true)
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
    )
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try directory.setResourceValues(resourceValues)
    let store = try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
    self.store = store
    return store
  }

  private static func now() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }
}
