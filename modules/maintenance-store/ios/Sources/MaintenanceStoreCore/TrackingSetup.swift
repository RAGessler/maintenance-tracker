import Foundation

public enum SetupTransport: String, Sendable, CaseIterable {
  case bluetooth
  case wirelessCarPlay = "wireless_carplay"
  case wiredCarPlay = "wired_carplay"

  var mode: String { self == .wiredCarPlay ? "wired_carplay_shortcut" : "bluetooth_shortcut" }
  var routeKind: String { self == .bluetooth ? "bluetooth_route" : "carplay_route" }
}

/// Native-only evidence. Never serialize the opaque value to React Native or logs.
public struct TrackingRoute: Sendable, Equatable {
  public let kind: String
  public let opaqueValue: String

  public init(kind: String, opaqueValue: String) throws {
    guard ["bluetooth_route", "carplay_route"].contains(kind),
          !opaqueValue.isEmpty, opaqueValue.utf8.count <= 1024 else {
      throw TrackingSetupFailure.routeUnavailable
    }
    self.kind = kind
    if kind == "carplay_route", let suffix = opaqueValue.range(of: "-Audio-AudioMain-") {
      self.opaqueValue = String(opaqueValue[..<suffix.upperBound].dropLast())
    } else {
      self.opaqueValue = opaqueValue
    }
  }
}

public enum TrackingSetupFailure: Error, Sendable, Equatable, LocalizedError {
  case changed, busy, routeUnavailable, wrongTransport, permissionRequired, checklistIncomplete
  case wiredAssignment(Int64), routeAssignment(Int64)
  case wrongVehicle, endBeforeStart, expired, routeMismatch

  public var code: String {
    switch self {
    case .changed: return "setup_changed"
    case .busy: return "trip_active"
    case .routeUnavailable: return "route_unavailable"
    case .wrongTransport: return "wrong_transport"
    case .permissionRequired: return "permission_required"
    case .checklistIncomplete: return "checklist_incomplete"
    case .wiredAssignment: return "wired_assignment"
    case .routeAssignment: return "route_assignment"
    case .wrongVehicle: return "wrong_vehicle"
    case .endBeforeStart: return "end_before_start"
    case .expired: return "test_expired"
    case .routeMismatch: return "route_mismatch"
    }
  }

  public var errorDescription: String? {
    switch self {
    case .changed: return "Setup changed. Refresh this vehicle and try again."
    case .busy: return "Stop the active trip or cancel the other setup test before changing setup."
    case .routeUnavailable: return "Connect to the selected car and play audio through its stereo, then try again. Built-in speaker, wired headphones, and AirPlay cannot complete this setup."
    case .wrongTransport: return "The observed connection does not match the selected transport. Check the car connection and try again."
    case .permissionRequired: return "Allow Precise Location and Always location access, then run setup again."
    case .checklistIncomplete: return "Complete the Shortcut, automations, checklist confirmation, and route binding before running the test."
    case .wiredAssignment: return "Wired CarPlay is assigned to another vehicle. Reassign the slot explicitly or start this vehicle manually."
    case .routeAssignment: return "This route belongs to another vehicle. Repair the Shortcut or explicitly reassign the route."
    case .wrongVehicle: return "The Shortcut proposed a different vehicle. Repair its saved vehicle choice and run the setup test again. No trip was created."
    case .endBeforeStart: return "Run the selected vehicle’s Start Trip Shortcut before its End Trip Shortcut. No trip was created."
    case .expired: return "The setup test expired or the clock changed. Run the test again. No trip was created."
    case .routeMismatch: return "The observed route does not match this vehicle’s binding. Repair the connection or binding and test again. No trip was created."
    }
  }
}

public enum SetupCommandResult: Sendable, Equatable {
  case notTesting, handled, rejected(TrackingSetupFailure)
}
