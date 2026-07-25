# Claude design iteration brief

## Purpose and sources

This brief reviews the existing imported Claude artifact in
`docs/design/maintenance-tracker-mockups.html`. It is an iteration brief, not a request to replace
that design.

The review compares the artifact against these approved product contracts:

- **Choose the private beta data and account boundary**
- **Define maintenance records and due schedules**
- **Define the garage and vehicle lifecycle contract**
- **Define trip review and odometer reconciliation**
- **Approve the iOS automatic-tracking product contract**
- **Set the beta privacy, retention, and security boundary**

`CONTEXT.md` supplies the canonical term **vehicle profile**: a manually entered nickname, year,
make, model, current odometer, and optional hero photo. Avoid “car record” and “VIN profile.”

### Assessment labels

- **Represented correctly** means already represented correctly: the artifact expresses the
  approved behavior well enough to preserve.
- **Needs correction** means represented but conflicting: a screen or pattern exists, but its
  behavior, claim, timing, terminology, or scope conflicts with an approved contract.
- **Missing flow** means a missing screen or connected flow.
- **Missing state** and **Missing detail** are subtypes of the same final category: missing state,
  content, interaction, edge-case, or accessibility detail within a represented flow.

## 1. Current Claude design inventory

### Application structure and navigation

- Four persistent primary tabs: **Garage**, **Activity**, **Due**, and **Settings**.
- Garage is the entry point and supports multiple vehicle cards, a selected-vehicle dashboard, an
  empty state, and a persistent active/paused-trip strip above the tab bar.
- Vehicle dashboards combine hero imagery, current estimated odometer, tracking status,
  maintenance summaries, recent activity, and compact quick actions.
- Activity is a chronological cross-vehicle timeline with category filters.
- Due is a cross-vehicle maintenance list grouped by vehicle, with inline **Log** actions.
- Settings is present in navigation, but no Settings screen is designed.
- Modal sheets/forms are used for quick add, trip review, Bluetooth setup, permission explanation,
  and logging service.
- Parallel iOS and Android compositions use the same information architecture with platform-shaped
  controls and spacing.

### Screens currently present

1. **Garage** — two vehicle cards, due counts, estimated odometers, connection/tracking state, add
   vehicle action, and active-trip strip.
2. **Quick Add** — fuel fill-up, service record, odometer reading, manual trip, part purchase,
   document, and receipt/insurance/registration actions.
3. **Disconnected vehicle dashboard** — Miata hero, odometer summary, Bluetooth state,
   maintenance, recent activity, and quick actions.
4. **Active-tracking vehicle dashboard** — GX hero, live distance/time/segment, odometer,
   maintenance, activity, and persistent trip strip.
5. **Paused trip** — Bluetooth-disconnect explanation, segment history, countdown, end-now and
   keep-waiting actions, and exclusion from current odometer.
6. **Trip review** — review reason, distance, time, segment count, proposed vehicle, resulting
   odometer, accept, edit-distance, and reject actions.
7. **Bluetooth setup** — explanatory steps, nearby-device scan, device selection, automatic
   tracking toggle, and assignment.
8. **Duplicate Bluetooth name** — collision warning, signal/name comparison, and selected-device
   action.
9. **Location permission** — pre-permission explanation followed by only once/while-using/deny
   choices.
10. **Bluetooth-off error** — global warning, Settings action, manual fallback message, and disabled
    tracking states on vehicle cards.
11. **Due maintenance** — due summary grouped by vehicle, mileage/time examples, last completion,
    intervals, Log actions, and Edit schedules entry.
12. **Log service form** — vehicle, service, date, mileage, cost, notes, receipt attachment, reset
    schedule, and projected next due.
13. **Activity timeline** — accepted trip, fuel, service, part, document, and odometer events.
14. **Empty garage** — add-vehicle action and tracking explainer.

### Recurring interaction patterns

- Large hero-photo vehicle cards with due/status badges.
- Rounded grouped lists and cards; bottom sheets for focused decisions.
- Inline status banners for active, paused, unavailable, warning, and review states.
- Compact metadata lines pairing a primary value with provenance, date, or consequence.
- Primary filled action, secondary outline/text action, and destructive text action.
- Cross-platform bottom navigation and platform-specific permission/control styling.

### Visual language to preserve

- Premium, restrained vehicle-journal presentation with generous space and prominent photography.
- Warm neutral surfaces, soft elevation, rounded cards, fine dividers, and quiet secondary text.
- iOS uses white/soft-gray surfaces and blue actions; Android uses warm off-white surfaces,
  lavender accents, outlined cards, and purple actions.
- Status color is paired with text rather than used alone in the strongest existing states.
- Typography emphasizes large vehicle/page titles, compact uppercase/status labels, and readable
  two-level list rows.

## 2. Approved-contract coverage matrix

