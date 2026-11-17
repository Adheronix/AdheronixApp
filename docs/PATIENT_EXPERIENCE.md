# Patient experience and integration changes

This work updates the existing Expo/React Native Android and iOS app. Its web build is a development preview of the app. The old marketing website is outside this change.

## Resulting experience

- A shared blue, aqua and mint design system covers sign-in, onboarding, Today, medication records, scheduling, assistant, MediBox, inbox, settings and summaries.
- Native illustrated characters have distinct roles: a mint care companion, blue conversation companion, white MediBox and lavender journal. Native geometry supports live expressions and connection lighting without loading separate bitmap variants.
- Today’s companion responds to explicit patient dose confirmations: calm before recording, encouraging during progress, happy when all today’s doses are patient-confirmed, and a gentle check-in for overdue, missed or skipped entries. Historical records with unknown confirmation source do not trigger celebration. The expression is a supportive illustration, not a health assessment.
- MediBox lights up after a valid device reading within the last two minutes. It dims when the signal becomes stale; missing or invalid timestamps never imply connection. Its screen polls every 15 seconds while focused and checks freshness every five seconds. Background/unfocused screens stop polling; light animation respects reduced-motion preferences and app background state. Visible labels explain the signal-based meaning of connection.
- App navigation remains visible on medication forms, summaries, inbox and scanner, with selected route state. Tabs retain assistant conversation state while navigating within the running app. Conversations are not persisted across app restarts.
- The assistant decodes escaped entities/newlines and renders headings, emphasis, numbered lists, bullets, code and safe HTTP(S) links as native text. HTML-looking output remains inert text. Medication context is opt-in and disabled initially.
- The medication form has individual dose-time fields, bounded planning periods, real API writes and useful errors. Schedule edits preserve recorded history while replacing future unconfirmed reminders.

## Design research

The palette choice is an Adheronix design decision informed by healthcare guidance and the owner’s preference; it is not a claim that one colour universally creates trust or improves adherence.

- [NHS colour guidance](https://service-manual.nhs.uk/design-system/styles/colour): blue/aqua families, dark readable text, tinted backgrounds and semantic status colours.
- [WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): at least 4.5:1 for normal text and 3:1 for large text. Tests check essential text pairs and input boundaries; this is not a complete accessibility certification.
- [WCAG use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): labels and icons accompany the MediBox glow and status colours.

Core tokens are in `mobile-api/constants/theme.ts`; native characters are in `mobile-api/components/care-character.tsx`; data-to-expression and connection rules are in `mobile-api/services/character-state.ts`.

## Backend integration

- Real patient profile refresh/edit, manual medication creation, schedules, confirmations, notification read state, patient-owned device reads and configured AI replies.
- Creating schedules is transactional, serializes concurrent edits for the same patient/medication and writes reminder records together with schedules. Reading a status endpoint does not mutate dose history or trigger emergency actions.
- Device removal events stay separate from patient-confirmed ingestion and never infer new medications or improve a health score.
- Notification records expose actual channel outcomes. In-app delivery works; email is not configured and native push needs native-device verification.
- Local development uses the Metro API proxy on web and native; release builds use `EXPO_PUBLIC_API_URL`.
- Existing databases need `backend-api/migrations/20261116-dose-confirmation-source.sql` before this backend is released. Unknown historical origins remain NULL. No production migration or deployment was performed.

## Validation (16 November 2026)

- Backend unit suite: 27 passed.
- Isolated PostgreSQL integration suite: 29 passed, covering ownership, validation, schedule replacement/history, delivery metadata and device provenance.
- Live API smoke: 10 passed, including a real configured AI provider response with medication context disabled.
- UI regression checks: 22 passed (`npm run test:ui`), covering reported Markdown artifacts, expressive states, signal freshness/expiry, malformed timestamps, essential contrast pairs and native API-origin resolution.
- Mobile TypeScript and ESLint: passed, zero lint errors/warnings.
- Expo export: Android, iOS and web succeeded, with 23 web routes. Exported assets live outside the repository and were not published.
- Browser verification uses synthetic records in the isolated local database. Verified sign-in, schedule persistence, patient confirmation/expression changes, formatted AI replies, conversation persistence through medication-form navigation, and MediBox offline-to-connected transition against authenticated API telemetry.

## Release limitations

The local preview is not a production release approval. Native push delivery, camera scanning on a physical phone, live hardware/network behaviour, production migrations, credential rotation and the remaining release-readiness findings still require validation. The local database lacks pgvector, so the assistant’s direct provider replies were tested; RAG retrieval was not validated here. New visual states do not imply verified ingestion or medical assessment. No user data, credentials, generated build artifacts or screenshots are committed.
