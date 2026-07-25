# Claude revised artifact review

## Review target and method

Reviewed the exact standalone artifact supplied at:

`/Users/ragessler/Downloads/TorqueLog iOS Beta Flows (standalone).html`

The review covered the rendered canvas structure, its 60 screen/state targets, the connected flow
map, visible copy, interaction/accessibility annotations, and the decoded embedded HTML source. The
flow map contains 59 internal links with no missing targets. The artifact is a static design canvas:
its source uses visual `<div>` structures and anchor links, not executable buttons, inputs, ARIA, or
state transitions.

The artifact was checked against `docs/design/claude-design-iteration-brief.md` and the approved
resolutions titled:

- **Choose the private beta data and account boundary**
- **Define maintenance records and due schedules**
- **Define the garage and vehicle lifecycle contract**
- **Define trip review and odometer reconciliation**
- **Approve the iOS automatic-tracking product contract**
- **Set the beta privacy, retention, and security boundary**

## Verdict

**Iterate again.**

The revised artifact is a strong, targeted continuation of the original design, but it has **8
acceptance blockers**. These are product-behavior or disclosure errors, not requests for another
visual redesign. A short correction pass should update only the affected screens and add the few
missing consequential states.

The design is close enough that all other screens should be frozen during the correction pass.

## Preserved strengths

### Visual and structural continuity

- The original four-tab structure—**Garage, Activity, Due, Settings**—is preserved throughout.
- The original premium vehicle-journal language remains recognizable: hero photography, warm
  neutral canvas, soft cards, fine dividers, large vehicle/page titles, compact metadata, restrained
  blue status/action color, bottom sheets, and persistent trip strips.
- Garage remains vehicle-first; Due remains grouped by vehicle; Activity remains chronological; the
  revised Settings screen is a minimal extension of the existing tab rather than a replacement IA.
- Existing corrected iOS screens retain the original proportions and patterns. Added screens reuse
  grouped rows, banners, cards, sheets, native-alert previews, and destructive action treatment.
- Android examples are clearly marked **UNCHANGED** and the artifact states that they are frozen and
  outside this iOS-only iteration. They should not be canonicalized as approved behavior later.

### Strong contract improvements

- First-run, local-data, vehicle-profile, no-photo, archive/delete, schedule, tracking-setup, trip
  audit, odometer, diagnostics, export, and Delete All Data coverage is substantially more complete.
- Bluetooth display-name/signal identity was removed from revised iOS setup. Setup now uses
  vehicle-bound Shortcuts, Personal Automations, Run Immediately, route corroboration, test, and
  fails-closed recovery.
- The three-minute reconnect grace, 10-minute no-movement stop, 12-hour safety stop, Precise Always
  revocation, unsafe next-launch recovery, duplicate start, and conflicting start are represented.
- Maintenance cost and receipt attachment were removed from revised iOS flows. Templates, custom
  schedules, mileage/time/combined intervals, baseline defaults, due explanations, linked records,
  and delete recalculation are represented clearly.
- Candidate trip, confirmed trip, estimated odometer, and append-only manual odometer reading are
  generally differentiated well. Audit screens retain captured and edited values without route
  playback.
- Accessibility annotations are unusually concrete for a design artifact: VoiceOver labels and
  values, focus order/return, status announcement frequency, Dynamic Type reflow, non-color status,
  touch targets, and reduced-motion behavior are specified on representative patterns.

## Revised screen and state inventory

### Corrected original iOS screens

- Garage and Quick Add
- Disconnected and active-tracking vehicle dashboards
- Passive route-loss/reconnect grace
- Candidate trip review
- Automatic tracking readiness, setup mismatch, Precise Always pre-prompt, and setup-incomplete
  state
- Due list, maintenance completion form, Activity, and empty Garage

### Added first-run and vehicle-profile flows

- Local-only/no-account disclosure and detailed collection/retention/export/deletion disclosure
- Create vehicle profile, no-photo profile, hero-photo actions, edit profile
- Archive confirmation, archived list/restore, permanent delete, and active-trip lifecycle block

### Added maintenance flows

- Per-vehicle schedule list and add choices
- Template schedule with baseline, custom schedule, schedule detail, delete confirmation
- Maintenance record detail and linked-record delete/recalculation preview

### Added tracking setup and lifecycle states

- Setup test running/passed, CarPlay/Bluetooth assignments, stale Shortcut repair
- Manual vehicle selection and active manual trip
- Duplicate and conflicting starts
- No movement, 12-hour stop, permission revoked, unsafe next-launch recovery, and wireless CarPlay
  handoff

### Added review, odometer, and data-control flows