### First run and local-only disclosure

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| The private beta has no app account, sign-in, cloud service, sync, sharing, app-level backup, recovery, or cross-device continuation. | No account UI appears. Empty Garage immediately invites adding a vehicle. | **Missing flow** | Add a required first-run disclosure before saving a vehicle profile. State plainly that the beta is local-only and has no account, sync, app-level backup, recovery, or cross-device continuation. |
| Uninstall, device loss/replacement, or local-data loss can be unrecoverable; this must be disclosed before meaningful history or photos are saved. | No disclosure appears before **Add a vehicle**, photo use, or tracking setup. | **Missing flow** | Add acknowledgment before first save, and keep the same disclosure reviewable from Settings. Do not promise future migration. |
| First-run disclosure covers temporary precise location, retention, export, backup limitations, deletion, and unrecoverable loss. | Location is explained only inside Bluetooth setup as “while connected”; retention, export, backup, and deletion are absent. | **Missing detail** | Use a concise, scannable disclosure with links to details. Repeat precise background-location context during tracking setup. |
| Automatic tracking is best effort, with manual trip and odometer fallbacks. | Empty Garage says mileage “tracks itself every time you drive.” Bluetooth setup says tracking “starts automatically.” | **Needs correction** | Replace certainty with best-effort language: automations may run when iOS delivers them; force-quit and universal delivery are not promised. Keep manual trip and odometer actions visible. |

### Garage, create, edit, archive, and delete

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Support multiple vehicle profiles. | Garage shows GX 460 and MX-5 Miata, with individual odometers, due counts, imagery, and tracking states. | **Represented correctly** | Preserve the two-card Garage, cross-vehicle status scan, and selected-vehicle navigation. Call these **vehicle profiles** in explanatory copy. |
| Create a vehicle profile with nickname, year, make, model, and current odometer only; hero photo is optional. | **Add a vehicle** exists, but no creation flow is shown. Existing cards emphasize model names; nickname entry is not demonstrated. | **Missing flow** | Add a connected create flow containing the five required fields and optional hero photo. Do not require trigger setup during profile creation. |
| Edit nickname, year, make, model, and hero photo later. | No vehicle-profile edit screen exists. | **Missing flow** | Add an Edit vehicle profile screen reached from the existing dashboard overflow/settings pattern. |
| Current odometer changes only through a dated manual reading or reviewed trip. | Dashboards have **Update** and Quick Add has **Odometer reading**, but no reading flow is shown. | **Missing detail** | Route every odometer update through the dated reading flow; do not make the dashboard number directly editable. |
| Archive hides the profile, disables its trigger association, and retains history. | No archive action, archived list, or retained-history state exists. | **Missing flow** | Add archive confirmation and an archived-vehicle management state in Settings or Garage management. Explain retained history and disabled automatic setup. |
| Permanent deletion explicitly confirms removal of the vehicle and all associated local data. | No permanent vehicle deletion exists. | **Missing flow** | Add a separate destructive confirmation that distinguishes permanent deletion from archive. |
| Archive/delete is blocked during an active trip until the user ends or discards it. | Active and paused trip states exist, but no lifecycle action demonstrates the block. | **Missing state** | Annotate disabled archive/delete actions and add a blocking message with **Return to active trip**, **End trip**, and, where appropriate, **Discard trip**. |

### Vehicle detail and optional photo

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Each profile has clear identity and current odometer. | Both vehicle dashboards prominently identify make/model and estimated odometer; Garage distinguishes two vehicles. | **Represented correctly** | Preserve hero-led dashboards and compact Garage summaries. Add nickname where it helps distinguish similar vehicles. |
| Hero photo is optional. | Every populated vehicle shown has a hero image; there is no no-photo profile state. | **Missing state** | Add a polished neutral no-photo treatment using the same card proportions, plus add/change/remove-photo actions in Edit vehicle profile. |
| Imported photo is an app-owned, size-limited copy with embedded metadata removed; no upload or Photos URL retention. | Photo handling is not annotated. | **Missing detail** | Add concise import privacy copy/annotation. Do not introduce cloud upload, gallery-link, or photo-sharing claims. |
| Trigger identity is a configured route association, not a user-visible stable hardware identity. | Dashboard says “GX Bluetooth”; setup scans nearby devices and represents name/signal matching as identity. | **Needs correction** | Keep normal screens human-readable, but rewrite setup around a vehicle-bound Shortcut/automation plus observed route corroboration. Do not expose or promise a stable hardware identifier. |

