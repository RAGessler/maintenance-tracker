# iOS Car-Stereo Trigger Test Plan

Issues: [iOS car-stereo trip triggers](https://github.com/RAGessler/maintenance-tracker/issues/2),
[per-vehicle Shortcut identity](https://github.com/RAGessler/maintenance-tracker/issues/67)

## Evidence requirements

For every physical run, export Diagnostics JSON and record:

- iPhone model and iOS version
- vehicle/stereo model and wired or wireless connection type
- app state before the trigger: foreground, background, locked, suspended, or force-quit
- automation trigger and App Intent parameter
- timestamps for connect, movement, route loss, reconnect, and finalization
- resulting trip state and location sample counts
- exported evidence filename

Do not count simulator, Expo Go, or manual button behavior as proof of locked-screen automation.

## Permission preparation

1. Install a signed development build on the physical iPhone.
2. Grant precise When In Use and then Always Location.
3. Confirm the app reports `always` before testing an automation.
4. Connect the stereo and use **Set current car route** before creating the Bluetooth automation.
5. If Allow Once was selected, enable Always Location in Settings; iOS cannot distinguish Allow
   Once from normal When In Use authorization in the same session.
6. For wired CarPlay, run **Configure Vehicle Route** with the intended vehicle selected while its
   CarPlay route is connected. Repeat setup if the vehicle or head unit changes.

## Automation setup

| Automation | Trigger | Action | Required setting |
| --- | --- | --- | --- |
| CarPlay start | CarPlay Connects | Run configured vehicle Start Shortcut | Run immediately |
| CarPlay end | CarPlay Disconnects | Run configured vehicle End Shortcut | Run immediately |
| Bluetooth start | Selected stereo Connects | Run configured vehicle Start Shortcut | Run immediately |
| Bluetooth end | Selected stereo Disconnects | Run configured vehicle End Shortcut | Run immediately |

Create each normal Shortcut first. Its Maintenance Tracker action binds the immutable vehicle choice
and CarPlay or Bluetooth trigger provenance. The Personal Automation then binds the exact CarPlay or
selected-device event and invokes that configured Shortcut with **Run Shortcut**. The Automation
editor does not expose the dynamic vehicle parameter when the app action is added directly.

The physical test iPhone exposes selected-device Bluetooth connect and disconnect automations.
Matching audio-route loss and the three-minute reconnect grace remain a fallback when the disconnect
automation is delayed or missed.

## Test matrix

| ID | Scenario | Expected evidence |
| --- | --- | --- |
| CP-01 | CarPlay connects with app foregrounded | Start intent, selected car route, candidate state |
| CP-02 | CarPlay connects while app backgrounded and phone locked | Native start without opening UI; location samples continue |
| CP-03 | Movement begins after CP-02 | Candidate becomes active at 3 m/s or 100 m displacement |
| CP-04 | CarPlay disconnects while locked | End intent completes trip and stops location |
| CP-05 | Brief CarPlay reconnect | Explicit disconnect behavior is recorded; verify whether automation splits trip |
| BT-01 | Selected stereo connects with app foregrounded | Bluetooth start intent and route capture |
| BT-02 | Selected stereo connects while phone locked | Native start and candidate samples without UI launch |
| BT-03 | Selected stereo disconnects while phone is locked | End intent completes the trip and stops location |
| BT-04 | Stereo route disappears without a disconnect automation | Reconnect grace starts, then returns to active if restored within three minutes |
| BT-05 | Stereo route remains absent for more than three minutes without a disconnect automation | Timer or next execution opportunity after deadline completes trip |
| FP-01 | AirPods connect with no personal automation | No trip starts |
| FP-02 | Output switches from car to AirPods during an active trip | Route change is logged; only selected car route loss is considered |
| FP-03 | Output switches to handset speaker briefly | Grace period prevents immediate completion |
| LC-01 | App is suspended before automation | Record whether intent and location launch successfully |
| LC-02 | App process is evicted by iOS | Record restoration behavior without claiming force-quit support |
| LC-03 | User force-quits app before automation | Expected limitation: background location may not start or resume |
| PM-01 | Location is downgraded to When In Use | Start fails visibly with `always-location-required` |
| PM-02 | Precise Location is disabled | Record sample accuracy and movement-confirmation behavior |
| MAN-01 | Manual start and stop | Same native state and SQLite pipeline as automations |
| EXP-01 | Export Diagnostics JSON | Export includes status and up to 1,000 native events |
| ID-01 | Connect Car A, disconnect, and reconnect | Compare CarPlay name/type/UID; record whether the normalized UID prefix is stable |
| ID-02 | Repeat ID-01 with Car B | Confirm Car B fingerprint remains distinct from Car A |
| ID-03 | Repeat ID-01 after iPhone reboot and head-unit reboot | Determine whether a normalized CarPlay UID is usable only as a heuristic |
| ID-04 | Connect Car C's `GTA Car Kit` Bluetooth stereo | Confirm selected-Bluetooth automation and `00:18:E4:DC:DA:D7-tacl` route identity; do not classify it as CarPlay |
| DIST-01 | Drive a known odometer distance with a recognized vehicle | Compare displayed estimated miles and accepted-fix count with the odometer; record the error and conditions |

## Per-vehicle Shortcut identity matrix

Use a signed build containing the vehicle-parameterized Start Trip and End Trip intents. For every
run, record the selected vehicle and trigger type, but redact route UIDs from anything attached to a
public issue.

| ID | Scenario | Expected evidence |
| --- | --- | --- |
| VEH-BT-01 | Selected Bluetooth stereo connects while locked; Start Trip selects that vehicle and Bluetooth | Requested and recognized vehicles match; candidate starts without opening the app |
| VEH-BT-02 | Selected Bluetooth stereo disconnects while locked; End Trip selects the same vehicle and Bluetooth | Matching trip completes; event source is Bluetooth |
| VEH-WCP-01 | Wireless CarPlay connects while locked; its paired Bluetooth automation selects the vehicle | Record Bluetooth intent and CarPlay route ordering; one candidate exists for the selected vehicle |
| VEH-WCP-02 | Wireless CarPlay disconnects while locked | Record Bluetooth and CarPlay disconnect ordering; the matching trip completes only once |
| VEH-WCP-03 | Setup Bluetooth disconnects during wireless CarPlay handoff | `end-deferred-carplay-active` is recorded and the trip remains open while CarPlay is present |
| VEH-CP-01 | Wired CarPlay connects while locked; Start Trip selects that vehicle and CarPlay | Requested and recognized vehicles match after route capture |
| VEH-CP-02 | Repeat VEH-CP-01 after iPhone and head-unit restart | The same vehicle is recognized, or the heuristic is rejected as unreliable |
| VEH-MM-01 | Connect one recognized vehicle but run Start Trip with a different vehicle selected | Trip fails with `vehicle-route-mismatch`; location tracking does not remain active |
| VEH-UNK-01 | Run a vehicle-bound Start Trip with a present car route not in the test registry | Trip fails with `vehicle-route-unrecognized`; location tracking does not remain active |
| VEH-END-01 | While one vehicle is active, run End Trip with a different vehicle selected | End is rejected with `vehicle-mismatch`; the active trip remains active |
| VEH-STALE-01 | Preserve an automation, remove its vehicle from the next signed test build, then run it | The unavailable entity reaches the intent and logs `start-rejected-vehicle-unavailable`; no trip starts |
| VEH-REASSIGN-01 | Edit VEH-STALE-01 to select another active vehicle, then run it on that vehicle | The new immutable vehicle ID is used; the removed ID is not rebound or reused |
| VEH-ROUTE-REASSIGN-01 | Configure one observed route for Vehicle A, then configure the same route for Vehicle B and restart the app | Vehicle A no longer matches the route; Vehicle B still matches after restart |

For each failure case, reopen the app after the locked test and export diagnostics. A dialog alone is
not sufficient evidence because automation notifications may be suppressed.

## Acceptance

The spike succeeds only when physical evidence shows:

- CarPlay start and end run while locked.
- Selected Bluetooth connect starts candidate tracking while locked.
- Selected Bluetooth disconnect completes a trip while locked.
- Accepted movement promotes the candidate to active tracking.
- Brief Bluetooth route loss without a delivered end automation does not finalize a trip.
- AirPods, speaker, and unrelated route changes never create a trip without a personal automation.
- Limitations after suspension, OS eviction, force-quit, and permission changes are documented.