- Reassign proposed vehicle, edit total distance, confirmation, rejection, and trip audit
- New/lower odometer reading, reading history, and estimate explanation
- Settings, local data/privacy, diagnostics, export preparation/progress/ready/failure, and Delete All
  Data confirmation

## Prioritized findings

### Acceptance blockers

#### B1. An active trip is incorrectly included in the estimated odometer

**Artifact evidence:** Screen **04 · Dashboard, tracking** shows `84,212 mi ESTIMATED` followed by
“Includes current trip.” Screen **36 · Manual trip active** correctly says the active trip is not
included until confirmed, so the artifact contradicts itself.

**Contract violated:** **Define trip review and odometer reconciliation** says the estimated
odometer is the latest manual-reading baseline plus confirmed trips after it. **Approve the iOS
automatic-tracking product contract** requires automatic confirmation only after all required
signals and normal completion.

**Exact correction:** On screen 04, exclude current distance from the estimated odometer and say
“Active trip not included until confirmed,” matching screen 36. If useful, show a separate
non-authoritative “current trip distance” value without adding it to the estimate.

#### B2. A trip with all displayed automatic-confirmation evidence is still sent to review

**Artifact evidence:** Screen **06 · Trip review** says the configured Shortcut and route matched,
movement was confirmed, and the three-minute reconnect grace expired. Screen **48 · Trip audit**
describes the same trip as route-corroborated, movement-confirmed, good quality, and “Ended by
Reconnect grace expired,” yet it required human confirmation.

**Contract violated:** **Approve the iOS automatic-tracking product contract** permits automatic
confirmation when the vehicle-bound trigger, matching route corroboration, movement, and normal
completion are all present. Passive route-loss grace expiration finalizes using accepted evidence.
**Define trip review and odometer reconciliation** keeps a candidate pending when required evidence
is absent, not merely because passive grace was used.

**Exact correction:** Either make this example auto-confirm after grace expiration, or change the
review example to name a genuinely missing/failed condition, such as route corroboration never
arrived, unsafe lifecycle recovery, unusable distance, or abnormal completion. Make the audit match
that reason.

#### B3. Wireless CarPlay handoff asks the user to decide where the contract says to defer

**Artifact evidence:** Screen **43 · Wireless CarPlay handoff** says wireless CarPlay dropped,
Bluetooth took over, and asks **Continue same trip** or **End here** because it “looks like the same
drive.”

**Contract violated:** **Approve the iOS automatic-tracking product contract** defines the relevant
handoff deterministically: a Bluetooth disconnect while wireless CarPlay remains active is a
transport handoff, not an end signal, and must be deferred. A later CarPlay End Trip action or
passive CarPlay route loss controls finalization.

**Exact correction:** Redraw this as the approved state: Bluetooth disconnects while CarPlay remains
active; the same trip continues automatically with no user decision. Show the later branches:
delivered CarPlay End Trip finalizes, while passive CarPlay route loss starts the three-minute grace.
Do not infer continuity from a user guess.

#### B4. The local-only disclosure makes false absolute claims about export and location lifetime

**Artifact evidence:** Screen **15 · First run** says “Your records never leave the app” and “Nothing
is copied to another person,” while the same screen recommends Export. Screen **54 · Local data &
privacy** says “Nothing is uploaded, shared,” despite the supported Files/share handoff. Screen **16
· First run** says temporary precise location is collected “only between a Start and End trigger,”
omitting reconnect grace and safe lifecycle recovery.

**Contracts violated:** **Choose the private beta data and account boundary** permits an explicit
user-initiated export and requires accurate local-loss disclosure. **Set the beta privacy,
retention, and security boundary** says export is the only app-supported handoff and permits
temporary precise points during active calculation, reconnect grace, and safe recovery.

**Exact correction:** Qualify the claim: “The app does not automatically upload or share your data;
only you can send a copy through Export.” Describe temporary precise location as existing only while
needed for active distance calculation, reconnect grace, and safe lifecycle recovery, then deleted
at terminal disposition.

#### B5. Trip review copy misstates due-state and correction behavior

**Artifact evidence:** Screen **39 · No movement** says rejecting the unconfirmed candidate “removes
it from due-state calculations,” although the screen also correctly says nothing was added to the
odometer. Screen **47 · Reject trip** says confirmation needs no confirmation because it is
“reversible by a later odometer reading.”

**Contract violated:** **Define trip review and odometer reconciliation** says pending candidates do
not contribute to the estimated odometer, so rejecting one cannot remove mileage from due
calculation. It also says a confirmed trip is directly editable, reassignable, or rejectable with
audit history; a later manual reading establishes a new baseline but does not reverse or rewrite the
trip.