### Maintenance schedules, records, and due explanations

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Built-in generic templates create editable per-vehicle schedules; custom schedules are supported. | Due includes **Edit schedules**, but no templates, schedule list/editor, or custom-schedule flow. | **Missing flow** | Add schedule setup from templates, custom schedule creation, schedule detail/edit, and delete confirmation using existing grouped-list/form patterns. |
| A schedule requires mileage, time, or both; when both exist, the first threshold reached controls due. | Due shows mileage and time examples but no combined schedule or rule explanation. | **Missing detail** | Add mileage-only, time-only, and combined examples. On combined schedules, explain both thresholds and which one currently controls. |
| A new schedule defaults its baseline to today and current odometer; users may supply last known service date and/or odometer. | No schedule creation/baseline UI exists. | **Missing flow** | Add baseline fields with visible defaults and optional last-known values. |
| Expose **current**, **due soon**, and **due** with explainable thresholds. Due soon is final 10% of mileage interval or final 30 days; either condition applies to combined schedules. | Due uses “overdue,” “due in 480 mi,” “due Oct 2026,” and “due in 3 weeks”; it does not label all three canonical states or explain thresholds. | **Needs correction** | Preserve list density and status dots, but use canonical state labels and expandable/plain-language calculations. Show at least one current, due-soon, due, and combined-threshold example. |
| Completed record requires service name, date, and odometer; note is optional. | Log service contains service, date, mileage, and notes. | **Represented correctly** | Preserve these fields and existing prefill explanation, while making required/optional status explicit. |
| A record may stand alone or link to exactly one schedule; a linked record resets that schedule. | Form has a **Reset schedule** control and projected next due, but linkage semantics are unclear. | **Missing detail** | Replace the ambiguous toggle with an optional single schedule link. Preview the reset consequence; allow standalone history. |
| Completed records do not support receipt/document attachments. | Log service includes **Attach receipt**. | **Needs correction** | Remove receipt/document attachment from the maintenance record flow. |
| Cost is not part of the approved completed-record contract. | Log service requires/displays cost, and Activity includes service cost. | **Needs correction** | Remove cost from the MVP maintenance record flow rather than expanding the approved schema. |
| Newer linked completions remain the baseline; older history does not displace it. Edits recalculate immediately. | Activity shows history, but no edit or out-of-order consequence is shown. | **Missing flow** | Add maintenance record detail/edit and a recalculation result state; preserve old records in history. |
| Deleting a schedule retains records as standalone; deleting a linked record recalculates from the newest remaining completion or initial baseline. | No delete flows or consequences exist. | **Missing flow** | Add separate confirmations with exact retention/recalculation consequences. |

### Trip tracking setup, permissions, and Shortcut readiness

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Vehicle-bound normal Shortcuts and Personal Automations are the only automatic start/end trigger boundary; the app does not claim system-wide Bluetooth observation. | Bluetooth setup performs an in-app nearby-device scan and says a connection starts tracking. | **Needs correction** | Retain the sheet/form visual pattern, but replace the setup model with guided creation/verification of vehicle-bound Start/End Shortcuts and required Run Immediately automations. |
| Automatic actions may work while backgrounded/locked when iOS delivers them; force-quit, exact timing, and universal delivery are not promised. | Setup and empty state imply reliable automatic tracking every drive. | **Needs correction** | Add concise best-effort promise copy before enablement and in setup help. |
| Ready requires Precise Always Location, vehicle-bound Shortcut, required Run Immediately automations, in-app setup test, user-confirmed checklist, and route observation/binding where supported. | Location screen offers only Allow Once/While Using; there is no Shortcut setup, checklist, setup test, or route-binding confirmation. | **Missing flow** | Create a progress/checklist flow with incomplete, blocked, testing, passed, and ready states. Automatic tracking remains off until every applicable step is complete. |
| Bluetooth-only and wireless-CarPlay setup binds a Personal Automation to the exact selected Bluetooth device and a normal Shortcut to an immutable vehicle choice. | Duplicate-name flow relies on display name and signal strength. | **Needs correction** | Use iOS Personal Automation’s selected-device step; show the chosen vehicle in the normal Shortcut. Remove name/signal matching as product identity. |
| Wired CarPlay supports one active automatic vehicle assignment at a time; another wired vehicle requires manual start or reassignment. | No CarPlay setup or multi-vehicle wired limitation exists. | **Missing flow** | Add a minimal CarPlay setup branch, assignment state, reassignment confirmation, and manual fallback explanation. |
| Configured Shortcut proposes attribution; matching configured route corroborates it. Unknown/conflicting evidence fails closed, and route evidence never starts a trip by itself. | Current setup treats Bluetooth identity as sufficient to start/attribute a trip. | **Needs correction** | Explain Shortcut attribution plus route corroboration without showing raw identifiers. Add setup-test mismatch and repair states. |
| Archived, deleted, unknown, or reassigned saved vehicle choices create no trip and direct repair of the Shortcut. | No stale-Shortcut recovery exists. | **Missing state** | Add a human-readable launch failure with the affected vehicle and **Repair Shortcut** action. |

