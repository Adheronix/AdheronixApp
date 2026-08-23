# Adelonix/MediSafe Phase 0 Codebase Audit

Generated: 2026-06-28

Scope: read-only audit of source, tests, docs, and configuration in this repository. Generated dependency folders (`node_modules`, `backend-api/dist`, `.git`) were excluded from source findings except where package manifests prove dependency usage.

## 1. File And Module Tree

```text
.
├── README.md
│   Root project summary. Documents only `backend-api` and `mobile-api`; setup instructions are still placeholder.
├── package.json / package-lock.json
│   npm workspace wrapper for backend and mobile app.
├── test-db.js / test-neon.js
│   Local/manual database connectivity scripts. `test-neon.js` contains a hard-coded Neon connection string and should be treated as a secret leak.
├── docs/
│   Design/spec notes, currently only an auth screen redesign spec.
├── mobile-api/
│   Expo/React Native patient mobile app.
│   ├── app/
│   │   Expo Router screens.
│   │   ├── (tabs)/
│   │   │   Patient tab screens: home dashboard, medication list, AI chat, IoT status, support/settings.
│   │   ├── auth/
│   │   │   Login, signup, start, and profile setup screens.
│   │   ├── scan.tsx
│   │   │   Camera QR scanner for medication payloads.
│   │   ├── notifications.tsx
│   │   │   Patient notification inbox.
│   │   └── profile.tsx
│   │       Patient profile display.
│   ├── services/
│   │   Axios API wrapper and client services for auth, medications, schedules, notifications, push token registration, and storage.
│   ├── constants/
│   │   Mobile API base URL configuration.
│   ├── components/
│   │   Small shared UI component(s), currently `HeroArt`.
│   ├── assets/images/
│   │   App imagery, icons, splash assets, and one PDF requirements artifact.
│   └── scripts/patches/config
│       Expo helper scripts, Metro/TypeScript/ESLint config, React Native patch.
├── backend-api/
│   NestJS/PostgreSQL backend.
│   ├── src/
│   │   ├── app.module.ts / main.ts
│   │   │   Nest bootstrap, TypeORM, ConfigModule, ScheduleModule, Swagger.
│   │   ├── patient/
│   │   │   Patient entity, JWT auth-facing register/login/profile/push-token service and controller.
│   │   ├── auth/
│   │   │   JWT strategy/guard, role enum, role guard/decorator, `GetPatient` decorator.
│   │   ├── admin/
│   │   │   Admin registration, patient/medication admin CRUD, broadcast notification endpoint.
│   │   ├── medication/
│   │   │   QR medication storage, schedule entities/controllers/services, intake status/adherence stats.
│   │   ├── notification/
│   │   │   Notification entity, patient/admin notification APIs, scheduler, Expo push sender, mock email sender.
│   │   ├── health-score/
│   │   │   Health Credit Score entity/service for adherence/refill scoring.
│   │   ├── agent/
│   │   │   AI/agentic services: OpenRouter client, RAG, OCR, chat controller, event router, medical reasoning, monitoring cron.
│   │   └── database/
│   │       Database creation helper and pgvector extension enablement.
│   ├── test/
│   │   E2E tests for app, auth, medication schedule, notifications.
│   ├── *.md
│   │   Backend README plus notification and medication schedule feature docs.
│   └── notify_results*.json / test_results.json / test_output.txt
│       Stored test outputs, including failing historical runs.
└── .superpowers/brainstorm/
    Generated auth-screen brainstorm/mockup artifacts.
```

## 2. Anthropic / Claude API Usage

No Anthropic or Claude API usage was found in source, docs, or package manifests.

Search terms checked: `anthropic`, `claude`, `ANTHROPIC`, `Claude`, `@anthropic`, `api.anthropic`.

Confirmed absence:

- No `@anthropic-ai/*` package in root `package.json`, `backend-api/package.json`, or `mobile-api/package.json`.
- No `ANTHROPIC_API_KEY` env var in `.env.example` or source.
- No Claude parsing shape such as `data.content[0].text`.

Current LLM integration is OpenAI-style via OpenRouter:

- `backend-api/src/agent/open-router.service.ts`
  - Env vars: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`.
  - Calls `${baseUrl}/chat/completions` and `${baseUrl}/embeddings` with `axios.post`.
  - Parses `response.choices?.[0]?.message?.content`.
- `backend-api/src/agent/ai-client.service.ts`
  - Separate OpenRouter chat client path for doctor-agent decisions and monitoring.
  - Env vars: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_PRIMARY_MODEL`, `OPENROUTER_MONITOR_MODEL`, `AGENT_LLM_TIMEOUT_MS`, `AGENT_MAX_TOOL_CALLS`.