**Exact correction:** Change screen 39 to “Reject candidate — keeps the odometer and due states
unchanged.” On screen 47, remove the odometer-reading rationale. If direct confirmation remains,
explain that the confirmed trip can later be edited, reassigned, or rejected with every change kept
in its audit.

#### B6. Required maintenance edit/recalculation paths are asserted but not designed

**Artifact evidence:** Screen **28 · Schedule detail** and screen **30 · Maintenance record detail**
contain **Edit**, but the 60-screen inventory has no schedule-edit state, record-edit state, or
post-edit recalculation result. The record annotation only says Edit reuses the log form.

**Contract violated:** **Define maintenance records and due schedules** requires schedules and
records to remain editable and linked schedules to recalculate immediately after edits. The
iteration brief explicitly required connected detail/edit/delete flows and visible recalculation
consequences.

**Exact correction:** Add only two compact states using the existing forms: edit a combined
schedule and preview its changed controlling threshold/due state; edit a linked maintenance record
and show the immediate recalculation while older history remains unchanged. No new visual pattern
is needed.

#### B7. Three consequential tracking outcomes remain unrepresented

**Artifact evidence:** The artifact shows duplicate and conflicting **starts**, permission revocation,
and an active manual trip, but it does not show: an End Shortcut for the wrong vehicle failing
closed; a location-service failure with captured evidence preserved; or either Manual Stop result
(confirmed with usable movement/distance versus review-required with unusable distance).

**Contract violated:** **Approve the iOS automatic-tracking product contract** explicitly requires
wrong-vehicle ends to fail closed, location failures to stop accumulation and preserve a candidate,
and Manual Stop to confirm only with movement and usable distance.

**Exact correction:** Add three small states by reusing screens 38, 41, 42, 46, and 39: wrong-vehicle
end ignored with active trip unchanged; location failed with no inferred gap and review required;
Manual Stop success/review split. Do not redesign the active-trip screen.

#### B8. Export/deletion recovery introduces unsupported scope and overstates control of Shortcuts

**Artifact evidence:** Screen **59 · Export failed** offers **Export without diagnostics** and
**Export records only**, and screen **23 · Delete vehicle** offers **Export this vehicle first**.
Screen **34 · Stale binding** offers **Delete this trigger**, while screen **60 · Delete all data**
says “Triggers stop proposing trips.” User-created Shortcuts and Personal Automations exist outside
the app, so app-data deletion cannot guarantee their removal or disablement.

**Contracts violated:** **Set the beta privacy, retention, and security boundary** approves an
explicit complete local export containing all durable records, photos, configured identifiers, and
retained diagnostics. **Approve the iOS automatic-tracking product contract** makes user-created
Shortcuts/Personal Automations the trigger boundary and requires stale selections to fail closed and
direct the user to repair the saved Shortcut. **Define the garage and vehicle lifecycle contract**
defines profile deletion, not per-vehicle export.

**Exact correction:** Keep only the complete export. On insufficient space, offer free-space
guidance and retry; do not add partial or per-vehicle export in this MVP artifact. Replace “Delete
this trigger” with an explicit handoff to Shortcuts plus removal of the app’s local binding. For
Delete All Data, say local bindings are removed and any later stale Shortcut invocation fails closed
until the user removes or repairs the external automation.

### Targeted corrections that are not acceptance blockers

#### T1. Force-quit language is stronger than the approved promise

**Evidence:** Screen 07 says “a force-quit app cannot receive them.”

**Contract:** **Approve the iOS automatic-tracking product contract** says force-quit delivery is not
a supported promise; it does not require an absolute impossibility claim.

**Correction:** Say “Automations may not reach TorqueLog after force-quit; force-quit delivery is not
supported.” This is a copy correction on an existing screen.

#### T2. One setup privacy row omits review-required deletion

**Evidence:** Screen 07 says precise points delete after confirmed, rejected, or failed, omitting
review-required. Screens 09, 16, 39, and 54 include it correctly.

**Contract:** **Set the beta privacy, retention, and security boundary** includes confirmed,
review-required, rejected, and failed terminal dispositions.

**Correction:** Add “review-required” to screen 07.

#### T3. Due terminology is not fully consistent in visible copy

**Evidence:** Screen 11 visibly says “Overdue by 320 mi” while its annotation and other screens use
the canonical **DUE** label.

**Contract:** **Define maintenance records and due schedules** exposes current, due soon, and due.

**Correction:** Use `DUE · 320 mi past · mileage controls` consistently. “Past due” may remain an
explanation, not a fourth status.

#### T4. A route-fingerprint reassignment needs an explicit consequence

**Evidence:** Screen 08 offers **Reassign this setup to MX-5 Miata** but does not state whether an
existing association is displaced or require explicit confirmation of that move.

**Contract:** **Define the garage and vehicle lifecycle contract** allows one active vehicle
association per fingerprint and requires explicit reassignment.

