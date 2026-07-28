import Foundation

public enum TrackingEngineError: Error, Equatable {
  case conflict
  case wrongVehicle
}

public enum TrackingSource: Equatable, Sendable { case automatic, manual }
public enum TrackingLifecycle: Equatable, Sendable { case awaitingMovement, active, recovering }
public enum RouteEvidence: Equatable, Sendable { case matching, unknown, conflicting }
public enum TrackingCompletion: Equatable, Sendable { case explicitEnd, routeLossAfterGrace, notCompleted }
public enum TrackingDisposition: Equatable, Sendable { case confirmed, reviewRequired }
public enum TrackingFailure: Equatable, Sendable {
  case movementNotConfirmed, routeNotCorroborated, unknownRoute, conflictingRoute
  case locationPermissionLost, locationFailed, restorationFailed, maximumDurationExceeded
}

public struct TrackingLocation: Equatable, Sendable {
  public let timestamp: Int64
  public let speedMetersPerSecond: Double
  public let displacementMeters: Double
  public let distanceMilliMiles: Int64

  public init(timestamp: Int64, speedMetersPerSecond: Double, displacementMeters: Double, distanceMilliMiles: Int64) {
    self.timestamp = timestamp
    self.speedMetersPerSecond = speedMetersPerSecond
    self.displacementMeters = displacementMeters
    self.distanceMilliMiles = distanceMilliMiles
  }
}

public func metersToMilliMiles(_ meters: Double) -> Int64 {
  Int64((meters / 1_609.344 * 1_000).rounded())
}

public struct TrackingSession: Equatable, Sendable {
  public let vehicleID: Int64
  public let source: TrackingSource
  public var state: TrackingLifecycle
  public let startedAt: Int64
  public var movementDeadline: Int64?
  public var reconnectDeadline: Int64?
  public let maximumDurationDeadline: Int64
  public var routeEvidence: RouteEvidence?
  public var movementObserved: Bool
  public var cumulativeMilliMiles: Int64

  public init(vehicleID: Int64, source: TrackingSource, state: TrackingLifecycle, startedAt: Int64, movementDeadline: Int64?, maximumDurationDeadline: Int64, reconnectDeadline: Int64? = nil, routeEvidence: RouteEvidence? = nil, movementObserved: Bool = false, cumulativeMilliMiles: Int64 = 0) {
    self.vehicleID = vehicleID; self.source = source; self.state = state; self.startedAt = startedAt
    self.movementDeadline = movementDeadline; self.maximumDurationDeadline = maximumDurationDeadline
    self.reconnectDeadline = reconnectDeadline; self.routeEvidence = routeEvidence
    self.movementObserved = movementObserved; self.cumulativeMilliMiles = cumulativeMilliMiles
  }
}

public struct TrackingFinalization: Equatable, Sendable {
  public let disposition: TrackingDisposition
  public let completion: TrackingCompletion
  public let reason: TrackingFailure?
  public let distanceMilliMiles: Int64

  public init(disposition: TrackingDisposition, completion: TrackingCompletion, reason: TrackingFailure?, distanceMilliMiles: Int64) {
    self.disposition = disposition; self.completion = completion; self.reason = reason; self.distanceMilliMiles = distanceMilliMiles
  }
}

public protocol TrackingSessionRepository: AnyObject {
  func beginAutomatic(vehicleID: Int64, now: Int64) throws -> TrackingSession
  func session() throws -> TrackingSession?
  func save(_ session: TrackingSession) throws
  /// Must atomically create the trip, its state/revision, and clear precise session anchors.
  func finalize(_ finalization: TrackingFinalization, session: TrackingSession, now: Int64) throws
}

/// Deterministic lifecycle policy. Platform adapters supply only delivered events and aggregate fixes.
public final class TrackingEngine {
  private let repository: TrackingSessionRepository
  private static let reconnectWindowMilliseconds: Int64 = 180_000