### Active, manual, reconnect, and failure tracking

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Only one active logical trip exists on the device. Duplicate same-vehicle starts are idempotent; other-vehicle starts and wrong-vehicle ends fail closed. | One persistent active trip is shown, but duplicate/conflicting commands are not covered. | **Missing state** | Preserve the global trip strip. Add duplicate-start no-op feedback and conflicting start/end failures that leave the active trip unchanged. |
| Automatic confirmation requires configured vehicle trigger, matching route corroboration, movement confirmation, and normal completion. | Setup says Bluetooth connection plus movement is enough; active state does not surface corroboration or completion quality. | **Needs correction** | Update explanatory content and completion summary to show the four evidence categories in human language. Do not expose raw identifiers. |
| Movement confirms at 3 m/s or 100 m displacement; no movement within 10 minutes stops tracking and retains a failed candidate for review. | Setup says “while connected and moving” but has no threshold, timeout, failed candidate, or review path. | **Missing state** | Add waiting-for-movement and no-movement failure states, with captured evidence retained for review but no counted mileage. |
| Delivered vehicle-bound End Trip Shortcut normally finalizes immediately. Passive route loss creates a three-minute reconnect grace; matching reconnection resumes the same trip. | Paused trip uses a 30-minute grace and the review sheet says disconnect finalized after 30 minutes. | **Needs correction** | Keep the paused/reconnect composition, change it to a three-minute grace, distinguish explicit End Shortcut from passive route loss, and avoid exact background-finalization promises. |
| Wireless-CarPlay Bluetooth disconnect may be a transport handoff, not an end; CarPlay end or passive route loss determines the next state. | No wireless-CarPlay handoff state exists. | **Missing state** | Add a compact “connection changed; trip continues” state and subsequent CarPlay end/reconnect outcomes. |
| Missing end/route-loss evidence stops automatic tracking after 12 hours and leaves review required; it can never auto-confirm. | No long-running timeout state exists. | **Missing state** | Add next-launch/review copy for the 12-hour safety stop. |
| Permission revocation, location failure, process termination, or unsafe resume stops accumulation, preserves derived evidence as a candidate, explains the failure on next launch, and never infers missing distance. | Bluetooth-off is the only failure. It marks tracking unavailable but does not show evidence recovery/review. | **Missing flow** | Add permission-revoked, location-failed, interrupted/resume-unsafe, and next-launch recovery states with manual correction/rejection. |
| Manual Start selects a vehicle and bypasses route identity; Manual Stop confirms only with movement and usable distance, otherwise requires review. | Quick Add includes **Manual trip** but has no start/select/active/stop/failure flow. | **Missing flow** | Connect Manual trip to vehicle selection, active state, stop result, and unusable-distance review. Keep the same persistent trip strip. |

### Trip review, reassignment, edit, reject, and audit

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Candidate trips remain pending unless all automatic-confirmation conditions are satisfied. | Trip review clearly marks a trip ready for review and keeps it out of odometer until accepted. | **Represented correctly** | Preserve the review sheet, explicit consequence, and pending-until-action model. Correct the reason/timing where needed. |
| User may reassign vehicle, edit total distance, reject, or confirm. | Review has a vehicle row, **Edit distance**, **Reject trip**, and **Accept trip**. | **Missing detail** | Make the vehicle row an explicit reassignment control; add connected edit/reassign confirmations and validation. Use **Confirm trip** for the canonical disposition, with “confirmed trip” in resulting history. |
| Preserve captured estimate and every user change as audit history. | Segment count and proposed distance are shown, but no original-vs-edited value or change history exists. | **Missing flow** | Add a trip detail/audit view showing captured estimate, proposed vehicle, quality/corroboration summary, disposition, and each user change. No precise route playback. |
| Confirmed distance contributes to estimated odometer and recalculates mileage-based due states immediately. | Review previews the new odometer; Activity shows accepted trip changing it. Due impact is not shown. | **Missing detail** | Preserve consequence preview, rename to confirmed terminology, and show due-state recalculation in the success state when affected. |
| Edits to pre-baseline trips remain historical and do not change current mileage. | No pre-baseline edit state exists. | **Missing state** | Add explanatory feedback on old-trip edits: audit history changes, current odometer does not. |
| Finalized/review-required/rejected/failed records retain derived evidence, not precise points or coordinates. | Review has time, segments, distance, and vehicle; it does not show a map. | **Represented correctly** | Preserve summary evidence and no-map treatment. Add quality/corroboration/failure reason as human-readable evidence. |