**Correction:** Add a confirmation naming the old and new vehicle and state that the previous
association becomes inactive. This can reuse the existing alert pattern.

### Implementation annotations that can move to executable tickets

These do not require another visual-design pass once the blockers above are corrected:

- The standalone source is intentionally static: it has no real buttons, inputs, roles, ARIA,
  keyboard behavior, focus management, or live regions. Implement and test the written annotations
  rather than treating the canvas markup as accessible code.
- Verify Dynamic Type at accessibility sizes on the densest screens; the artifact states reflow
  behavior but does not render every size.
- Test contrast values, switch/keyboard traversal, native alert ordering, reduced motion, and
  announcement throttling with executable UI and VoiceOver.
- Add diagnostics-cleared empty state, export-cancel result, and Delete All Data progress/error
  handling to implementation tickets. The approved consequences are already described sufficiently
  for design acceptance.
- Specify analytics only if later allowed; the approved beta currently has no automatic telemetry.

## Coverage checklist

| Human review check | Result | Evidence / remaining action |
| --- | --- | --- |
| Looks and navigates like the imported Claude artifact | **Pass** | Four tabs, Garage hierarchy, hero dashboards, warm-neutral surfaces, cards, sheets, banners, and trip strip are preserved. |
| Required flows connect through success, review/failure, and destructive states | **Partial** | The map is complete and all 59 links resolve, but maintenance edit/recalculation and three required tracking outcomes are missing. |
| Unsupported guaranteed Bluetooth behavior, 30-minute grace, name/signal identity, While-Using-only permission, receipt/cost, and extra Quick Add claims removed | **Pass for revised iOS; warning for frozen Android** | Revised iOS corrects these. Unchanged Android examples still contain old claims and must remain explicitly non-canonical. |
| Best-effort Shortcut/Personal Automation setup is understandable, vehicle-bound, testable, repairable, and not guaranteed | **Partial** | Core setup is strong; fix absolute force-quit wording and external-Shortcut deletion claims. |
| Current/due-soon/due and mileage/time/combined calculations are understandable without color | **Pass with copy correction** | Strong schedule examples and annotations; normalize the remaining visible “Overdue” label to DUE. |
| Candidate, confirmed, estimated odometer, and append-only reading/audit consequences are distinct | **Partial** | Odometer screens are strong; fix active-trip inclusion, fully-evidenced review, candidate rejection, and correction rationale. |
| Local-only loss, temporary location, diagnostics, sensitive export, backups, vehicle deletion, and Delete All Data are explicit | **Partial** | Coverage is extensive, but first-run absolutes contradict Export and understate reconnect/recovery location lifetime. |
| Accessibility annotations cover VoiceOver, focus, Dynamic Type, targets, contrast, announcements, and reduced motion | **Pass as design annotation** | Rich annotations are present. Executable semantics and device validation belong in implementation tickets. |
| No precise routes/coordinates or raw identifiers on normal screens | **Pass** | No route playback is shown; opaque identifiers are isolated to Diagnostics. |
| Avoids accounts, cloud/sync, implementation architecture, and other unsupported scope | **Partial** | Accounts/cloud are avoided; partial/per-vehicle export and implied control over external Shortcuts are scope creep. |

## Follow-up prompt for Claude Design

```text
Make one targeted correction pass on the existing TorqueLog iOS Beta Flows artifact. Do not
redesign, restyle, reorder, or redraw screens that are not named below. Preserve the four tabs,
flow map, visual language, and all already-correct screens and annotations.

Correct only these unresolved items:

1. Screen 04: active-trip distance must not be included in estimated odometer; match screen 36.
2. Screens 06/48: a trip showing trigger + route corroboration + movement + normal grace-expiry
   completion should auto-confirm. Either show that success or change the review example to name a
   genuinely missing/failed confirmation condition, and make its audit consistent.
3. Screen 43: show the approved wireless-CarPlay handoff—Bluetooth disconnect while CarPlay remains
   active continues the same trip automatically. Later CarPlay End finalizes; passive CarPlay route
   loss starts the three-minute grace. Do not ask the user to guess.
4. Screens 15/16/54: qualify no-sharing claims around user-initiated Export, and include active
   distance calculation, reconnect grace, and safe lifecycle recovery in temporary precise-location
   lifetime.
5. Screens 39/47: rejecting an uncounted candidate leaves odometer/due unchanged; a confirmed trip
   is corrected through trip edit/reassign/reject with audit, not “reversed” by an odometer reading.
6. Add minimal schedule-edit and linked-maintenance-record-edit recalculation states using existing
   forms and success patterns.
7. Add minimal states for wrong-vehicle End failing closed, location failure preserving a
   review-required candidate, and Manual Stop success versus unusable-distance review.
8. Keep only complete export. Remove per-vehicle/partial export options. Clarify that deleting app
   data removes local bindings but cannot delete user-created Shortcuts/Personal Automations; later
   stale invocations fail closed and direct repair/removal in Shortcuts.
9. Copy-only fixes: soften force-quit wording to “not supported/may not deliver”; add
   review-required to screen 07 precise-point deletion; use visible DUE terminology consistently;
   confirm fingerprint reassignment by naming old and new vehicle and deactivating the old
   association.

Leave every other screen unchanged. Update the connected flow map only for the minimal added states.
```

