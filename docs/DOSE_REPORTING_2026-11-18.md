# Patient dose reporting — 18 November 2026

Patients can now save an optional reason and personal note when recording a skipped dose, and correct entries from Today or the seven-day summary. “I took this” remains one tap. The accepted blue/mint styling, navigation, characters and surrounding screen layouts are retained. Camera recognition and hardware integration are outside this change.

The reason choices cover forgetting, running out, cost/access, concerns or side effects, a changed routine, difficulty taking the medicine, and preferring not to say. No reason is required. Brief suggestions direct relevant concerns to the patient's pharmacy or care team; no contact, referral or caregiver notification is sent automatically. Personal notes appear in the existing preview before a patient chooses to share a summary.

Reasons use the existing `notes` column (`Reason: <label>` followed by an optional note). This needs no database migration and remains compatible with existing clients. It is deliberately not a new clinical assessment or structured analytics schema. The app limits personal notes to 1,000 characters; both intake update routes validate the complete note to 2,000 characters. Changing status clears an omitted old reason; explicit empty notes clear it too. Retrying the same status without a note preserves the existing note.

An explicit taken, skipped or missed report records `confirmation_source=patient`. Correcting to unsure uses the existing pending status, clears the taken timestamp/source, and retains an explanatory note. Existing historical sources are not backfilled or inferred. This is correction of the current record, not a new immutable audit history.

The weekly calculation distinguishes patient-reported taken, skipped/missed records, due entries without a report, and older taken entries with an unknown source. All due or already-recorded entries remain in the denominator; upcoming pending entries are excluded. An empty denominator displays a dash. The calculation and date window in the app follow the existing API schedule timezone, Africa/Kigali. A percentage describes records rather than verified ingestion or health improvement.

The API retains its legacy weekly keys. `taken` still counts all stored taken entries for compatibility; new `patient_reported_taken`, `unattributed_taken`, `unreported` and `upcoming` fields expose the distinction. `adherence_rate` now uses patient-reported taken as its numerator. New UI summaries calculate from the returned schedule history, so they also work with the existing deployed API. The summary no longer depends on an unrelated device-list request succeeding; hardware service, pairing, firmware and connection behavior are unchanged.

## Validation

- Backend tests cover ownership, source attribution, note correction and bounds, and the weekly denominator.
- Database integration tests cover real HTTP updates, persistence through history/Today reads, patient isolation, corrections to taken/unknown and both routes' input validation, using a disposable local PostgreSQL database.
- Mobile tests cover source labels, unknown/future entries, reason round-trips, the reporting timezone at midnight and the shared history-line formatter.
- Run backend unit tests/build, mobile TypeScript/lint/tests and `test/dose-reporting.e2e-spec.ts` against a dedicated test database. Do not point integration tests at production.

Camera models, hardware assembly/connection, clinical efficacy, AI clinical advice and native device notification/camera acceptance are not validated by this change. No production deployment or APK update is implied by local verification.
