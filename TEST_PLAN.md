# iOS Car-Stereo Trigger Test Plan

Issue: [#2](https://github.com/RAGessler/maintenance-tracker/issues/2)

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

## Automation setup

| Automation | Trigger | Action | Required setting |
| --- | --- | --- | --- |
| CarPlay start | CarPlay Connects | Start Trip, CarPlay | Run immediately |
| CarPlay end | CarPlay Disconnects | End Trip | Run immediately |
| Bluetooth start | Selected stereo Connects | Start Trip, Bluetooth stereo | Run immediately |
| Bluetooth end | Selected stereo Disconnects | End Trip | Run immediately |

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

## Acceptance

The spike succeeds only when physical evidence shows:

- CarPlay start and end run while locked.
- Selected Bluetooth connect starts candidate tracking while locked.
- Selected Bluetooth disconnect completes a trip while locked.
- Accepted movement promotes the candidate to active tracking.
- Brief Bluetooth route loss without a delivered end automation does not finalize a trip.
- AirPods, speaker, and unrelated route changes never create a trip without a personal automation.
- Limitations after suspension, OS eviction, force-quit, and permission changes are documented.
