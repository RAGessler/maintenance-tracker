import ExpoModulesCore
import ImageIO
import UIKit

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
      let store = try self.localStore()
      let photosDirectory = try self.photoDirectory()
      for filename in try store.heroPhotoFilenames() {
        guard !filename.contains("/"), !filename.contains("\\") else { continue }
        let photoURL = photosDirectory.appendingPathComponent(filename, isDirectory: false)
        if FileManager.default.fileExists(atPath: photoURL.path) {
          try FileManager.default.removeItem(at: photoURL)
        }
      }
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
      try self.localStore().vehicles(archived: false).map { try self.vehicleDictionary($0) }
    }

    AsyncFunction("getArchivedVehicles") { () throws -> [[String: Any]] in
      try self.localStore().vehicles(archived: true).map { try self.vehicleDictionary($0) }
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

    AsyncFunction("updateVehicle") {
      (vehicleId: String, nickname: String, year: Int, make: String, model: String) throws -> [String: Any] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      let vehicle = try self.localStore().updateVehicle(
        id: nativeVehicleId, nickname: nickname, year: year, make: make, model: model, now: Self.now()
      )
      return ["id": String(vehicle.id), "nickname": vehicle.nickname, "year": vehicle.year, "make": vehicle.make, "model": vehicle.model]
    }

    AsyncFunction("archiveVehicle") { (vehicleId: String) throws -> Void in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      try self.localStore().archiveVehicle(id: nativeVehicleId, now: Self.now())
    }

    AsyncFunction("restoreVehicle") { (vehicleId: String) throws -> Void in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      try self.localStore().restoreVehicle(id: nativeVehicleId, now: Self.now())
    }

    AsyncFunction("replaceHeroPhoto") { (vehicleId: String, sourceUri: String) throws -> Void in
      guard let nativeVehicleId = Int64(vehicleId),
            let sourceURL = URL(string: sourceUri),
            sourceURL.isFileURL else {
        throw LocalStoreError.invalidPhoto
      }
      let jpegData = try Self.normalizedHeroPhoto(from: sourceURL)
      try self.localStore().replaceHeroPhoto(
        for: nativeVehicleId,
        jpegData: jpegData,
        in: try self.photoDirectory(),
        now: Self.now()
      )
    }

    AsyncFunction("removeHeroPhoto") { (vehicleId: String) throws -> Void in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      try self.localStore().removeHeroPhoto(for: nativeVehicleId, in: try self.photoDirectory())
    }

    AsyncFunction("getManualOdometerReadings") { (vehicleId: String) throws -> [[String: Any]] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      return try self.localStore().manualOdometerReadings(for: nativeVehicleId).map {
        Self.manualOdometerReadingDictionary($0, vehicleId: nativeVehicleId)
      }
    }

    AsyncFunction("appendManualOdometerReading") { (vehicleId: String, milliMiles: String, effectiveAt: String) throws -> [String: Any] in
      guard let nativeVehicleId = Int64(vehicleId),
            let nativeMilliMiles = Int64(milliMiles), nativeMilliMiles >= 0,
            let nativeEffectiveAt = Int64(effectiveAt) else {
        throw LocalStoreError.invalidVehicle
      }
      let reading = try self.localStore().appendManualOdometerReading(
        vehicleId: nativeVehicleId, milliMiles: nativeMilliMiles, effectiveAt: nativeEffectiveAt, now: Self.now()
      )
      return Self.manualOdometerReadingDictionary(reading, vehicleId: nativeVehicleId)
    }

    AsyncFunction("getOdometerFacts") { (vehicleId: String) throws -> [String: Any] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidVehicle }
      let store = try self.localStore()
      return [
        "readings": try store.manualOdometerReadings(for: nativeVehicleId).map { Self.manualOdometerReadingDictionary($0, vehicleId: nativeVehicleId) },
        "trips": try store.confirmedTripDistances(for: nativeVehicleId).map { ["endedAt": String($0.endedAt), "effectiveMilliMiles": String($0.effectiveMilliMiles)] },
      ]
    }

    AsyncFunction("getMaintenanceRecords") { (vehicleId: String) throws -> [[String: Any]] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidMaintenanceRecord }
      return try self.localStore().maintenanceRecords(for: nativeVehicleId).map(Self.maintenanceRecordDictionary)
    }

    AsyncFunction("createMaintenanceRecord") { (vehicleId: String, serviceName: String, completedOn: String, milliMiles: String, note: String?) throws -> [String: Any] in
      guard let nativeVehicleId = Int64(vehicleId), let nativeMilliMiles = Int64(milliMiles), nativeMilliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceRecord }
      return try Self.maintenanceRecordDictionary(self.localStore().createMaintenanceRecord(vehicleId: nativeVehicleId, serviceName: serviceName, completedOn: completedOn, milliMiles: nativeMilliMiles, note: note, now: Self.now()))
    }

    AsyncFunction("updateMaintenanceRecord") { (recordId: String, vehicleId: String, serviceName: String, completedOn: String, milliMiles: String, note: String?) throws -> [String: Any] in
      guard let nativeRecordId = Int64(recordId), let nativeVehicleId = Int64(vehicleId), let nativeMilliMiles = Int64(milliMiles), nativeMilliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceRecord }
      return try Self.maintenanceRecordDictionary(self.localStore().updateMaintenanceRecord(id: nativeRecordId, vehicleId: nativeVehicleId, serviceName: serviceName, completedOn: completedOn, milliMiles: nativeMilliMiles, note: note, now: Self.now()))
    }

    AsyncFunction("deleteMaintenanceRecord") { (recordId: String) throws -> Void in
      guard let nativeRecordId = Int64(recordId) else { throw LocalStoreError.invalidMaintenanceRecord }
      try self.localStore().deleteMaintenanceRecord(id: nativeRecordId)
    }

    AsyncFunction("getMaintenanceSchedules") { (vehicleId: String) throws -> [[String: Any]] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidMaintenanceSchedule }
      return try self.localStore().maintenanceSchedules(for: nativeVehicleId).map(Self.maintenanceScheduleDictionary)
    }

    AsyncFunction("createMaintenanceSchedule") { (vehicleId: String, serviceName: String, sourceTemplateKey: String?, sourceTemplateVersion: Int?, mileageIntervalMilliMiles: String?, dayInterval: Int?, baselineDate: String, baselineMilliMiles: String) throws -> [String: Any] in
      guard let nativeVehicleId = Int64(vehicleId), let nativeBaselineMilliMiles = Int64(baselineMilliMiles), nativeBaselineMilliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceSchedule }
      let nativeInterval = try Self.optionalMilliMiles(mileageIntervalMilliMiles)
      return try Self.maintenanceScheduleDictionary(self.localStore().createMaintenanceSchedule(vehicleId: nativeVehicleId, serviceName: serviceName, sourceTemplateKey: sourceTemplateKey, sourceTemplateVersion: sourceTemplateVersion, mileageIntervalMilliMiles: nativeInterval, dayInterval: dayInterval, baselineDate: baselineDate, baselineMilliMiles: nativeBaselineMilliMiles, now: Self.now()))
    }

    AsyncFunction("updateMaintenanceSchedule") { (scheduleId: String, serviceName: String, mileageIntervalMilliMiles: String?, dayInterval: Int?, baselineDate: String, baselineMilliMiles: String) throws -> [String: Any] in
      guard let nativeScheduleId = Int64(scheduleId), let nativeBaselineMilliMiles = Int64(baselineMilliMiles), nativeBaselineMilliMiles >= 0 else { throw LocalStoreError.invalidMaintenanceSchedule }
      let nativeInterval = try Self.optionalMilliMiles(mileageIntervalMilliMiles)
      return try Self.maintenanceScheduleDictionary(self.localStore().updateMaintenanceSchedule(id: nativeScheduleId, serviceName: serviceName, mileageIntervalMilliMiles: nativeInterval, dayInterval: dayInterval, baselineDate: baselineDate, baselineMilliMiles: nativeBaselineMilliMiles, now: Self.now()))
    }

    AsyncFunction("deleteMaintenanceSchedule") { (scheduleId: String) throws -> Void in
      guard let nativeScheduleId = Int64(scheduleId) else { throw LocalStoreError.invalidMaintenanceSchedule }
      try self.localStore().deleteMaintenanceSchedule(id: nativeScheduleId)
    }

    AsyncFunction("completeMaintenanceSchedule") { (scheduleId: String, completedOn: String, milliMiles: String, note: String?) throws -> [String: Any] in
      guard let nativeScheduleId = Int64(scheduleId), let nativeMilliMiles = Int64(milliMiles), nativeMilliMiles >= 0 else {
        throw LocalStoreError.invalidMaintenanceRecord
      }
      return try Self.maintenanceRecordDictionary(self.localStore().completeMaintenanceSchedule(
        id: nativeScheduleId, completedOn: completedOn, milliMiles: nativeMilliMiles, note: note, now: Self.now()
      ))
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
      try self.localStore().stopTracking(now: Self.now())
      return ["state": "idle"]
    }

    AsyncFunction("getTrips") { (vehicleId: String) throws -> [[String: Any]] in
      guard let nativeVehicleId = Int64(vehicleId) else { throw LocalStoreError.invalidTrip }
      return try self.localStore().trips(for: nativeVehicleId).map(Self.tripDictionary)
    }

    AsyncFunction("reviewTrip") { (tripId: String, action: String, effectiveMilliMiles: String?, vehicleId: String?) throws -> [String: Any] in
      guard let nativeTripId = Int64(tripId) else { throw LocalStoreError.invalidTrip }
      let nativeMileage = try Self.optionalMilliMiles(effectiveMilliMiles)
      let nativeVehicleId = vehicleId.flatMap(Int64.init)
      return Self.tripDictionary(try self.localStore().reviewTrip(id: nativeTripId, action: action, effectiveMilliMiles: nativeMileage, vehicleId: nativeVehicleId, now: Self.now()))
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

  private func photoDirectory() throws -> URL {
    let directory = try storeDirectory().appendingPathComponent("photos", isDirectory: true)
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.complete]
    )
    return directory
  }

  private static func now() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }

  private static func normalizedHeroPhoto(from sourceURL: URL) throws -> Data {
    let sourceData = try Data(contentsOf: sourceURL, options: .mappedIfSafe)
    let allowedTypes = ["public.heic", "public.heif", "public.jpeg", "public.png"]
    guard sourceData.count <= 10_000_000,
          let imageSource = CGImageSourceCreateWithData(sourceData as CFData, nil),
          let sourceType = CGImageSourceGetType(imageSource) as String?,
          allowedTypes.contains(sourceType),
          let image = UIImage(data: sourceData) else {
      throw LocalStoreError.invalidPhoto
    }

    var maxDimension: CGFloat = 2_048
    var quality: CGFloat = 0.82
    for _ in 0..<12 {
      let scale = min(1, maxDimension / max(image.size.width, image.size.height))
      let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
      guard size.width >= 32, size.height >= 32 else { break }
      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      let data = UIGraphicsImageRenderer(size: size, format: format).jpegData(withCompressionQuality: quality) { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
      }
      if data.count <= 2_000_000 { return data }
      maxDimension *= 0.8
      quality *= 0.9
    }
    throw LocalStoreError.invalidPhoto
  }

  private func vehicleDictionary(_ vehicle: StoredGarageVehicle) throws -> [String: Any] {
    let filename = try localStore().heroPhotoFilename(for: vehicle.id)
    let photoURI: String?
    if let filename,
       !filename.contains("/"),
       !filename.contains("\\") {
      let url = try photoDirectory().appendingPathComponent(filename, isDirectory: false)
      photoURI = FileManager.default.fileExists(atPath: url.path) ? url.absoluteString : nil
    } else {
      photoURI = nil
    }
    return [
      "id": String(vehicle.id),
      "nickname": vehicle.nickname,
      "year": vehicle.year,
      "make": vehicle.make,
      "model": vehicle.model,
      "currentOdometerMilliMiles": String(vehicle.currentOdometerMilliMiles),
      "scheduleCount": vehicle.scheduleCount,
      "trackingReadiness": vehicle.trackingReadiness,
      "heroPhotoUri": photoURI as Any,
    ]
  }

  private static func maintenanceRecordDictionary(_ record: StoredMaintenanceRecord) -> [String: Any] {
    var result: [String: Any] = [
      "id": String(record.id), "vehicleId": String(record.vehicleId), "serviceName": record.serviceName,
      "completedOn": record.completedOn, "milliMiles": String(record.milliMiles),
    ]
    if let scheduleId = record.scheduleId { result["scheduleId"] = String(scheduleId) }
    if let note = record.note { result["note"] = note }
    return result
  }

  private static func manualOdometerReadingDictionary(_ reading: ManualOdometerReading, vehicleId: Int64) -> [String: Any] {
    [
      "id": String(reading.id), "vehicleId": String(vehicleId), "milliMiles": String(reading.milliMiles),
      "effectiveAt": String(reading.effectiveAt),
    ]
  }

  private static func optionalMilliMiles(_ value: String?) throws -> Int64? {
    guard let value, !value.isEmpty else { return nil }
    guard let milliMiles = Int64(value), milliMiles > 0 else { throw LocalStoreError.invalidMaintenanceSchedule }
    return milliMiles
  }

  private static func tripDictionary(_ trip: StoredTrip) -> [String: Any] {
    var result: [String: Any] = [
      "id": String(trip.id), "startedAt": String(trip.startedAt), "endedAt": String(trip.endedAt),
      "disposition": trip.disposition,
    ]
    if let vehicleId = trip.vehicleId { result["vehicleId"] = String(vehicleId) }
    if let capturedMilliMiles = trip.capturedMilliMiles { result["capturedMilliMiles"] = String(capturedMilliMiles) }
    if let effectiveMilliMiles = trip.effectiveMilliMiles { result["effectiveMilliMiles"] = String(effectiveMilliMiles) }
    if let failureReason = trip.failureReason { result["failureReason"] = failureReason }
    return result
  }

  private static func maintenanceScheduleDictionary(_ schedule: StoredMaintenanceSchedule) -> [String: Any] {
    var result: [String: Any] = [
      "id": String(schedule.id), "vehicleId": String(schedule.vehicleId), "serviceName": schedule.serviceName,
      "baselineDate": schedule.baselineDate, "baselineMilliMiles": String(schedule.baselineMilliMiles),
      "initialBaselineDate": schedule.initialBaselineDate, "initialBaselineMilliMiles": String(schedule.initialBaselineMilliMiles),
    ]
    if let key = schedule.sourceTemplateKey { result["sourceTemplateKey"] = key }
    if let version = schedule.sourceTemplateVersion { result["sourceTemplateVersion"] = version }
    if let interval = schedule.mileageIntervalMilliMiles { result["mileageIntervalMilliMiles"] = String(interval) }
    if let interval = schedule.dayInterval { result["dayInterval"] = interval }
    return result
  }
}