  public init(repository: TrackingSessionRepository) { self.repository = repository }

  public func startAutomatic(vehicleID: Int64, now: Int64) throws { _ = try repository.beginAutomatic(vehicleID: vehicleID, now: now) }

  public func receive(route: RouteEvidence, now: Int64) throws {
    try tick(now: now)
    guard var session = try repository.session() else { return }
    switch route {
    case .matching:
      session.routeEvidence = .matching
      if session.state == .recovering { session.state = session.movementObserved ? .active : .awaitingMovement; session.reconnectDeadline = nil }
      try repository.save(session)
    case .unknown: try finish(session, completion: .notCompleted, reason: .unknownRoute, now: now)
    case .conflicting: try finish(session, completion: .notCompleted, reason: .conflictingRoute, now: now)
    }
  }

  public func receive(location: TrackingLocation, now: Int64) throws {
    try tick(now: now)
    guard var session = try repository.session(), session.state != .recovering else { return }
    session.cumulativeMilliMiles += max(0, location.distanceMilliMiles)
    if !session.movementObserved && (location.speedMetersPerSecond >= 3 || location.displacementMeters >= 100) {
      session.movementObserved = true
      session.movementDeadline = nil
      session.state = .active
    }
    try repository.save(session)
  }

  public func routeLost(now: Int64, carPlayActive: Bool) throws {
    try tick(now: now)
    guard var session = try repository.session() else { return }
    // Wireless Bluetooth loss during an active CarPlay route is a transport handoff, not an end candidate.
    guard !carPlayActive else { return }
    session.state = .recovering
    session.reconnectDeadline = now + Self.reconnectWindowMilliseconds
    try repository.save(session)
  }

  public func end(vehicleID: Int64, now: Int64) throws {
    try tick(now: now)
    guard let session = try repository.session() else { return }
    guard session.vehicleID == vehicleID else { throw TrackingEngineError.wrongVehicle }
    try finish(session, completion: .explicitEnd, reason: nil, now: now)
  }

  public func tick(now: Int64) throws {
    guard let session = try repository.session() else { return }
    if now >= session.maximumDurationDeadline { try finish(session, completion: .notCompleted, reason: .maximumDurationExceeded, now: now) }
    else if let deadline = session.movementDeadline, now >= deadline { try finish(session, completion: .notCompleted, reason: .movementNotConfirmed, now: now) }
    else if let deadline = session.reconnectDeadline, now >= deadline { try finish(session, completion: .routeLossAfterGrace, reason: nil, now: now) }
  }

  public func locationFailed(now: Int64) throws {
    guard let session = try repository.session() else { return }
    try finish(session, completion: .notCompleted, reason: .locationFailed, now: now)
  }

  public func restorationFailed(now: Int64) throws {
    guard let session = try repository.session() else { return }
    try finish(session, completion: .notCompleted, reason: .restorationFailed, now: now)
  }

  public func permissionLost(now: Int64) throws {
    guard let session = try repository.session() else { return }
    try finish(session, completion: .notCompleted, reason: .locationPermissionLost, now: now)
  }

  private func finish(_ session: TrackingSession, completion: TrackingCompletion, reason: TrackingFailure?, now: Int64) throws {
    let automaticConfirmed = session.source == .automatic && session.movementObserved && session.cumulativeMilliMiles > 0 && completion == .explicitEnd && reason == nil
    let manualConfirmed = session.source == .manual && session.movementObserved && session.cumulativeMilliMiles > 0 && reason == nil
    let fallbackReason: TrackingFailure? = reason ?? (!session.movementObserved ? .movementNotConfirmed : nil)
    try repository.finalize(TrackingFinalization(disposition: automaticConfirmed || manualConfirmed ? .confirmed : .reviewRequired, completion: completion, reason: fallbackReason, distanceMilliMiles: session.cumulativeMilliMiles), session: session, now: now)
  }
}
