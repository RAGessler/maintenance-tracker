import Foundation
import SQLite3
import Testing
@testable import MaintenanceStoreCore

@Test("location alone leaves every missing automatic setup requirement visible")
func reportsAllMissingSetupRequirements() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 1_000, now: 2)
  let setup = try store.trackingSetup(for: vehicle.id, locationReady: true)
  #expect(setup.state == "incomplete")
  #expect(setup.locationReady)
  #expect(!setup.shortcutsReady)
  #expect(!setup.automationsReady)
  #expect(!setup.checklistConfirmed)
  #expect(!setup.routeReady)
  #expect(!setup.testReady)
  #expect(setup.setupID == nil)
}

@Test("a setup test requires the saved Start and End commands and never writes a trip")
func completesSetupThroughDeliveredCommands() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 1_000, now: 2)
  let configured = try store.saveTrackingSetup(for: vehicle.id, transport: .bluetooth, expectedSetupID: nil,
    shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 3)
  let setupID = try #require(configured.setupID)
  let route = try TrackingRoute(kind: "bluetooth_route", opaqueValue: "synthetic-car")
  try store.bindSetupRoute(for: vehicle.id, setupID: setupID, route: route, now: 4)
  try store.armSetupTest(for: vehicle.id, setupID: setupID, locationReady: true, now: 5)
  #expect(throws: LocalStoreError.trackingConflict) { try store.startTracking(vehicleId: vehicle.id, source: "manual", now: 6) }
  #expect(try store.trackingSetup(for: vehicle.id, locationReady: true).testState == "waiting_start")
  #expect(try store.trackingSetup(for: vehicle.id, locationReady: true).state == "incomplete")
  #expect(try store.receiveSetupCommand(vehicleID: vehicle.id, isStart: true, route: route, locationReady: true, now: 6) == .handled)
  #expect(try store.trackingSetup(for: vehicle.id, locationReady: true).testState == "waiting_end")
  #expect(try store.receiveSetupCommand(vehicleID: vehicle.id, isStart: false, route: nil, locationReady: true, now: 7) == .handled)
  #expect(try store.trackingSetup(for: vehicle.id, locationReady: true).state == "ready")
  #expect(try store.trips(for: vehicle.id).isEmpty)
  #expect(try store.session() == nil)
  #expect(try store.latestManualOdometer(for: vehicle.id)?.milliMiles == 1_000)
  _ = try store.saveTrackingSetup(for: vehicle.id, transport: .bluetooth, expectedSetupID: setupID,
    shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 8)
  let repaired = try store.trackingSetup(for: vehicle.id, locationReady: true)
  #expect(repaired.routeReady)
  #expect(!repaired.testReady)
  #expect(repaired.state == "incomplete")
}

