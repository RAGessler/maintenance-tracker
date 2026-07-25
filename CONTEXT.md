# Maintenance Tracker

Shared product language for the private, multi-vehicle maintenance and mileage application.

## Language

**Vehicle profile**:
A user's manually entered identity for one vehicle: nickname, year, make, model, current odometer, and an optional hero photo.
_Avoid_: Car record, VIN profile

**Route fingerprint**:
Route information observed during vehicle setup and bound to one vehicle profile so a trip trigger can select that vehicle. Bluetooth uses an exact observed route UID; CarPlay uses a user-confirmed, unverified normalized route UID heuristic.
_Avoid_: Stable hardware UUID, automatic vehicle identity

**Best-effort automatic tracking**:
Trip capture initiated by user-created CarPlay or selected-Bluetooth Shortcuts automations when iOS delivers them. It may operate while the app is backgrounded or the phone is locked, but does not guarantee delivery after force-quit or in every lifecycle state; review and manual correction remain required fallbacks.
_Avoid_: Guaranteed background tracking, always-on tracking

**Candidate trip**:
Captured trip evidence that has not met all automatic-confirmation conditions and therefore needs the user's review before it can affect the estimated odometer.
_Avoid_: Confirmed trip, mileage entry

**Confirmed trip**:
A trip whose distance contributes to the estimated odometer. It may be automatically confirmed only after its configured trigger, movement confirmation, and normal completion all succeed; users may later reassign, correct, or reject it through auditable changes.
_Avoid_: Immutable trip, authoritative odometer reading

**Estimated odometer**:
The calculated current mileage: the latest manual odometer reading baseline plus confirmed-trip distances that occurred after that baseline. It is not an authoritative historical rewrite.
_Avoid_: Dashboard reading, lifetime trip total

**Manual odometer reading**:
An append-only, dated, authoritative current-odometer entry for a vehicle profile. It establishes the displayed current odometer baseline without rewriting historical trip estimates; a later reading corrects an earlier one.
_Avoid_: Editing historical trip distance, mutable baseline

**Maintenance record**:
A completed service entry for one vehicle profile with a service name, completion date, odometer reading, and optional note. It may stand alone or complete one maintenance schedule.
_Avoid_: Receipt, service schedule

**Maintenance schedule**:
An editable per-vehicle rule, created from a generic template or custom definition, that predicts the next service by mileage, time, or whichever occurs first.
_Avoid_: Completed maintenance record