---

## Final correction-pass verification — 2026-07-24

### Artifact identity and structural verification

- Reviewed file: `/Users/ragessler/Downloads/TorqueLog iOS Beta Flows (standalone).html`
- Verified SHA-256:
  `93703c747860487c44eff412c02f1a40707d5bf98f91d6c2fe5105df8bdcbbec`
- Prior reviewed SHA-256:
  `b97ebf0bd65678f2e1eab095a3e160e8e11f1b9fdff873ba99e0ab6460927db3`
- Decoded embedded template: 3,674 lines.
- Screen/state targets: **66**, up from 60.
- Internal flow-map links: **65**.
- Missing link targets: **0**.
- Duplicate screen IDs: **0**.
- Four-tab structure: **preserved** — Garage, Activity, Due, Settings.
- Original visual language: **preserved** — vehicle-led hierarchy, hero imagery, warm-neutral canvas,
  soft grouped cards, bottom sheets, status banners, compact metadata, and persistent trip strips.
- Already-approved screens: no structural or visual redesign regression found. Frozen Android examples
  remain visibly marked unchanged and non-canonical for this iOS review.

### B1–B8 acceptance-blocker verification

| Finding | Result | Correction-pass evidence | Remaining action |
| --- | --- | --- | --- |
| **B1 — Active trip included in estimated odometer** | **Pass** | Screen 04 now says “Active trip not included until it is confirmed · baseline 83,940 mi · Jul 2,” matching the manual-trip treatment. The old phrase remains only in the frozen Android example. | None for revised iOS. |
| **B2 — Fully evidenced passive completion still sent to review** | **Fail — unresolved blocker** | Screens 06/47 now say the End Trip Shortcut never ran and grace expiry means “normal completion could not be confirmed.” However, the approved automatic-tracking contract separately treats usable passive route loss plus grace expiry as a supported finalization path. The screen still displays trigger, route, and movement evidence and does not identify a failed route-loss finalization condition. | Either auto-confirm this usable passive-route-loss example, or name an actual failure such as route corroboration missing, unusable route loss, unsafe recovery, or incomplete evidence. Do not define normal completion as End Shortcut delivery only. Make screen 48’s audit use the same reason. |
| **B3 — Wireless CarPlay handoff asks the user to decide** | **Pass** | Screen 43 now says Bluetooth dropped while wireless CarPlay stayed connected, continues the same trip automatically, and branches later to delivered CarPlay End or passive CarPlay route loss with three-minute grace. No user decision remains. | Rename the stale screen heading “continue?”; behavior is correct. |
| **B4 — False export absolutes and incomplete location lifetime** | **Pass** | Screen 15 now qualifies that data leaves only through user-initiated Export. Screens 16 and 54 now include active distance, three-minute grace, and safe interruption/recovery use, plus terminal precise-point deletion. | Prefer removing the residual phrase “between a Start and End trigger” in implementation copy because some approved terminal paths have no delivered End, but the full on-screen explanation now states the actual lifecycle. |
| **B5 — Candidate rejection and correction semantics** | **Pass** | Screen 39 says rejection changes nothing because the candidate never counted. Screen 47 now says confirmed trips are corrected through distance edit, reassignment, or rejection with audit, never undone by an odometer reading. | None. |
| **B6 — Maintenance edit/recalculation states missing** | **Fail — regression blocker** | Screens 61 and 62 were added and use the correct existing forms and before/after pattern, but both calculations are internally wrong. Screen 61 sets 7,500 mi or 6 months from Jan 18 at 78,890 mi: mileage is due at 86,390 mi (**2,178 mi** remain, not 4,178), while the time threshold was already reached on Jul 18, so the schedule remains DUE with time controlling—not CURRENT with mileage controlling. Screen 62 resets from Feb 2 at 79,450 mi to 86,950 mi or Aug 2: **2,738 mi** remain, not 238, and on Jul 24 the DUE SOON state is caused by the time threshold being 9 days away. | Correct both arithmetic examples, controlling-threshold labels, and resulting due states, or adjust fixture inputs so every displayed outcome is mathematically valid. Recheck both the final-10% mileage rule and final-30-days time rule. |
| **B7 — Wrong End, location failure, and Manual Stop outcomes missing** | **Pass** | Screens 63–66 add wrong-vehicle End failing closed with the active trip unchanged, location failure preserving a review-required candidate without inferred distance, Manual Stop confirmation with usable movement/distance, and Manual Stop review with unusable distance. | None. |
| **B8 — Partial export and external-Shortcut control claims** | **Fail — unresolved blocker** | Screen 59 removes partial-export alternatives and offers free-space guidance plus retry. Screen 23 now points to the complete export. Screen 60 correctly explains that external Shortcuts remain and stale invocations fail closed. But screen 34 still offers “Delete this trigger — Stop the Shortcut from proposing a trip,” and screen 60’s inventory still says “Triggers stop proposing trips,” contradicting its later explanation that the app removes only local bindings. | Replace screen 34’s action with “Open Shortcuts to remove automation” plus a distinct local-binding removal if needed. Change screen 60’s inventory row to “Local tracking bindings removed; user-created Shortcuts remain and later invocations fail closed.” |