@Test("route reassignment requires confirmation and invalidates the old vehicle's test")
func guardsRouteReassignment() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let first = try store.createVehicle(nickname: "First", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let second = try store.createVehicle(nickname: "Second", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 3)
  let a = try store.saveTrackingSetup(for: first.id, transport: .wirelessCarPlay, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 4)
  let b = try store.saveTrackingSetup(for: second.id, transport: .wirelessCarPlay, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 5)
  let route = try TrackingRoute(kind: "carplay_route", opaqueValue: "synthetic-Audio-AudioMain-session-1")
  try store.bindSetupRoute(for: first.id, setupID: #require(a.setupID), route: route, now: 6)
  try store.recordShortcutTest(for: first.id, now: 7)
  #expect(throws: TrackingSetupFailure.routeAssignment(first.id)) {
    try store.bindSetupRoute(for: second.id, setupID: #require(b.setupID), route: route, now: 8)
  }
  #expect(try store.trackingSetup(for: first.id, locationReady: true).state == "ready")
  try store.bindSetupRoute(for: second.id, setupID: #require(b.setupID), route: route, replacingVehicleID: first.id, now: 9)
  #expect(try store.trackingSetup(for: first.id, locationReady: true).state == "incomplete")
  #expect(try store.trackingSetup(for: second.id, locationReady: true).routeReady)
  #expect(try !store.trackingSetup(for: second.id, locationReady: true).testReady)
}

@Test("wrong vehicle, missing permission, expired tests and end-before-start never create trips", arguments: ["wrong_vehicle", "permission_required", "test_expired", "end_before_start", "route_mismatch"])
func failsClosedSetupTest(reason: String) throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let setup = try store.saveTrackingSetup(for: vehicle.id, transport: .bluetooth, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 3)
  let route = try TrackingRoute(kind: "bluetooth_route", opaqueValue: "synthetic")
  try store.bindSetupRoute(for: vehicle.id, setupID: #require(setup.setupID), route: route, now: 4)
  try store.armSetupTest(for: vehicle.id, setupID: #require(setup.setupID), locationReady: true, now: 5)
  let proposed = reason == "wrong_vehicle" ? vehicle.id + 100 : vehicle.id
  let observed = reason == "route_mismatch" ? try TrackingRoute(kind: "bluetooth_route", opaqueValue: "different") : route
  let result = try store.receiveSetupCommand(vehicleID: proposed, isStart: reason != "end_before_start", route: observed,
    locationReady: reason != "permission_required", now: reason == "test_expired" ? 600_005 : 6)
  guard case .rejected(let failure) = result else { Issue.record("Unsafe setup test accepted \(reason)"); return }
  #expect(failure.code == reason)
  #expect(try store.trackingSetup(for: vehicle.id, locationReady: true).testState == "failed")
  #expect(try store.trips(for: vehicle.id).isEmpty)
  #expect(try store.session() == nil)
}

@Test("editing setup rejects stale screens and invalidates previous proof")
func invalidatesEditedSetup() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let first = try store.saveTrackingSetup(for: vehicle.id, transport: .bluetooth, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 3)
  let second = try store.saveTrackingSetup(for: vehicle.id, transport: .wiredCarPlay, expectedSetupID: first.setupID, shortcutsReady: false, automationsReady: false, checklistConfirmed: false, now: 4)
  #expect(second.setupID != first.setupID)
  #expect(throws: TrackingSetupFailure.changed) {
    _ = try store.saveTrackingSetup(for: vehicle.id, transport: .bluetooth, expectedSetupID: first.setupID, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 5)
  }
  #expect(try store.trackingSetup(for: vehicle.id).transport == .wiredCarPlay)
  #expect(try store.trackingSetup(for: vehicle.id).state == "incomplete")
}

@Test("wired reassignment is explicit and setup cannot change during a trip")
func guardsWiredSlotAndActiveTrips() throws {
  let store = try LocalStore(path: ":memory:")
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let first = try store.createVehicle(nickname: "First", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let second = try store.createVehicle(nickname: "Second", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 3)
  _ = try store.saveTrackingSetup(for: first.id, transport: .wiredCarPlay, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 4)
  #expect(throws: TrackingSetupFailure.wiredAssignment(first.id)) {
    _ = try store.saveTrackingSetup(for: second.id, transport: .wiredCarPlay, expectedSetupID: nil, shortcutsReady: false, automationsReady: false, checklistConfirmed: false, now: 5)
  }
  _ = try store.saveTrackingSetup(for: second.id, transport: .wiredCarPlay, expectedSetupID: nil, shortcutsReady: false, automationsReady: false, checklistConfirmed: false, replacingWiredVehicleID: first.id, now: 6)
  #expect(try store.trackingSetup(for: first.id).setupID == nil)
  try store.startTracking(vehicleId: first.id, source: "manual", now: 7)
  #expect(throws: TrackingSetupFailure.busy) {
    _ = try store.saveTrackingSetup(for: first.id, transport: .bluetooth, expectedSetupID: nil, shortcutsReady: false, automationsReady: false, checklistConfirmed: false, now: 8)
  }
}

@Test("setup and armed command delivery survive reopening without retaining a test trip")
func restoresSetupTest() throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: directory) }
  let path = directory.appendingPathComponent("store.sqlite").path
  let store = try LocalStore(path: path)
  _ = try store.acceptDisclosure(version: 1, now: 1)
  let vehicle = try store.createVehicle(nickname: "Daily", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let setup = try store.saveTrackingSetup(for: vehicle.id, transport: .wiredCarPlay, expectedSetupID: nil, shortcutsReady: true, automationsReady: true, checklistConfirmed: true, now: 3)
  let id = try #require(setup.setupID)
  let route = try TrackingRoute(kind: "carplay_route", opaqueValue: "synthetic-Audio-AudioMain-one")
  try store.bindSetupRoute(for: vehicle.id, setupID: id, route: route, now: 4)
  try store.armSetupTest(for: vehicle.id, setupID: id, locationReady: true, now: 5)
  #expect(try store.receiveSetupCommand(vehicleID: vehicle.id, isStart: true, route: route, locationReady: true, now: 6) == .handled)
  store.close()
  let reopened = try LocalStore(path: path)
  #expect(try reopened.trackingSetup(for: vehicle.id, locationReady: true).testState == "waiting_end")
  let reconnected = try TrackingRoute(kind: "carplay_route", opaqueValue: "synthetic-Audio-AudioMain-two")
  #expect(try reopened.receiveSetupCommand(vehicleID: vehicle.id, isStart: false, route: reconnected, locationReady: true, now: 7) == .handled)
  #expect(try reopened.trackingSetup(for: vehicle.id, locationReady: true).state == "ready")
  #expect(try reopened.trips(for: vehicle.id).isEmpty)
  try reopened.archiveVehicle(id: vehicle.id, now: 8)
  try reopened.restoreVehicle(id: vehicle.id, now: 9)
  #expect(try reopened.trackingSetup(for: vehicle.id, locationReady: true).state == "incomplete")
  #expect(try reopened.trackingSetup(for: vehicle.id).setupID == nil)
}