- `backend-api/src/agent/ocr.service.ts`
  - Uses OpenRouter-compatible vision/OCR chat completions when `OCR_USE_OPENROUTER=true`.
- `backend-api/.env.example`
  - Documents OpenRouter and model env vars, not Anthropic.

Important security note: `backend-api/.env` currently contains a real-looking `OPENROUTER_API_KEY`. It should be rotated and removed from version control if committed.

## 3. RAG / Vector Retrieval Inventory

### `backend-api/src/database/ensure-database.ts`

- Enables PostgreSQL `vector` extension via `CREATE EXTENSION IF NOT EXISTS vector`.
- Logs that RAG features are disabled if pgvector is unavailable.
- Data retrieved: none directly; prepares database capability.

### `backend-api/src/agent/rag.service.ts`

Implementation:

- Creates table `medical_knowledge` with:
  - `id UUID`
  - `content TEXT`
  - `source VARCHAR(255)`
  - `embedding vector(1024)`
  - `metadata JSONB`
  - `created_at TIMESTAMP`
- Creates HNSW index `idx_medical_knowledge_embedding` using `vector_cosine_ops`.
- Embeds documents with OpenRouter embeddings via `OpenRouterService.createEmbedding`.
- Stores embeddings as vector string literals.
- Retrieves context with query embedding and SQL:
  - `1 - (embedding <=> $1::vector) AS similarity`
  - threshold default `0.7`
  - limit default `5`
- Returns concatenated source/content context plus source list.

Data retrieved over:

- `medical_knowledge` rows seeded by `seedDefaultKnowledge()`.
- Seeded data mixes unstructured guidance and structured/lookup-like interaction facts:
  - Drug info: metformin, amlodipine, aspirin.
  - Drug interaction facts: metformin + contrast dye, aspirin + warfarin, amlodipine + simvastatin, metformin + alcohol.
  - Disease adherence guidance: epilepsy, diabetes, hypertension.

### `backend-api/src/agent/open-router.service.ts`

- Provides `createEmbedding(model, input)` wrapper over OpenRouter `/embeddings`.
- Default embedding model appears via callers and env: `nvidia/llama-nemotron-embed-vl-1b-v2:free`.

### `backend-api/src/agent/hermes.service.ts`

- Calls `rag.getContextForQuery(userQuestion, 5)` for every medical question.
- Injects retrieved context into an LLM prompt.
- Returns `rag_sources` in its verdict.
- Data retrieved: medical reference chunks from `medical_knowledge`, based only on semantic similarity to the user question.

### `backend-api/src/agent/event-router.service.ts`

- Calls `rag.seedDefaultKnowledge()` for `seed_knowledge` event.
- Reports document count.

### `backend-api/src/agent/agent.controller.ts`

- Exposes `POST /agent/knowledge/seed`, protected by patient JWT, which routes to the RAG seed flow.
- The same controller describes OCR scan as "OCR extraction and DDI verification", but no deterministic DDI table lookup was found.

### `backend-api/src/agent/agent.types.ts`

- Includes `rag_sources: string[]` in agent response types.

### Current RAG Risk

The RAG dataset contains drug interaction pairs and severity metadata, but these are clinical safety facts stored as free text and retrieved by vector similarity. There is no local structured drug-interaction table, no deterministic DDI lookup, and no auditable safety rule separating "lookup result" from "LLM explanation".

## 4. External Backend Dependencies And Services

### Database

- PostgreSQL via TypeORM.
- Config vars: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `DB_MAINTENANCE_NAME`.
- `synchronize: true` in `backend-api/src/app.module.ts`, suitable for dev only.
- pgvector extension attempted in `backend-api/src/database/ensure-database.ts`.

### Authentication

- JWT via `@nestjs/jwt`, `passport-jwt`, `JwtAuthGuard`, `JwtStrategy`.
- Password hashing via `bcrypt`.
- Roles: `patient` and `admin` only.
- Admin setup via shared `ADMIN_SETUP_KEY`.

### AI / LLM / Embeddings

- OpenRouter-compatible API:
  - Chat completions for AI chat, doctor-agent safety triage, event classification, language detection, translation, greeting/notification copy, medical reasoning.
  - Embeddings for RAG.
- Model env vars:
  - `MINIMAX_MODEL`
  - `HERMES_MODEL`
  - `QWEN_CODER_MODEL`
  - `LLAMA_FAST_MODEL`
  - `QWEN_KINYARWANDA_MODEL`
  - `LANG_DETECT_MODEL`
  - `OPENROUTER_PRIMARY_MODEL`
  - `OPENROUTER_MONITOR_MODEL`
  - `EMBEDDING_MODEL`
  - `OCR_MODEL`

### OCR