### Manual odometer reconciliation

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| A dated manual odometer reading is append-only and authoritative. | Quick Add and dashboard **Update** entry points exist; Activity shows “Odometer confirmed.” No form is shown. | **Missing flow** | Add the dated reading form, confirmation, and reading-history detail. Never edit an existing reading in place. |
| A reading becomes the displayed baseline without rewriting historical trips. | Dashboard distinguishes estimated and last confirmed; Activity says the estimate was 27 mi high. | **Represented correctly** | Preserve this provenance language and make the no-rewrite consequence explicit at save. |
| A correction is another reading; lower values require warned confirmation. | No correction/lower-reading state exists. | **Missing state** | Add lower-than-current warning with clear date/value comparison and explicit confirmation. |
| Current estimated odometer is latest manual baseline plus confirmed post-baseline trip distances. | Dashboard shows last confirmed value/date and an estimated value; review previews the result of confirmation. | **Missing detail** | Add an expandable calculation explanation and clarify that active/pending trips are excluded. |
| Reading changes immediately recalculate mileage-based due states; completed maintenance history remains unchanged. | No reconciliation success impact is shown. | **Missing detail** | Add a success summary listing changed due states and explicitly preserve completed records. |

### Privacy, diagnostics, export, and Delete All Data

| Approved requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| No backend, sync, automatic telemetry, crash reporting, or app-initiated upload; export is the only supported handoff. | No Settings/privacy/export screens exist. | **Missing flow** | Design Settings sections for Local data & privacy, Export, Diagnostics, and destructive data controls. Avoid account/cloud controls. |
| Precise points exist only temporarily for active calculation/reconnect/recovery and are deleted at every terminal disposition. No route playback or exact coordinates. | Active tracking shows distance/segments; permission uses a generic map placeholder; no retained-trip map exists. | **Missing detail** | Remove any implication of retained route maps. Annotate temporary precise-location deletion in setup, active state help, and privacy details. |
| Operational diagnostics retain 30 days, have a storage cap, and can be cleared immediately. | No diagnostics screen exists. | **Missing flow** | Add Diagnostics summary, retained-until date/storage state, **Clear diagnostics**, empty state, and clear confirmation. |
| Normal screens use human-readable associations/status; raw identifiers and technical evidence are limited to dedicated diagnostics. | Existing screens are human-readable, but Bluetooth setup treats names/signals as product identity. | **Needs correction** | Preserve human-readable normal screens. Put opaque trigger evidence only in a clearly technical diagnostics detail, never precise coordinates, photo bytes, or free-form notes. |
| Complete export includes durable records, photos, configured identifiers, and retained diagnostics; excludes temporary precise points; is labeled sensitive and deliberately handed off. Generated archive is deleted after completion/cancel. | No export exists. | **Missing flow** | Add export explanation, sensitive-data warning, prepare/progress/success/cancel/failure states, deliberate Files/share handoff, and archive-cleanup confirmation. |
| Delete All Data stops tracking, removes every app-owned record/photo/binding/diagnostic/temporary point, and returns to first run after explicit destructive confirmation. | No Delete All Data exists. | **Missing flow** | Add a Settings action, active-trip consequence, typed or otherwise deliberate confirmation, deletion progress, and first-run result. |
| Backups/export copies remain outside app retention control; do not claim secure overwrite or remote deletion. | No backup/deletion limitations are shown. | **Missing detail** | Add concise limitation copy to disclosure, export, and deletion confirmation. |
| Generic documents, fuel, parts, receipts, costs, and receipt attachments are not approved by these MVP contracts. | Quick Add and Activity prominently include Fuel, Parts, Docs, Document, receipt/insurance/registration, and costs; Log service includes cost and Attach receipt. | **Needs correction** | Remove or visibly defer these actions/content from this MVP iteration. Do not let unsupported extras crowd approved records, schedules, trips, readings, diagnostics, export, and deletion. |

### Cross-cutting state, content, and accessibility details

| Requirement | Artifact evidence | Assessment | Precise iteration |
| --- | --- | --- | --- |
| Canonical terminology is consistent. | “Trip accepted,” “service record,” “estimated,” and vehicle model names are used; **vehicle profile**, **candidate trip**, **confirmed trip**, and **manual odometer reading** are not consistently named. | **Needs correction** | Use **vehicle profile**, **candidate trip**, **confirmed trip**, **estimated odometer**, and **manual odometer reading** in titles/help/history where the distinction matters. Avoid “car record” and “VIN profile.” |
| Every consequential flow has loading/testing, empty, success, recoverable error, and destructive confirmation states where applicable. | Empty Garage, Bluetooth off, paused trip, and review are strong examples; most new contractual flows have no state set. | **Missing detail** | Extend existing banners, cards, sheets, and grouped rows rather than creating a new visual system. |
| VoiceOver names, traits, values, hints, reading order, and status announcements are specified. | The artifact is visual only; no accessibility annotations are present. | **Missing detail** | Annotate controls, dynamic tracking/setup status, countdown announcements, modal focus, and post-action announcements. Do not announce rapidly changing distance continuously. |
| Dynamic Type, contrast, non-color status, reduced motion, keyboard/switch access, and minimum touch targets are accounted for. | Most statuses pair text and color, but no sizing/reflow/focus/motion annotations exist; some compact inline controls may be undersized. | **Missing detail** | Specify text reflow without truncating critical evidence, at least 44×44 pt targets, visible focus, contrast checks, non-color state labels, and reduced-motion alternatives. |
| Destructive actions and irreversible local-data loss are unambiguous. | Reject trip is visually destructive; archive, vehicle deletion, schedule/record deletion, diagnostics clear, and Delete All Data are absent. | **Missing detail** | Use the existing destructive action language consistently, distinguish reversible archive from deletion, and state retained/removed data before confirmation. |

