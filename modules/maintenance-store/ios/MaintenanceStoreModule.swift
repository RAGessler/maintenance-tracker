import ExpoModulesCore

public class MaintenanceStoreModule: Module {
  private var store: LocalStore?
  private var openingError: LocalStoreError?

  public func definition() -> ModuleDefinition {
    Name("MaintenanceStore")

    AsyncFunction("getBootstrap") { () throws -> [String: Any] in
      let bootstrap = try self.localStore().bootstrap()
      return ["disclosureAccepted": bootstrap.disclosureAccepted, "disclosureVersion": bootstrap.disclosureVersion, "schemaVersion": bootstrap.schemaVersion]
    }

    AsyncFunction("getRecoveryState") { () -> [String: String] in
      do {
        _ = try self.localStore()
        return ["state": "ready"]
      } catch let error as LocalStoreError {
        switch error {
        case .unsupportedSchema:
          return ["state": "recovery_required", "reason": "unsupported_schema"]
        default:
          return ["state": "recovery_required", "reason": "opening_failed"]
        }
      } catch {
        return ["state": "recovery_required", "reason": "opening_failed"]
      }
    }

    AsyncFunction("acceptDisclosure") { (version: Int) throws -> [String: Any] in
      let bootstrap = try self.localStore().acceptDisclosure(version: version, now: Self.now())
      return ["disclosureAccepted": bootstrap.disclosureAccepted, "disclosureVersion": bootstrap.disclosureVersion, "schemaVersion": bootstrap.schemaVersion]
    }

    AsyncFunction("deleteAllData") { () throws -> [String: Any] in
      self.store?.close()
      self.store = nil
      self.openingError = nil
      let directory = try self.storeDirectory()
      if FileManager.default.fileExists(atPath: directory.path) {
        try FileManager.default.removeItem(at: directory)
      }
      let bootstrap = try self.localStore().bootstrap()
      return ["disclosureAccepted": bootstrap.disclosureAccepted, "disclosureVersion": bootstrap.disclosureVersion, "schemaVersion": bootstrap.schemaVersion]
    }

    AsyncFunction("getVehicles") { () throws -> [[String: Any]] in
      try self.localStore().vehicles().map {
        [
          "id": String($0.id),
          "nickname": $0.nickname,
          "year": $0.year,
          "make": $0.make,
          "model": $0.model,
          "currentOdometerMilliMiles": String($0.currentOdometerMilliMiles),
        ]
      }
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
    if let openingError { throw openingError }
    do {
      let directory = try storeDirectory()
      let store = try LocalStore(path: directory.appendingPathComponent("product.sqlite").path)
      try store.reconcilePhotoFiles(in: directory.appendingPathComponent("photos", isDirectory: true))
      self.store = store
      return store
    } catch let error as LocalStoreError {
      openingError = error
      throw error
    } catch {
      let openingError = LocalStoreError.sqlite("Unable to prepare the local store")
      self.openingError = openingError
      throw openingError
    }
  }

  private func storeDirectory() throws -> URL {
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
    return directory
  }

  private static func now() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }
}