- OpenRouter OCR path using vision chat completions when `OCR_USE_OPENROUTER=true`.
- Direct Baidu OCR fallback:
  - `https://aip.baidubce.com/oauth/2.0/token`
  - `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic`
  - Env vars: `BAIDU_OCR_API_KEY`, `BAIDU_OCR_SECRET_KEY`.

### Notifications

- Expo Push API:
  - `https://exp.host/--/api/v2/push/send`
  - Implemented in `backend-api/src/notification/channels/push-notification.service.ts`.
  - Mobile uses `expo-notifications` in `mobile-api/services/push.service.ts` and PATCHes token to backend.
- Email notification service:
  - `backend-api/src/notification/channels/email-notification.service.ts` is mock-only logging, despite being wired into `NotificationService`.
- Scheduled processing:
  - Nest `@nestjs/schedule` cron processes pending notifications.

### Emergency / Webhook Integrations

- `backend-api/src/agent/doctor-agent.service.ts` references:
  - `EMERGENCY_CONTACT_WEBHOOK_URL`
  - `EMERGENCY_SUPPORT_WEBHOOK_URL`
  - `AGENT_ALLOW_EMERGENCY_WEBHOOK`
- These are optional outbound webhooks. If absent/disabled, the service creates internal notifications instead.

### Mobile/API Client

- Mobile uses `axios` against `BASE_URL` in `mobile-api/services/api.ts`.
- Mobile token storage:
  - `expo-secure-store` where available.
  - `localStorage` fallback on web.

## 5. Existing Features With No UI Or Placeholder/Default UI

### Backend features with no discovered mobile UI

- Admin portal features:
  - Backend: `backend-api/src/admin/admin.controller.ts`.
  - Features: admin registration, list/delete patients, list/delete medications, broadcast notification.
  - UI: no doctor/admin/pharmacist web or mobile portal folder exists; no mobile screen calls `/admin/*`.

- Doctor-agent monitoring and human review:
  - Backend: `backend-api/src/agent/doctor-agent.service.ts`, `backend-api/src/agent/monitoring.cron.ts`.
  - Features: background safety monitoring, human-review flags via notifications, emergency support/contact webhook.
  - UI: no clinical review queue, doctor dashboard, or alert triage screen found.

- RAG knowledge management:
  - Backend: `POST /agent/knowledge/seed`.
  - UI: no UI for seeding, viewing, or managing medical knowledge.

- OCR prescription scan:
  - Backend: `POST /agent/ocr/scan`.
  - UI: no image OCR upload screen found. Existing `mobile-api/app/scan.tsx` scans QR codes and posts to `/medications/scan-qr`, not `/agent/ocr/scan`.

- Agent event endpoints:
  - Backend: `/agent/event`, `/agent/dashboard`, `/agent/dose/taken`, `/agent/dose/missed`, `/agent/refill/trigger`, `/agent/health-score`.
  - UI: mobile AI chat uses `/ai/chat`; home dashboard and medication screens use schedule/medication endpoints directly. No UI triggers the richer `/agent/*` event flows.

- Schedule creation:
  - Backend: `POST /medication-schedules`.
  - UI: no mobile screen lets the user choose schedule times after scanning medication. `mobile-api/app/(tabs)/meds.tsx` lists meds only; `mobile-api/services/schedule.service.ts` does not expose `createSchedule`.

- Medication update/delete:
  - Backend: `PATCH /medications/:id`, `DELETE /medications/:id`.
  - Mobile service methods exist, but no edit/delete screen or action was found in `mobile-api/app/(tabs)/meds.tsx`.

- Notification detail/delete/individual read:
  - Backend supports get one, mark one read, update, delete.
  - UI `mobile-api/app/notifications.tsx` lists notifications and "Read all" only; tapping a notification does not call detail/read/delete.

- Health Score history/trend:
  - Backend service has current score, history, and trend methods in `backend-api/src/health-score/health-score.service.ts`.
  - UI does not display Health Credit Score; home shows adherence plus hard-coded heart rate/sleep.

- Push/email notification preferences:
  - Backend patient fields: `push_notifications_enabled`, `email_notifications_enabled`.
  - UI support screen has local-only reminder toggles and does not persist these preferences.

### UI screens that look placeholder, mock-backed, or inconsistent

- `mobile-api/app/(tabs)/support.tsx`
  - Uses hard-coded `missedDoseAlerts` dates and local-only reminder settings.
  - Search filters static data.
  - Settings are not persisted to backend.

- `mobile-api/app/(tabs)/iot.tsx`
  - Smart Box status is not backed by a device endpoint.
  - Battery level starts at hard-coded `69` and can be changed by dragging a UI pointer.
  - "Connected", "Resync", "Calibrate", and "Test alert" are visual-only.
  - Usage data is derived from schedule history, not smartbox dose events.