## 3. Prioritized iteration scope

### Must add or fix for this MVP ticket

#### P0 — Correct unsupported promises and incorrect behavior

1. Replace Bluetooth-observation/name-and-signal setup with the approved best-effort,
   vehicle-bound Shortcut and Personal Automation setup, readiness checklist, test, and repair
   states.
2. Change passive reconnect grace from 30 minutes to three minutes; add explicit End Shortcut,
   CarPlay handoff, movement timeout, 12-hour safety stop, and failure/recovery distinctions.
3. Remove “tracks itself every time,” guaranteed-start language, and the While-Using-only location
   path. Explain Precise Always, background/locked best effort, force-quit limitations, and manual
   fallbacks.
4. Remove maintenance receipt attachment and cost from the approved record flow. Defer unsupported
   fuel, part, generic document, and receipt quick-add/timeline content from this MVP artifact.
5. Replace Bluetooth display-name/signal identity claims with human-readable Shortcut attribution
   and route corroboration; keep raw identifiers out of normal screens.

#### P0 — Complete core connected flows

1. Required first-run local-only disclosure and reviewable Settings copy.
2. Create/edit/archive/permanently-delete vehicle profile, optional/no-photo state, and active-trip
   lifecycle block.
3. Template/custom schedule creation, baseline, schedule detail/edit/delete, and explainable current,
   due-soon, due, mileage/time/combined states.
4. Maintenance record detail/edit/delete and exact schedule-link/recalculation consequences.
5. Vehicle-bound tracking setup and readiness; manual trip start/select/stop; active, reconnect,
   failure, next-launch recovery, and conflict states.
6. Trip edit/reassignment/confirm/reject and audit history, including pre-baseline behavior.
7. Dated append-only manual odometer reading, lower-value warning, calculation explanation, and due
   recalculation result.
8. Privacy/diagnostics/export/Delete All Data screens and their progress, confirmation, empty,
   success, cancel, and failure states.

#### P1 — Make the artifact reviewable and testable

1. Link every entry point to its next screen and back/cancel/result state.
2. Add concise interaction and accessibility annotations beside each unique pattern.
3. Use canonical terminology consistently and show status provenance without technical identifiers.
4. Demonstrate mobile reflow/Dynamic Type on the densest dashboard, Due list, setup checklist, and
   review sheet.

### Preserve unchanged

- The four primary tabs and their basic responsibilities.
- Garage as a multi-vehicle overview and vehicle-detail entry point.
- Hero-led vehicle cards and dashboards, including the premium warm-neutral visual direction.
- The existing iOS spacing, typography hierarchy, rounded grouped cards, status banners, sheets,
  and action hierarchy. Leave the artifact's Android examples unchanged; this iteration is iOS-only.
- Persistent active/paused-trip visibility above bottom navigation.
- Due grouped by vehicle, concise dashboard maintenance summaries, and chronological Activity.
- The trip review sheet’s focused decision model and resulting-odometer preview.
- Human-readable state summaries and absence of precise route playback.
- Empty, active, paused/reconnect, review-required, and unavailable-state visual patterns as
  reusable foundations after their behavior/copy is corrected.

### Explicitly avoid or keep out of scope

- A replacement information architecture, new visual system, or redesigned brand direction.
- Accounts, sign-in, cloud sync, sharing, app-level backup/recovery, or promised future migration.
- Guaranteed automation, passive system-wide Bluetooth observation, exact background timing, or
  automatic multi-vehicle selection for wired CarPlay.
- Bluetooth display name or signal strength as a stable identity.
- Precise route playback, retained coordinates, or raw identifiers on normal product screens.
- Receipt/document attachments on maintenance records, and unapproved fuel/part/document/cost
  tracking in this MVP iteration.
- Receipt/document upload, telemetry, crash reporting, custom encryption, app password, or Face ID
  gate.
- Architecture, database schema, native service boundaries, or persistence implementation details
  that the product contracts do not decide.
- Secure-overwrite, remote-deletion, or deletion-of-user-controlled-export claims.

## 4. Prompt for Claude Design