**Unresolved acceptance blockers after the correction pass: 3 — B2, B6, and B8.**

### T1–T4 targeted-correction verification

| Finding | Result | Correction-pass evidence | Remaining action |
| --- | --- | --- | --- |
| **T1 — Absolute force-quit claim** | **Pass** | Screen 07 now says force-quit delivery is unsupported and automations may not deliver, rather than claiming technical impossibility. | None. |
| **T2 — Review-required omitted from precise-point deletion** | **Pass** | Screen 07 now lists confirmed, review-required, rejected, and failed. | None. |
| **T3 — Visible Overdue terminology** | **Fail — targeted copy correction** | Screen 11’s revised iOS row still visibly says “Overdue by 320 mi” even though its VoiceOver annotation and other revised iOS screens use DUE. | Change visible rows to `DUE · 320 mi past · mileage controls` and `DUE · 2 months past · time controls`. Frozen Android wording remains out of scope. |
| **T4 — Explicit route-fingerprint reassignment consequence** | **Partial fail — targeted interaction correction** | Screen 08 now names both vehicles and states that reassignment deactivates GX 460 and binds MX-5 Miata. The action is explicit, but the requested confirmation state before moving the one-active association is still absent. | Reuse an existing confirmation alert: name old and new vehicles, state the old association becomes inactive, then require confirmation before reassignment and rerun setup test. |

### Regression findings

#### High — maintenance recalculation fixtures are mathematically invalid

The new screens 61 and 62 introduce incorrect remaining-mileage values and incorrect controlling-
threshold explanations. Screen 61 also derives the wrong due state because its six-month threshold
has already passed. This is an acceptance regression because these screens were added specifically
to prove deterministic recalculation under **Define maintenance records and due schedules**. Exact
corrections are captured under B6 above.

#### Low — stale annotation on export failure

Screen 59 correctly removed the partial-export buttons, but its interaction annotation still says
“Smaller-scope retries are offered as concrete options.” Remove that sentence or replace it with the
actual free-space-and-retry behavior.

#### Low — stale screen title on corrected CarPlay handoff

Screen 43 is still titled “Wireless CarPlay handoff — continue?” even though the corrected design
properly presents no decision. Rename it “Wireless CarPlay handoff — continues automatically.”

### Final verdict

**Iterate again.**

The correction pass preserves the accepted visual system and resolves most prior findings, including
B1, B3, B4, B5, B7, T1, and T2. It cannot yet be accepted because:

1. passive route-loss completion is still incorrectly equated with missing normal completion;
2. the new maintenance-edit screens contain invalid arithmetic and a wrong due state; and
3. two visible actions/labels still imply that deleting app data controls user-created Shortcuts.

The next pass should change only screens 06/48, 11, 34, 43’s title, 59’s annotation, 60, 61, 62,
and add the small reassignment confirmation for screen 08. No other visual or structural changes are
needed. Accessibility behavior still requires executable implementation and physical VoiceOver,
Dynamic Type, contrast, focus, and reduced-motion validation as already noted above.

### Final targeted prompt for Claude Design

