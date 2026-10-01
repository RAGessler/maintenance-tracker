import AVFAudio
import Foundation

struct SetupMutationResult: Sendable {
  let setup: StoredTrackingSetup
  var failure: TrackingSetupFailure?
  var conflictingVehicle: StoredVehicle?
  var confirmationToken: String?
}

/// Reads the route actually used for audio. It never activates a session, scans devices, or emits a trigger.
enum MaintenanceAudioRoute {
  @MainActor static func current() throws -> TrackingRoute? {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    let routes = try outputs.compactMap { port -> TrackingRoute? in
      let kind: String
      switch port.portType {
      case .carAudio: kind = "carplay_route"
      case .bluetoothA2DP, .bluetoothHFP, .bluetoothLE: kind = "bluetooth_route"
      default: return nil
      }
      return try TrackingRoute(kind: kind, opaqueValue: port.uid)
    }
    guard routes.count <= 1 else { throw TrackingSetupFailure.routeUnavailable }
    return routes.first
  }
}

@MainActor
final class MaintenanceSetupRuntime {
  static let shared = MaintenanceSetupRuntime()

  private struct Confirmation {
    let token: String
    let vehicleID: Int64
    let setupID: Int64?
    let ownerID: Int64
    let route: TrackingRoute?
    let transport: SetupTransport?
    let issuedAt: Int64
  }
  private var confirmation: Confirmation?

  func snapshot(vehicleID: Int64) throws -> StoredTrackingSetup {
    try store().trackingSetup(for: vehicleID, locationReady: locationReady, now: MaintenanceTrackingRuntime.now())
  }

  func save(vehicleID: Int64, transport: SetupTransport, setupID: Int64?, shortcutsReady: Bool,
    automationsReady: Bool, checklistConfirmed: Bool, confirmationToken: String?) throws -> SetupMutationResult {
    let repository = try store()
    let now = MaintenanceTrackingRuntime.now()
    let previous = confirmation
    confirmation = nil
    return try perform(vehicleID: vehicleID, repository: repository) {
      var owner: Int64?
      if let confirmationToken {
        guard let previous, previous.token == confirmationToken, previous.vehicleID == vehicleID,
              previous.setupID == setupID, previous.transport == transport, valid(previous, now: now) else { throw TrackingSetupFailure.changed }
        owner = previous.ownerID
      }
      do {
        _ = try repository.saveTrackingSetup(for: vehicleID, transport: transport, expectedSetupID: setupID,
          shortcutsReady: shortcutsReady, automationsReady: automationsReady, checklistConfirmed: checklistConfirmed,
          replacingWiredVehicleID: owner, now: now)
      } catch TrackingSetupFailure.wiredAssignment(let ownerID) {
        confirmation = Confirmation(token: UUID().uuidString, vehicleID: vehicleID, setupID: setupID, ownerID: ownerID,
          route: nil, transport: transport, issuedAt: now)
        throw TrackingSetupFailure.wiredAssignment(ownerID)
      }
    }
  }

  func bind(vehicleID: Int64, setupID: Int64, confirmationToken: String?) throws -> SetupMutationResult {
    let repository = try store()
    let now = MaintenanceTrackingRuntime.now()
    let previous = confirmation
    confirmation = nil
    return try perform(vehicleID: vehicleID, repository: repository) {
      guard let route = try MaintenanceAudioRoute.current() else { throw TrackingSetupFailure.routeUnavailable }
      var owner: Int64?
      if let confirmationToken {
        guard let previous, previous.token == confirmationToken, previous.vehicleID == vehicleID,
              previous.setupID == setupID, previous.route == route, valid(previous, now: now) else { throw TrackingSetupFailure.changed }
        owner = previous.ownerID
      }
      do {
        try repository.bindSetupRoute(for: vehicleID, setupID: setupID, route: route, replacingVehicleID: owner, now: now)
      } catch TrackingSetupFailure.routeAssignment(let ownerID) {
        confirmation = Confirmation(token: UUID().uuidString, vehicleID: vehicleID, setupID: setupID, ownerID: ownerID,
          route: route, transport: nil, issuedAt: now)
        throw TrackingSetupFailure.routeAssignment(ownerID)
      }
    }
  }

  func armTest(vehicleID: Int64, setupID: Int64) throws -> SetupMutationResult {
    let repository = try store()
    confirmation = nil
    return try perform(vehicleID: vehicleID, repository: repository) {
      try repository.armSetupTest(for: vehicleID, setupID: setupID, locationReady: locationReady, now: MaintenanceTrackingRuntime.now())
      MaintenanceTrackingRuntime.shared.cancelPendingManualStartForSetupTest()
    }
  }

  func cancelTest(vehicleID: Int64, setupID: Int64) throws -> SetupMutationResult {
    let repository = try store()
    confirmation = nil
    return try perform(vehicleID: vehicleID, repository: repository) {
      try repository.cancelSetupTest(for: vehicleID, setupID: setupID)
    }
  }

  func remove(vehicleID: Int64, setupID: Int64) throws -> SetupMutationResult {
    let repository = try store()
    confirmation = nil
    return try perform(vehicleID: vehicleID, repository: repository) {
      try repository.removeTrackingSetup(for: vehicleID, setupID: setupID)
    }
  }

  private func perform(vehicleID: Int64, repository: LocalStore, operation: () throws -> Void) throws -> SetupMutationResult {
    var failure: TrackingSetupFailure?
    do { try operation() } catch let reason as TrackingSetupFailure { failure = reason }
    var result = SetupMutationResult(setup: try repository.trackingSetup(for: vehicleID, locationReady: locationReady, now: MaintenanceTrackingRuntime.now()), failure: failure)
    if let pending = confirmation {
      result.conflictingVehicle = try repository.shortcutVehicles().first { $0.id == pending.ownerID }
      result.confirmationToken = pending.token
    }
    return result
  }

  private var locationReady: Bool { MaintenanceTrackingRuntime.shared.locationPermissionStatus() == "always" }
  private func valid(_ confirmation: Confirmation, now: Int64) -> Bool {
    now >= confirmation.issuedAt && now - confirmation.issuedAt < 120_000
  }
  private func store() throws -> LocalStore { try TrackingIntentStore.open() }
}