- `mobile-api/app/(tabs)/home.tsx`
  - Heart Rate `72 bpm` and Sleep `7.5 hrs` are hard-coded.
  - Header always says `GOOD MORNING`, not time-aware.
  - Does not consume agent dashboard greeting even though backend has `/agent/dashboard`.

- `mobile-api/app/(tabs)/ai.tsx`
  - Welcome copy has rough text ("I am Adheronix Ai", "Hi I am Adheronix...").
  - It posts to `/ai/chat`, bypassing `/agent/chat` and the newer agentic event pipeline.
  - Styling differs from auth redesign spec and broader app uses mixed font assumptions.

- `mobile-api/app/auth/login.tsx` and `mobile-api/app/auth/signup.tsx`
  - They do not match `docs/superpowers/specs/2026-04-30-auth-screens-redesign.md`.
  - Login still asks for username instead of email.
  - Signup still asks for visible username and phone number.
  - Validation uses alerts instead of inline errors.

- `mobile-api/app/auth/profile-setup.jsx`
  - Free-text gender, conditions, and emergency contact fields.
  - No granular consent toggles.
  - Styling is separate from redesigned auth spec and main tab visual system.

- `mobile-api/README.md`
  - Still the default create-expo-app README, not project-specific.

## 6. Documented Features Not Implemented

### Root README

- "Comprehensive medication management system" is broader than current implementation; it lacks Doctor Portal, Pharmacist Portal, Smart Box backend, break-glass access, consent management, insurance sharing, field-level RBAC, and audit logs.
- "Getting Started instructions will be added here" remains placeholder.

### Backend README

- Says protected routes include `/admin/*`; implemented.
- Says consider adding audit logs before going live; audit logs are not implemented.
- Documents only two tables (`auth_patient`, `medication_info`), but current code also implements schedules, notifications, health scores, RAG table. Documentation is stale.
- Deployment note recommends `synchronize: false` and migrations in production; migrations are not present and code uses `synchronize: true`.

### Medication schedule feature doc

Implemented:

- Schedule entity/controller/service.
- Upcoming/status/history/adherence endpoints.
- Mark as taken/update status/delete schedules.
- Auto-create scheduled medication reminder notifications.

Partially or not implemented:

- Mobile "Upcoming Medications Card" with medication name/status/time-until is not present as documented.
- Mobile quick actions "Take Now" and "Skip" are not present.
- The medication list does not expose schedule creation.

### Notification docs

Implemented:

- Notification entity/service/controller.
- Scheduler.
- Admin broadcast endpoint.
- Expo push sender and patient push-token update support.

Partially or not implemented:

- `NOTIFICATION_FEATURE.md` still describes push integration as a placeholder, but source now includes an Expo Push API sender.
- Email is documented as future/optional and remains mock-only logging.
- Notification preferences, quiet hours, frequency limits, delivery channel controls are not implemented.
- WebSocket support, analytics, delivery/read-rate monitoring, retry logic are not implemented.

### Auth redesign spec

Not implemented:

- Dark premium auth design.
- Email-based login UI.
- Hidden/generated username in signup.
- Removed phone field.
- Inline validation.
- `Inter_300Light` font loading.
- No-scroll auth screens matching the spec.

### Target project description in user request

Not found in implementation:

- Doctor Portal UI.
- Pharmacist Portal UI.
- Patient Portal beyond mobile patient app.
- Smart Box firmware, Wokwi circuit, or smartbox backend endpoints.
- Deterministic local DDI database/table.
- Central DB encryption at rest controls or per-tenant/per-clinic key separation.
- Field-level RBAC for doctor/pharmacist/CHW/family.
- PHI read audit logs.
- Break-glass QR/PIN emergency access.
- Granular onboarding consent toggles.
- Insurance-score sharing integration with RSSB/Mutuelle.

## Additional Phase 0 Observations

- Current AI privacy posture is weak for the stated target: AI prompts include patient age, gender, conditions, allergies, medication names, adherence, schedule history, and sometimes patient ID. `LlamaFastService.simpleChat()` also includes extracted patient name if present. This is not a code change in Phase 0, but it is a critical alignment gap for Phase 1.
- DDI handling is not deterministic. `ddi_query` is routed to `HermesService.reason()`, which retrieves semantic RAG context and lets the LLM generate the clinical explanation.
- Smart Box is represented only by a mock-like mobile IoT tab; no raw or verified dose-event ingestion route exists.
- Stored test result JSON files show historical failing tests:
  - Auth e2e expected `200` but received `201`.
  - Notification flow had `409` and `404` failures.
- `backend-api/.env` and `test-neon.js` contain secrets/connection strings in the working tree. They should not be committed.