```text
Make one final correction-only pass on the existing TorqueLog iOS Beta Flows artifact. Preserve the
four tabs, flow map, visual language, and every screen not explicitly named below. Do not redesign,
restyle, reorder, or expand scope.

1. Screens 06 and 48: keep this as a candidate-trip review example, but use an actual missing
automatic-confirmation condition. State consistently that route corroboration never arrived even
though the vehicle-bound trigger and movement were captured. Do not say passive route-loss grace
expiry itself means normal completion failed: usable passive route loss followed by three-minute
grace expiry is a supported finalization path and may auto-confirm when all required evidence exists.

2. Screen 61: correct the schedule-edit calculation. With baseline Jan 18 at 78,890 mi, intervals of
7,500 mi or 6 months, current date Jul 24, and current odometer 84,212 mi: mileage is due at 86,390 mi
(2,178 mi remaining), while time was due Jul 18. Result is DUE with time controlling, 6 days past.
Do not show CURRENT or 4,178 mi remaining.

3. Screen 62: correct the linked-record-edit calculation. With baseline Feb 2 at 79,450 mi, intervals
of 7,500 mi or 6 months, current date Jul 24, and current odometer 84,212 mi: mileage is due at
86,950 mi (2,738 mi remaining), while time is due Aug 2 (9 days remaining). Result is DUE SOON with
time controlling. Do not show 238 mi remaining.

4. Screen 34: replace “Delete this trigger” and “Stop the Shortcut from proposing a trip.” The app
may remove its local tracking binding, but it cannot delete or disable a user-created Shortcut or
Personal Automation. Offer “Open Shortcuts to remove automation” and, if needed, a separate local-
binding removal action. Later stale invocations must fail closed and direct repair/removal.

5. Screen 60: replace “Triggers stop proposing trips” with “Local tracking bindings removed;
user-created Shortcuts remain and later stale invocations fail closed.” Keep the existing explanatory
copy consistent with that inventory row.

6. Screen 11: use the canonical visible labels `DUE · 320 mi past · mileage controls` and
`DUE · 2 months past · time controls`. Do not introduce OVERDUE as a fourth state.

7. Screen 08: add a confirmation alert before route-association reassignment. Name GX 460 as the old
vehicle and MX-5 Miata as the new vehicle, state that the GX 460 association becomes inactive, and
require confirmation before reassignment and rerunning the setup test.

8. Copy cleanup only: rename screen 43 to “Wireless CarPlay handoff — continues automatically.” On
screen 59 remove the stale annotation claiming smaller-scope export retries are offered; the approved
behavior is free-space guidance and retry of the complete export only.

Update the flow map only for the screen 08 confirmation. Leave all other screens and annotations
unchanged.
```

---

## Final acceptance verification — 2026-07-24

This section independently verifies the newly overwritten artifact and supersedes earlier verdicts
only for the exact hash below. Earlier review sections remain as provenance.

### Artifact identity and integrity

- Reviewed file: `/Users/ragessler/Downloads/TorqueLog iOS Beta Flows (standalone).html`
- Verified SHA-256:
  `5d8f4bf26aaae6d1f42b8512ebc3c6d372d721da9b6357a54511f6b89c1182e4`
- Decoded embedded template: **3,682 lines**.
- Screen/state targets: **66**.
- Internal flow-map links: **65**.
- Missing link targets: **0**.
- Duplicate screen IDs: **0**.
- Four primary tabs: **preserved** — Garage, Activity, Due, Settings.
- Original visual language: **preserved** — vehicle-led Garage hierarchy, hero imagery,
  warm-neutral canvas, soft grouped cards, fine dividers, bottom sheets, status banners, compact
  metadata, and persistent trip strips.
- Unsupported iOS MVP scope regression: **none found**. Fuel, parts, documents, cost, and receipt
  attachment remain absent from revised iOS screens. Their appearances are confined to explicitly
  frozen, non-canonical Android examples.

### Final targeted prompt verification

