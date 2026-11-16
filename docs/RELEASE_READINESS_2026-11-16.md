# Adheronix app release-readiness assessment

Date: 16 November 2026 (Africa/Kigali). Internal engineering review; local changes only.

**Release decision: HOLD.** The app builds, and several confirmed security defects have been fixed on a local feature branch. Essential product flows, notification delivery, device evidence handling, dependency security, and production operations still need work before a patient-facing release.

## Scope and repository state

- Repository: `Adheronix/AdheronixApp`, at `/home/code888/Documents/Projects/AdheronixApp`.
- Reviewed components: `mobile-api` (Expo/React Native), `backend-api` (NestJS/PostgreSQL), and `hardware/smartbox-wokwi` (simulator firmware).
- The organization listing exposed this repository and `AdheronixWebsite`. **The 3D website is excluded at the owner's request.** Its design, code, tests, and product claims do not determine this assessment.
- The existing checkout was clean on `chrissz`, commit `c93b581`. Fetch and fast-forward-only pull confirmed it was current with `origin/chrissz`.
- `main` is at `8acbc90`. The `chrissz` commit adds smart-box telemetry/firmware and mobile changes across 17 files; this work was preserved.
- Fixes are on `codex/release-readiness-hardening`, based on `chrissz`. No branch has been pushed, merged, or deployed.
- The June `ADELONIX_AUDIT.md` was treated as historical input. For example, its statement that no smart-box backend or firmware exists is outdated.

