import Foundation
import Testing
@testable import MaintenanceStoreCore

@Test("creating a vehicle creates its authoritative initial odometer reading atomically")
func createsVehicleAndInitialReading() throws {
  let store = try LocalStore(path: ":memory:")

  let vehicle = try store.createVehicle(
    nickname: "Daily",
    year: 2020,
    make: "Honda",
    model: "Civic",
    initialOdometerMilliMiles: 42_125_000,
    now: 1_700_000_000_000
  )

  #expect(vehicle.id == 1)
  #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == 42_125_000)
}

@Test("concurrent vehicle creation returns each vehicle's generated identifier")
func returnsVehicleIdentifierFromItsTransaction() async throws {
  let store = try LocalStore(path: ":memory:")
  let vehicles = try await withThrowingTaskGroup(of: (StoredVehicle, Int64).self) { group in
    for value in 0..<100 {
      group.addTask {
        let milliMiles = Int64(value)
        return (
          try store.createVehicle(
            nickname: "Vehicle \(value)", year: 2020, make: "Honda", model: "Civic",
            initialOdometerMilliMiles: milliMiles, now: 1
          ),
          milliMiles
        )
      }
    }

    var results: [(StoredVehicle, Int64)] = []
    for try await result in group {
      results.append(result)
    }
    return results
  }

  for (vehicle, milliMiles) in vehicles {
    #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == milliMiles)
  }
}

@Test("tracking state is temporary and is cleared when a session stops")
func clearsTemporaryTrackingState() throws {
  let store = try LocalStore(path: ":memory:")
  let vehicle = try store.createVehicle(
    nickname: "Daily", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1
  )

  #expect(throws: LocalStoreError.disclosureRequired) {
    try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 2)
  }
  _ = try store.acceptDisclosure(version: 1, now: 2)
  try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 3)
  #expect(try store.trackingState() == "tracking")

  try store.stopTracking()
  #expect(try store.trackingState() == "idle")
}

@Test("a competing vehicle cannot replace an active tracking session")
func rejectsCompetingTrackingStart() throws {
  let store = try LocalStore(path: ":memory:")
  let first = try store.createVehicle(nickname: "First", year: 2020, make: "Honda", model: "Civic", initialOdometerMilliMiles: 0, now: 1)
  let second = try store.createVehicle(nickname: "Second", year: 2021, make: "Honda", model: "Fit", initialOdometerMilliMiles: 0, now: 2)
  _ = try store.acceptDisclosure(version: 1, now: 3)
  try store.startTracking(vehicleId: first.id, source: "manual", now: 4)

  #expect(throws: LocalStoreError.trackingConflict) {
    try store.startTracking(vehicleId: second.id, source: "automatic", now: 5)
  }
}