| Targeted item | Result | Exact artifact evidence |
| --- | --- | --- |
| **Screens 06/48 — route-corroboration review semantics** | **Pass** | Screen 06 now states “Route corroboration never arrived,” labels the trip `3 OF 4 CONDITIONS MET`, and separately confirms trigger, movement, and clean grace finalization. Screen 48 consistently records `NOT CORROBORATED`, “Route corroboration — Never arrived,” and “Ended by — Reconnect grace after passive route loss.” Grace expiry is no longer presented as the failed condition. |
| **Screen 61 — exact schedule-edit arithmetic and state** | **Pass** | Baseline is Jan 18 at 78,890 mi; mileage due is 86,390 mi with **2,178 mi left**; six months was due Jul 18; on Jul 24 the result is `DUE · time controls · 6 days past`. The annotation also announces the controlling-threshold change from mileage to time. |
| **Screen 62 — exact linked-record arithmetic and state** | **Pass** | Edited baseline is Feb 2 at 79,450 mi; next due is 86,950 mi or Aug 2; on Jul 24 the result is `DUE SOON · time controls · 9 days left`. The prior incorrect 238-mi claim is absent; the implied mileage remainder is correctly 2,738 mi. |
| **Screen 34 — external Shortcut boundary** | **Pass** | The screen now offers `Open Shortcuts to remove the automation` and separately `Remove local binding only`. It explicitly says the app cannot delete or disable a user-created Shortcut/Personal Automation and that later stale invocations fail closed. |
| **Screen 60 — Delete All Data Shortcut boundary** | **Pass** | The inventory now says `Local tracking bindings removed; your Shortcuts remain and later stale invocations fail closed`. Supporting copy consistently says user-created Shortcuts remain in Shortcuts and later invocations find no vehicle and direct repair/removal. |
| **Screen 11 — canonical visible DUE labels** | **Pass** | Revised iOS rows visibly read `DUE · 320 mi past · mileage controls` and `DUE · 2 months past · time controls`. CURRENT and DUE SOON remain distinct; no fourth OVERDUE state appears in revised iOS. |
| **Screen 08 — explicit reassignment confirmation and flow connection** | **Pass** | The confirmation names GX 460 as the old association and MX-5 Miata as the new one, states GX becomes inactive, and requires `Reassign and rerun test` before automatic tracking can enable. The flow map now labels node 08 `Test mismatch · reassign confirm`; its target resolves. |
| **Screen 43 title** | **Pass** | Title is now `Wireless CarPlay handoff — continues automatically`; the screen still continues automatically while CarPlay remains connected and separates delivered End from passive route-loss grace. |
| **Screen 59 annotation** | **Pass** | The stale smaller-scope-export annotation is gone. It now says free-space guidance is quantified and Retry always retries the complete export; partial exports do not exist. |

### Prior passing behavior regression check

| Prior finding | Result | Evidence retained |
| --- | --- | --- |
| **B1 — active trip excluded from estimated odometer** | **Pass** | Revised iOS screen 04 still says active trip distance is not included until confirmed. |
| **B3 — automatic wireless-CarPlay handoff** | **Pass** | Screen 43 retains automatic continuation with no user decision and the approved End/grace branches. |
| **B4 — accurate Export and precise-location disclosure** | **Pass** | Screen 15 limits data handoff to user-initiated Export; screens 16 and 54 retain active-distance, reconnect-grace, safe-interruption/recovery, and terminal deletion explanations. |
| **B5 — candidate rejection and trip correction semantics** | **Pass** | Screen 39 says an uncounted candidate changes neither odometer nor due states; screen 47 retains edit/reassign/reject-with-audit correction and says an odometer reading never undoes the trip. |
| **B7 — required tracking failure/manual outcomes** | **Pass** | Screens 63–66 remain present and linked: wrong-vehicle End fails closed, location failure preserves review evidence, Manual Stop confirms usable distance, and unusable distance remains review-required. |
| **T1 — force-quit promise level** | **Pass** | Screen 07 still says force-quit delivery is unsupported and automations may not deliver, not that delivery is technically impossible. |
| **T2 — precise-point terminal dispositions** | **Pass** | Screen 07 still lists confirmed, review-required, rejected, and failed. |

### Regression findings

**None.**

The correction pass changed only the requested behavior/copy and retained the accepted four-tab
structure, visual system, connected flow-map topology, privacy boundary, canonical terminology, and
revised iOS MVP scope. All 65 internal links resolve to unique screen IDs.

### Final verdict

**Accept with implementation annotations.**

**Unresolved acceptance blockers: 0.** No further Claude Design iteration is required for this
artifact hash.

The following validation belongs in executable implementation tickets rather than another design
pass:

- Implement and test real semantic controls: VoiceOver label, role, value, hint, heading structure,
  error association, selected/disabled state, and meaningful grouping. The standalone canvas is
  static and does not itself provide buttons, inputs, ARIA, or live regions.
- Validate focus order, modal focus trapping/return, native alert order, status announcements, and
  announcement throttling with VoiceOver on supported physical iPhones. Live distance and countdown
  ticks must not announce continuously.
- Exercise Dynamic Type through accessibility sizes, scrolling/reflow, minimum 44×44 pt targets,
  visible keyboard/switch focus, non-color state communication, and measured contrast.
- Verify reduced-motion behavior for sheets, status indicators, and progress UI.
- Validate Precise Always permission transitions, Shortcuts/Personal Automation handoffs,
  background/locked delivery, force-quit limitations, route corroboration, wireless-CarPlay
  transport handoff, three-minute reconnect grace, and 12-hour stop in development builds on
  physical devices.
- Add deterministic executable tests for schedule mileage/time arithmetic, due-soon thresholds,
  odometer reconciliation, pre-baseline trip edits, and linked-record recalculation.
- Validate export preparation, Files/share cancellation and generated-archive cleanup,
  insufficient-space recovery, diagnostics retention/cap/clear, and Delete All Data teardown and
  first-run return on-device.