The working product reference is [Adheronix Current Functionality](https://docs.google.com/document/d/1BcG5yltaxoH7J8tDYU1TEeOfT_HSum4lgowQjNfeRg4/edit?usp=drivesdk), updated 17 October 2026. It specifies patient/caregiver support, structured check-ins, medication management, reports, and optional hardware, while distinguishing device events from patient confirmations. Older MediSafe plans are historical context, not an automatic requirement to build every older feature.

## Validation evidence

| Check | Result | What it establishes |
| --- | --- | --- |
| Backend TypeScript check and Nest build | Passed | The reviewed backend compiles using its installed workspace dependencies. |
| Mobile TypeScript check | Passed | The TypeScript mobile source passes its current compiler configuration. The JavaScript profile-setup screen is not equivalent to a strictly typed TS screen. |
| Backend unit/HTTP tests | 27 passed, 4 suites | Includes 10 new service security/regression tests and 14 new HTTP boundary tests, plus the 3 existing tests. HTTP tests use mocked collaborators; they do not establish live AI or delivery behavior. |
| Existing database integration tests | 18 passed, 1 failed, 5 suites | Executed against a new local PostgreSQL database on port 55483, not the database configured in the user's private environment. |
| Expo web export | Passed, 21 routes | The mobile application bundles and statically exports. This is not an Android/iOS store build or physical-device test. |
| Browser rendering | Login route rendered | A local clean-URL preview rendered the login fields and action. Authentication through the browser and a full native journey remain unverified. |
| Backend lint | 289 errors, 46 warnings remain | Baseline was 291 errors and 46 warnings. Most remaining failures concern unsafe/untyped data handling. The four newly added helper/test files pass lint. |
| Mobile lint | 0 errors, 3 warnings | Current lint configuration, not an accessibility or UX acceptance test. |
| Installed dependency inventory | No reported manifest conflicts | `npm ls --all` reports no dependency problems. A clean CI install was not independently repeated for the app. |
| Current npm lockfile advisory scan | 70 affected package entries | 5 critical, 24 high, 38 moderate, 3 low. Includes development tooling, mobile tooling, and transitive dependencies; these are not 70 demonstrated production exploits. |
| Bounded tracked-source credential scan | No matches after removal | Checked database credential URLs, common provider token formats, and private keys. Separate inspection found and removed inline database-helper/device credentials. This is not an exhaustive scan of every historical Git object. |

No real patient records were queried or exported. AI keys were disabled for the isolated integration run. The temporary PostgreSQL installation lacks pgvector, so RAG initialization logged an unavailable-vector error; retrieval/embedding behavior was not validated.

### The failing integration test is still visible

`backend-api/test/notification-flow.e2e-spec.ts` expects an unread medication reminder immediately after a QR medication is created. The implementation schedules its mock next-dose reminder five minutes into the future, while the unread query selects sent notifications. The test received an empty list.

This was **not** made green by deleting assertions or changing the test to accept the existing behavior. The test also omits the production validation pipe and submits `source: "QR"` without `frequency`, whereas the production DTO requires a clinician/pharmacist source and a frequency. The test fixture, production contract, and intended reminder lifecycle need to be reconciled together.

## Confirmed defects fixed locally

1. **Embedded credentials:** database helpers now read `DATABASE_URL` from the environment. Firmware reads a development key from ignored `secrets.h`, with a committed non-secret example. The existing local simulator key was preserved privately to avoid losing local configuration. Commit `d959bf1` records the source cleanup.
2. **Cross-patient smart-box reads:** a patient with no events no longer falls back to the globally latest event. Missing identity is rejected, and weight reads require patient authentication and a patient-scoped query.
3. **Device authentication:** missing backend device configuration now rejects requests. A bearer token is required and compared using a timing-safe comparison. A device payload cannot override its mapped patient. The shared-key architecture itself is still a release issue below.
4. **Demo writes:** demo dose injection is opt-in in development and always rejected in production.
5. **Credential responses:** password hashes are excluded from ordinary entity selections; login explicitly selects the hash for verification. Push-token update responses are sanitized. The login DTO is no longer printed to logs.
6. **JWT configuration:** signing and verification require a configured secret of at least 32 characters, replacing the known fallback secret. Length validation does not establish secret entropy; deployment must supply a randomly generated secret.
7. **Profile updates:** a validated DTO and an explicit service allowlist replace unrestricted partial-entity assignment. Role, hash, timestamps, relationships, and unverified authentication-identifier changes are rejected at the HTTP boundary.
8. **AI request boundaries:** client messages cannot choose system/developer/tool roles. Conversation length and per-message length are bounded. This is input hardening, not a validated medical-safety policy.
9. **Shared knowledge management:** knowledge seeding now requires an admin role instead of any patient token.
10. **Production database safeguards:** automatic entity synchronization and database-creation bootstrap are disabled for production. Enabled database TLS now verifies certificates. Reviewed migrations and RAG initialization changes are still required.
11. **Missed-dose crash:** the status query now loads its medication relation before using the medication ID and name in a missed-dose notification.

The seven initial regressions were run before the fixes and all seven failed for the reported reasons; they passed after the fixes. Additional device and HTTP boundary tests cover the resulting restrictions.

## Remaining release blockers

### R1 — Rotate historically exposed credentials (P0, owner action)

Removing secrets from current source does not revoke copies in Git history or elsewhere. Rotate the exposed database credential and the shared simulator/device key wherever they are still valid, then update the corresponding private environment. Review database access logs and the exposure window. Do not paste replacement credentials into a PR, issue, report, or chat.

The repository history was deliberately preserved. No remote credentials were rotated during this review.

### R2 — Device events can alter medication truth without a separate patient confirmation (P0)

Evidence: `backend-api/src/smartbox/smartbox.service.ts`, especially `applyDoseSideEffects`, `markMatchingScheduleTaken`, `findScheduleForEvent`, and `createScheduleFromEvent`; firmware `postDoseEvent` payload construction in `hardware/smartbox-wokwi/sketch.ino`.

Confirmed device events currently mark schedules taken and update health scores. Matching can fall back to another schedule, and the event path can create medication/schedule records from telemetry. A firmware weight-removal event can therefore become an intake claim or inferred regimen. This conflicts with the October specification's separation of physical removal, patient confirmation, and uncertainty.

Release gate: make device removal, explicit patient confirmation, and unresolved discrepancies separate persisted facts with clear provenance. Device telemetry must not invent prescriptions or silently mark an unrelated schedule taken. Cover mismatched medicine/time, ambiguous events, late arrivals, duplicate/replayed messages, and reconciliation in tests.

### R3 — Reminder setup and delivery are not a dependable end-to-end flow (P0)

Evidence: `medication.service.ts` creates a mock reminder five minutes after QR creation; `medication-schedule.service.ts` generates only seven days; `mobile-api/services/schedule.service.ts` and the medication screen do not expose schedule creation. `support.tsx` reminder controls remain component-local state.

`PushNotificationService` logs HTTP failures or catches exceptions and returns normally. `NotificationService` can then mark the notification sent. The email service only logs a mock email, including its body. These outcomes do not prove delivery to the patient.

Release gate: a patient can set and review an actual prescribed schedule; schedule generation continues for the treatment period; delivery failures propagate and can retry; queued/sent/accepted/delivered states are not conflated; actual native permission/token and reminder behavior are tested on a device. Remove the mock five-minute reminder. Replace sensitive notification-body logging with appropriate operational metadata.

### R4 — Production schema and recovery are unproven (P0)

Evidence: no reviewed migration directory or deployment migration process was found. Disabling production `synchronize` prevents uncontrolled schema changes but does not create the schema. `RagService.ensureTableExists` still attempts runtime table/index DDL.

Release gate: versioned migrations for all application/RAG structures, a least-privileged runtime account, a tested deployment order, and a demonstrated backup restore and rollback procedure. Validate TLS trust against the actual deployed database. No production database configuration or recovery was exercised here.

### R5 — Cloud AI processing and urgent-symptom behavior need explicit product controls (P0)

Evidence: `/ai/chat` assembles patient context by default and sends it through the configured cloud AI client. The safety instruction is a prompt; there is no demonstrated deterministic urgent-symptom route or evaluated clinical test set for that chat path. The background monitoring switch is separate and optional.

Release gate: define and implement consent/data minimization for external processing, record the approved provider/data handling configuration, and validate bounded assistant behavior and escalation with domain reviewers and a documented evaluation set. Do not describe the implementation as on-device AI. Do not claim a clinical review queue is staffed merely because an internal notification was created.

### R6 — Dependency advisories and failing quality gate remain (P1)

Evidence: current lockfile audit and backend lint results above. The five critical package entries are `concurrently`, `handlebars`, `proxy-addr`, `shell-quote`, and `tar` as reported by npm; confirm the exact dependency paths and runtime reachability before deciding the patch order.

Release gate: update affected packages in focused, compatible changes; run a clean locked install, compilation, integration tests, Expo compatibility checks, and native build. Do not apply forced major Expo/React Native updates solely to reduce an advisory count. Resolve the backend lint failures or adopt a reviewed, explicit baseline while blocking new unsafe code; do not disable the rules globally to manufacture a pass.

### R7 — The current specification's core workflows are incomplete (P1)

- **Caregivers:** roles currently consist of patient/admin. `mobile-api/app/profile.tsx` toggles caregiver access only in local component state. No persisted patient-granted caregiver permissions, invitation, revocation, or scoped access workflow was found.
- **Check-ins:** no dedicated structured check-in persistence or daily/weekly/monthly workflow was found in the reviewed modules. Ordinary chat is not the specified structured check-in record.
- **Reports:** no complete exportable medical-summary workflow combining symptoms, confirmations, device evidence, and discrepancies was found.
- **Manual medication support:** the visible add action opens the QR scanner; a complete manual regimen/schedule setup and review flow is missing from the medication screen. The product is specified to work without mandatory hardware.

Release gate: either implement these workflows and their authorization/provenance tests, or explicitly narrow and approve a smaller pilot scope before release. Do not treat older clinician/pharmacist portals or insurance scoring as requirements for this narrowed current product by default.

### R8 — QR inputs, dates, and status semantics need stronger contracts (P1)

Evidence: `mobile-api/app/scan.tsx` passes prescription-bearing QR objects through directly; its fallback invents a seven-day period and frequency of one when fields are absent. QR origin is not cryptographically authenticated by the reviewed import route. `CreateMedicationDto.frequency` has presence validation but no positive-integer bound.

Schedule logic mixes UTC date strings with server-local hours, mutates missed status during a GET, and has no demonstrated patient-timezone model or rollover beyond seven days.

Release gate: present incomplete or untrusted medication data for review instead of supplying invented regimen values; validate bounded schema/types; distinguish user-entered versus issuer-verified records; test day boundaries, time zones, status transitions, and ongoing schedule generation.

### R9 — Device provisioning and production hardware transport are unfinished (P1)

The source uses a shared development key and a hardcoded HTTP tunnel endpoint. There is no demonstrated per-device credential lifecycle, revocation, replay/idempotency protection, or verified production TLS transport. No physical hardware calibration, offline recovery, or battery behavior was tested. `arduino-cli` is unavailable in this environment, so even a firmware compile is not claimed.

Release gate: unique device identities, authenticated ownership assignment, secure transport, event IDs/deduplication, and real hardware tests. Preserve source timestamps and uncertainty rather than treating receipt time as evidence of intake.

### R10 — Release packaging and operational checks remain (P1)

The mobile API URL falls back to localhost; Axios has no request timeout in the shared client. Release app identifiers/EAS provisioning and native push setup are not demonstrated. Mock missed-dose rows and an adjustable battery indicator remain visible in support/device screens.

No app-specific CI release gate, deployment health/readiness check, production error monitoring, load test, account-recovery flow, retention/export/deletion process, or backup-restore evidence was found in the reviewed project. Deployment settings outside the repository were not inspected; this does not establish that the host lacks such controls.

Release gate: separate development/production configuration, explicit release identifiers, bounded network failures, truthful UI states, automated checks, and staged native-device acceptance. Test denied permissions, offline/expired sessions, low connectivity, and account/data lifecycle behavior.

## Implementation order and acceptance

1. Rotate exposed credentials; review and merge the tested isolation/input/configuration fixes only through the project's normal review process.
2. Correct the medication evidence model and reminder lifecycle, with isolated tests for authorization, duplicate events, failure/retry, and time boundaries.
3. Establish versioned migrations and a restore/rollback rehearsal; patch dependencies and establish repeatable CI on a clean locked installation.
4. Complete the agreed patient/caregiver, check-in, and report scope. Validate the AI boundaries and external-processing controls before enabling them for real patients.
5. Run a signed Android/iOS build and a staged pilot with test accounts and real devices. Obtain explicit release approval after the evidence is reviewed.

Passing compilation, a static export, or a unit suite is insufficient to move the release decision from HOLD. Every open P0 needs verified closure, and the owner must approve the treatment of remaining scope gaps before a live pilot.

## Reproduction and evidence locations

Build/type commands use the repository's workspace-local tools. The checks executed included Nest build, TypeScript `--noEmit`, Jest `--runInBand`, ESLint without `--fix`, `npm ls --all`, and `npm audit --json`. Expo export went to `/tmp/adheronix-mobile-export` so generated artifacts remain outside Git.

Temporary raw evidence is under `/tmp/adheronix-*`: unit and integration JSON/logs, backend/mobile lint JSON, installed dependency inventory, and the lockfile advisory report. These temporary files are not part of a committed release artifact and may be removed by the operating system.

The database integration runs explicitly set host `127.0.0.1`, port `55483`, an isolated database/user, test-only JWT/admin configuration, disabled AI keys, and disabled background agent monitoring. Do not run the existing e2e suite against the private default environment: it imports `AppModule`, creates records, and does not consistently install the production validation pipe or mock delivery services.
