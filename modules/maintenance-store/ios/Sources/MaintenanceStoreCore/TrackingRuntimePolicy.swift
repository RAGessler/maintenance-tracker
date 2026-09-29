import Foundation

/// Pure timestamp policy shared by the Core Location adapter and deterministic tests.
public enum TrackingRuntimePolicy {
  public enum LocationAuthorization: Equatable, Sendable {
    case notDetermined, whenInUse, alwaysPrecise, alwaysReduced, denied, restricted, unavailable
  }

  public enum ManualPermissionDecision: Equatable, Sendable {
    case allowed, requestWhenInUse, denied
  }

  public enum LocationDecision: Equatable, Sendable {
    case accept
    case rejectStale
    case skipDistance
  }

  public static let maximumFixAgeMilliseconds: Int64 = 30_000

  public static func manualPermissionDecision(for authorization: LocationAuthorization) -> ManualPermissionDecision {
    switch authorization {
    case .whenInUse, .alwaysPrecise, .alwaysReduced: return .allowed
    case .notDetermined: return .requestWhenInUse
    case .denied, .restricted, .unavailable: return .denied
    }
  }

  public static func locationDecision(
    timestamp: Int64,
    now: Int64,
    sessionStartedAt: Int64,
    lastAcceptedTimestamp: Int64?
  ) -> LocationDecision {
    guard timestamp >= sessionStartedAt else { return .rejectStale }
    guard abs(Double(timestamp) - Double(now)) <= Double(maximumFixAgeMilliseconds) else { return .rejectStale }

    guard let lastAcceptedTimestamp else { return .accept }
    guard timestamp > lastAcceptedTimestamp else { return .rejectStale }
    let (gap, overflow) = timestamp.subtractingReportingOverflow(lastAcceptedTimestamp)
    guard !overflow else { return .skipDistance }
    return gap > maximumFixAgeMilliseconds ? .skipDistance : .accept
  }
}

public enum ForegroundPermissionRequestGateError: Error, Equatable {
  case requestInProgress
}

/// Owns the one outstanding manual-start permission request used by the native runtime.
@MainActor
public final class ForegroundPermissionRequestGate {
  public struct Resolution: Equatable, Sendable {
    fileprivate let token: UUID
    public let vehicleID: Int64
    fileprivate let granted: Bool

    fileprivate init(token: UUID, vehicleID: Int64, granted: Bool) {
      self.token = token
      self.vehicleID = vehicleID
      self.granted = granted
    }
  }

  public enum Consumption: Equatable, Sendable {
    case granted, denied, cancelled
  }

  private struct PendingRequest {
    enum State {
      case waiting(CheckedContinuation<Resolution, Never>)
      case resolved(Bool)
    }

    let token: UUID
    let vehicleID: Int64
    var state: State
  }

  private var pendingRequest: PendingRequest?

  public init() {}

  public var isRequestPending: Bool { pendingRequest != nil }

  public func waitForPermission(
    vehicleID: Int64,
    requestAuthorization: () -> Void
  ) async throws -> Resolution {
    guard pendingRequest == nil else { throw ForegroundPermissionRequestGateError.requestInProgress }
    return await withCheckedContinuation { continuation in
      let token = UUID()
      pendingRequest = PendingRequest(token: token, vehicleID: vehicleID, state: .waiting(continuation))
      requestAuthorization()
    }
  }

  public func reserveGrantedPermission(vehicleID: Int64) throws -> Resolution {
    guard pendingRequest == nil else { throw ForegroundPermissionRequestGateError.requestInProgress }
    let token = UUID()
    pendingRequest = PendingRequest(token: token, vehicleID: vehicleID, state: .resolved(true))
    return Resolution(token: token, vehicleID: vehicleID, granted: true)
  }

  @discardableResult
  public func resolve(granted: Bool) -> Bool {
    guard var pendingRequest,
          case let .waiting(continuation) = pendingRequest.state else { return false }
    pendingRequest.state = .resolved(granted)
    self.pendingRequest = pendingRequest
    continuation.resume(returning: Resolution(
      token: pendingRequest.token,
      vehicleID: pendingRequest.vehicleID,
      granted: granted
    ))
    return true
  }

  /// Consumes the still-current command after its await and immediately before it may start tracking.
  public func consume(_ resolution: Resolution) -> Consumption {
    guard let pendingRequest,
          pendingRequest.token == resolution.token,
          pendingRequest.vehicleID == resolution.vehicleID,
          case let .resolved(granted) = pendingRequest.state,
          granted == resolution.granted else { return .cancelled }
    self.pendingRequest = nil
    return granted ? .granted : .denied
  }

  @discardableResult
  public func cancel(vehicleID: Int64? = nil) -> Bool {
    guard let pendingRequest,
          vehicleID == nil || pendingRequest.vehicleID == vehicleID else { return false }
    self.pendingRequest = nil
    if case let .waiting(continuation) = pendingRequest.state {
      continuation.resume(returning: Resolution(
        token: pendingRequest.token,
        vehicleID: pendingRequest.vehicleID,
        granted: false
      ))
    }
    return true
  }
}
