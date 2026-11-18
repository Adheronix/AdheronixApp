# Adheronix v1.0.1

This Android update adds optional reasons and personal notes for skipped doses, entry corrections from Today and history, and clearer seven-day summaries. Patient-reported intake, unknown records and upcoming doses remain distinct. The existing blue/mint design, characters, navigation and one-tap taken action are preserved.

The app remains compatible with the current deployed API. Corrections replace obsolete skipped reasons even when the older API ignores empty notes. Source-aware summaries are computed from schedule history; no database migration or backend rollout is required to use the new app flows. Backend reporting/provenance improvements are included in the source PR and require their own deployment before becoming live.

Android package `com.adheronix.app`, version 1.0.1, version code 2. Release signing must use the same certificate as v1.0.0, and the packaged app must point to the existing public HTTPS API. Do not reuse the previous APK under a new release name: the new app source must be rebuilt.

Camera recognition is deferred. Hardware firmware, device provisioning and connections are unchanged. These records do not establish verified ingestion or clinical improvement. Personal notes are included only when the patient chooses to share a reviewed summary; no caregiver is contacted automatically.

Validation before packaging: 45 backend unit/HTTP tests, seven PostgreSQL-backed HTTP integration checks with synthetic patients, backend compilation, mobile tests, mobile TypeScript and zero-warning lint. Browser checks covered saving/reloading reasons, correcting to unsure and reviewing share text, with visual checks at default and 390px widths. Hosted clean-install, production-container and Android packaging results, final artifact checksums/signature and native acceptance status belong in the release's build provenance. No new native-device acceptance is implied by the earlier v1.0.0 phone test.