@Test("v2 setup, odometer and vehicle records survive the forward-only setup migration")
func migratesExistingSetup() throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: directory) }
  let path = directory.appendingPathComponent("v2.sqlite").path
  var database: OpaquePointer?
  #expect(sqlite3_open(path, &database) == SQLITE_OK)
  let connection = try #require(database)
  // Historical v2 definitions, independent of the new migration.
  let fixture = """
    CREATE TABLE installation_state(id INTEGER PRIMARY KEY, disclosure_version INTEGER, disclosure_accepted_at INTEGER);
    INSERT INTO installation_state VALUES(1,1,1);
    CREATE TABLE vehicle(id INTEGER PRIMARY KEY, nickname TEXT, year INTEGER, make TEXT, model TEXT, archived_at INTEGER, created_at INTEGER, updated_at INTEGER);
    INSERT INTO vehicle VALUES(7,'Existing',2020,'Test','Car',NULL,1,1);
    CREATE TABLE manual_odometer_reading(id INTEGER PRIMARY KEY, vehicle_id INTEGER REFERENCES vehicle(id), effective_at INTEGER, milli_miles INTEGER, origin TEXT, created_at INTEGER);
    INSERT INTO manual_odometer_reading VALUES(8,7,2,1234567,'manual',2);
    CREATE TABLE trigger_configuration(id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER REFERENCES vehicle(id), mode TEXT CHECK(mode IN ('bluetooth_shortcut','wired_carplay_shortcut')), setup_completed_at INTEGER, tested_at INTEGER, created_at INTEGER, updated_at INTEGER, UNIQUE(vehicle_id,mode));
    INSERT INTO trigger_configuration VALUES(9,7,'wired_carplay_shortcut',3,4,3,4);
    CREATE TABLE route_binding(id INTEGER PRIMARY KEY, vehicle_id INTEGER REFERENCES vehicle(id), kind TEXT, opaque_value TEXT, created_at INTEGER, UNIQUE(kind,opaque_value));
    INSERT INTO route_binding VALUES(10,7,'carplay_route','synthetic',3);
    PRAGMA user_version=2;
    """
  #expect(sqlite3_exec(connection, fixture, nil, nil, nil) == SQLITE_OK)
  sqlite3_close(connection)
  let store = try LocalStore(path: path)
  #expect(try store.schemaVersion() == 3)
  #expect(try store.latestManualOdometer(for: 7)?.milliMiles == 1_234_567)
  #expect(try store.shortcutVehicles().first?.nickname == "Existing")
  let setup = try store.trackingSetup(for: 7, locationReady: true)
  #expect(setup.setupID == 9)
  #expect(setup.transport == .wiredCarPlay)
  #expect(setup.state == "incomplete")
  #expect(!setup.shortcutsReady)
  #expect(!setup.testReady)
  #expect(setup.routeReady)
}

@Test("saved Shortcut vehicle choices cannot alias a different installation's reused row ID")
func keepsShortcutIdentityAcrossResetsSafe() throws {
  let first = try LocalStore(path: ":memory:")
  let second = try LocalStore(path: ":memory:")
  _ = try first.acceptDisclosure(version: 1, now: 1)
  _ = try second.acceptDisclosure(version: 1, now: 1)
  let old = try first.createVehicle(nickname: "Old", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  let new = try second.createVehicle(nickname: "New", year: 2020, make: "Test", model: "Car", initialOdometerMilliMiles: 0, now: 2)
  #expect(old.id == new.id)
  let savedChoice = try first.shortcutIdentifier(for: old.id)
  #expect(try first.shortcutVehicle(identifier: savedChoice)?.id == old.id)
  #expect(try second.shortcutVehicle(identifier: savedChoice) == nil)
  try first.archiveVehicle(id: old.id, now: 3)
  #expect(try first.shortcutVehicle(identifier: savedChoice) == nil)
}