```text
Iterate the existing Maintenance Tracker artifact; do not restart it and do not propose a new
information architecture or visual redesign. Treat the current artifact as the visual and
structural baseline.

PRESERVE
- The four primary tabs: Garage, Activity, Due, Settings.
- The existing premium vehicle-journal direction: prominent hero photography, warm neutral
  surfaces, platform-appropriate iOS controls, rounded grouped cards, fine dividers, restrained
  status color, bottom sheets, banners, and compact metadata. Leave existing Android examples
  unchanged; do not spend this iteration adding or revising Android screens.
- Garage as a multi-vehicle overview, the hero-led vehicle dashboard, Due grouped by vehicle,
  chronological Activity, the persistent active/paused-trip strip, and the focused trip-review
  sheet.
- Existing components and patterns. Extend navigation only where an approved missing flow needs a
  minimal child screen, sheet, or Settings section.

ITERATION GOAL
Complete and connect the private iOS beta flows below while correcting unsupported behavior. Show
entry, in-progress, empty, success, recoverable-error, failure/review, and destructive-confirmation
states where consequential. Add brief interaction and accessibility annotations to each unique
pattern. Do not include implementation architecture.

CANONICAL LANGUAGE
- Vehicle profile: nickname, year, make, model, current odometer, optional hero photo.
- Candidate trip, confirmed trip, estimated odometer, manual odometer reading.
- Avoid “car record” and “VIN profile.” Use “confirmed,” not “accepted,” for trip disposition.

REQUIRED FLOWS AND STATES

1) First run and local-only data
- Before saving meaningful vehicle data or enabling tracking, disclose: no account, backend, sync,
  sharing, app-level backup/recovery, or cross-device continuation; uninstall/device loss may be
  unrecoverable; no future migration promise.
- Explain temporary precise location, retained durable records/diagnostics, sensitive export,
  backup/export-copy limits, and deletion. Keep this reviewable in Settings.

2) Garage and vehicle profiles
- Preserve multi-vehicle Garage and dashboards.
- Add create with nickname, year, make, model, current odometer, and optional hero photo only.
- Add edit, polished no-photo state, add/change/remove photo, archive, archived list/restore, and
  permanent delete.
- Archive retains history and disables automatic association. Permanent delete removes that
  profile and associated local data. Block archive/delete during its active trip until the user
  ends or discards it.
- Photo import is a private app-owned copy with metadata removed; do not imply upload.

3) Maintenance schedules and records
- Add built-in generic templates, custom schedule, schedule list/detail/edit/delete, and baseline
  setup. Schedule requires mileage, time, or both; for both, first threshold reached controls.
- New schedule defaults baseline to today/current odometer; allow last known service date and/or
  odometer.
- Show and explain CURRENT, DUE SOON, and DUE. Due soon means final 10% of mileage interval or final
  30 days; either applies for combined schedules. Show which threshold controls.
- Completed maintenance requires service name, date, odometer; plain-text note is optional. It may
  stand alone or link to exactly one schedule. A linked completion resets that schedule.
- Add record detail/edit/delete and schedule recalculation consequences. Deleting a schedule keeps
  records standalone; deleting a linked record recalculates from the newest remaining completion
  or initial baseline. Older records remain history.
- Remove cost and receipt/document attachment from the maintenance MVP flow.

4) Best-effort automatic tracking setup
- Replace the in-app Bluetooth scan/name/signal identity model. User-created, vehicle-bound normal
  Shortcuts plus Personal Automations are the only automatic Start/End trigger boundary. Do not
  claim passive system-wide Bluetooth observation.
- Ready requires Precise Always Location, vehicle-bound Shortcut, required Run Immediately
  automations, an in-app setup test, user-confirmed checklist, and observed/bound route where
  supported. Incomplete setup means automatic tracking is off; manual trip and odometer remain.
- Explain that background/locked actions may work when iOS delivers them; force-quit, exact timing,
  and universal delivery are not promised.
- Bluetooth-only/wireless-CarPlay automation selects the exact Bluetooth device and invokes a
  normal Shortcut with immutable vehicle choice. Wired CarPlay supports one assigned automatic
  vehicle at a time; other wired vehicles use manual start or reassignment.
- Shortcut choice proposes vehicle attribution; matching configured route corroborates it. Route
  evidence never starts a trip alone. Unknown/conflicting evidence fails closed. Add test mismatch,
  stale archived/deleted/reassigned vehicle, and Repair Shortcut states. Keep raw identifiers out
  of normal screens.

5) Active, manual, reconnect, and failure tracking
- Preserve the active/paused dashboard and global trip strip. Only one logical trip may be active.
- Add duplicate same-vehicle start no-op and conflicting vehicle/wrong-end failures that leave the
  current trip unchanged.
- Automatic confirmation requires vehicle-bound trigger, matching route corroboration, movement,
  and normal completion. Movement confirms at 3 m/s or 100 m displacement. No movement in 10
  minutes stops and leaves a failed candidate for review.
- Delivered End Trip Shortcut normally finalizes immediately. Passive route loss starts a
  THREE-MINUTE reconnect grace; matching reconnect resumes the same trip. Do not promise exact
  background finalization timing.
- Add wireless-CarPlay Bluetooth handoff/continue state, passive CarPlay route-loss state, and 12-
  hour safety stop that always requires review.
- Add Precise Always unavailable/revoked, location failure, process termination, unsafe resume,
  and next-launch recovery. Stop accumulation, never infer missing distance, retain derived
  evidence for correction/rejection.
- Connect Manual Start: select vehicle, active state, Manual Stop. Confirm only with movement and
  usable distance; otherwise create a review-required candidate.

6) Trip review and audit
- Preserve the focused review sheet and resulting-odometer preview.
- Connect proposed vehicle reassignment, total-distance edit, Confirm trip, and Reject trip.
- Add trip detail/audit showing captured estimate, proposed vehicle, time, derived quality and
  corroboration summary, failure reason/disposition, and every user change. Never show precise
  route playback or coordinates.
- Confirmed distance updates estimated odometer and mileage-based due states. A pre-baseline trip
  edit remains historical and does not change current mileage.

7) Manual odometer reconciliation
- Connect Update/Odometer reading to a dated, append-only manual reading form and history.
- The reading is authoritative and becomes the current baseline without rewriting trip history.
  A correction is another reading. Warn and explicitly confirm a lower reading.
- Explain estimated odometer = latest manual baseline + confirmed post-baseline trips; exclude
  active/pending trips. Show immediate due-state changes while leaving completed maintenance
  history unchanged.

8) Privacy, diagnostics, export, and deletion
- Add Settings sections for Local data & privacy, Diagnostics, Export, archived vehicles, and
  destructive controls. No account/cloud settings.
- Explain precise points are temporary and deleted when a trip becomes confirmed, review-required,
  rejected, or failed. No route playback.
- Diagnostics retain a rolling 30 days with a storage cap and immediate Clear action. Normal
  screens stay human-readable; opaque identifiers/technical evidence appear only in Diagnostics.
  Never include coordinates, photo bytes, or free-form notes there.
- Complete export includes durable records, photos, configured identifiers, and retained
  diagnostics; excludes temporary precise points. Label sensitive, require deliberate Files/share
  handoff, and show prepare/progress/success/cancel/failure plus generated-archive cleanup.
- Delete All Data explicitly confirms, stops tracking, removes all app-owned records/photos/
  bindings/diagnostics/temporary location state, and returns to first run. State that iOS backups
  and user-controlled export copies are outside app deletion; do not claim secure overwrite or
  remote deletion.

MVP SCOPE CORRECTIONS
- Remove or visibly defer fuel fill-up, part purchase, generic document/receipt actions, costs, and
  receipt attachments. They are not approved in these MVP contracts.
- Do not add accounts, sync, cloud backup, guaranteed tracking, stable Bluetooth-name identity,
  route playback, custom encryption, app password, Face ID gate, or implementation architecture.

ACCESSIBILITY AND INTERACTION ANNOTATIONS
- For each unique screen/pattern, annotate VoiceOver label/role/value/hint, focus order, modal focus
  and return, status announcements, error association, and destructive confirmation behavior.
- Support Dynamic Type/reflow, at least 44×44 pt targets, visible keyboard/switch focus, contrast,
  non-color status labels, and reduced motion. Do not continuously announce live distance or every
  countdown tick.

OUTPUT
- Update the existing artifact in place using its current components and visual language.
- Supply a connected screen/flow map plus the revised iOS screens. Do not add or revise Android
  screens in this iOS-only iteration.
- Clearly mark corrected existing screens versus minimally added screens/states.
```

## 5. Human review checklist

- [ ] Does the result unmistakably look and navigate like the imported Claude artifact rather than
      a replacement concept?
- [ ] Can a reviewer follow every required flow from an existing entry point through cancel,
      success, review/failure, and destructive confirmation states?
- [ ] Are guaranteed Bluetooth tracking, 30-minute grace, name/signal identity, While-Using-only
      permission, receipt attachment, cost, and unsupported quick-add claims removed?
- [ ] Is best-effort Shortcut/Personal Automation setup understandable, vehicle-bound, testable,
      repairable, and clearly not guaranteed?
- [ ] Are current/due-soon/due schedules and mileage/time/combined calculations understandable
      without relying on color?
- [ ] Can a user distinguish candidate trip, confirmed trip, estimated odometer, and authoritative
      append-only manual odometer reading, including their audit consequences?
- [ ] Are local-only loss, temporary precise location, diagnostics retention, sensitive export,
      backup limitations, vehicle deletion, and Delete All Data explicit at the right moments?
- [ ] Are accessibility annotations concrete for VoiceOver, focus, Dynamic Type, touch targets,
      contrast, status announcements, and reduced motion?
- [ ] Are no precise routes/coordinates or raw identifiers shown on normal screens?
- [ ] Has Claude avoided accounts, cloud/sync, implementation architecture, and every other
      explicitly out-of-scope promise?
