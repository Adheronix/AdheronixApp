## Medisafe Patient Backend

NestJS + PostgreSQL service that lets patients register, authenticate with JWT, and manage QR-derived medication schedules. The API is designed for a companion mobile client that scans medication QR codes and submits the decoded payload to the backend for storage and reminders.

---

## Tech Stack

- NestJS 11 (REST API)
- TypeORM 0.3 (data access)
- PostgreSQL 14+
- Passport + JWT (auth)
- Bcrypt (password hashing)

---

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL instance reachable from the API

---

## Environment Setup

1. Copy `.env.example` (or use the provided `.env`) and update secrets:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
DB_NAME=medisafe_patient_db
JWT_SECRET=replace-with-strong-secret
ADMIN_SETUP_KEY=replace-with-admin-setup-key
PORT=3000
```

2. Install dependencies:

```bash
npm install
```

3. Ensure the `medisafe_patient_db` database exists:

```bash
createdb medisafe_patient_db
# or use psql / pgAdmin
```

4. Start the API:

```bash
npm run start:dev   # watch mode
# or
npm run start       # single run
```

The server listens on `http://localhost:3000` by default.

---

## Project Structure

- `src/app.module.ts` – Config + TypeORM bootstrap
- `src/patient` – patient entity, DTOs, auth controller/service
- `src/medication` – medication entity, DTOs, controller/service
- `src/auth` – JWT strategy + guard
- `src/main.ts` – Nest bootstrap with global validation

Entities:

| Table            | Purpose                            |
| ---------------- | ---------------------------------- |
| `auth_patient`   | Patient identity + hashed password |
| `medication_info`| QR-derived prescriptions           |

---

## Patient Authentication Flow

1. **Register** – `POST /patient/register`

   ```json
   {
     "email": "user@example.com",
     "username": "jane",
     "password": "StrongPass123"
   }
   ```

   Response:

   ```json
   {
     "access_token": "<JWT>",
     "patient": {
       "patient_id": "uuid",
       "email": "user@example.com",
       "username": "jane",
       "role": "patient",
       "created_at": "2025-01-01T00:00:00.000Z",
       "updated_at": "2025-01-01T00:00:00.000Z"
     }
   }
   ```

2. **Login** – `POST /patient/login`

   ```json
   {
     "email": "user@example.com",
     "password": "StrongPass123"
   }
   ```

   Response shape is identical to registration (fresh JWT + patient profile).

3. **Use the token** – add `Authorization: Bearer <access_token>` to every protected request (all `/medications/*` and `/admin/*` routes).

---

## What Patients Can Do After Logging In

Once authenticated, a patient can:

- **Scan and store QR prescriptions** via `POST /medications/scan-qr`.
- **List their medication schedule** with `GET /medications`.
- **Inspect a specific entry** via `GET /medications/:id`.
- **Update the stored metadata** (`intake_recommendation`, `period`, `source`, or entire `prescription` JSON) using `PATCH /medications/:id`.
- **Delete outdated prescriptions** with `DELETE /medications/:id`.

All of these operations are scoped to the authenticated patient ID enforced by the JWT strategy.

---

## Medication QR Workflow

1. Mobile app scans QR and decodes JSON (see example below).
2. App calls `POST /medications/scan-qr` with the token and payload:

```json
{
  "prescription": {
    "type": "patient_med_list_v1",
    "prescription": [
      { "name": "Amoxicillin", "dose": "500mg", "freq": "3/day" }
    ],
    "intake_recommendation": "Take after meals",
    "period": "7 days",
    "issued_by": "Pharmacy ABC",
    "issued_at": "2025-11-20T10:10:00Z"
  },
  "intake_recommendation": "Take after meals",
  "period": "7 days",
  "source": "pharmacist"
}
```

3. Backend verifies JWT, links the medication to the patient, and stores the JSON blob for later schedule/reminder use.

> **Tip:** Add optional backend validation for specific QR schema keys (e.g., `type === "patient_med_list_v1"`).

---

## Roles & Admin Workflow

- **Roles**: every account is either `patient` (default) or `admin`. The role is embedded in the JWT payload and enforced through `RolesGuard`.

Admin lifecycle:

1. **Sign up** – call `POST /admin/register` with the usual registration fields **plus** `adminKey` that must match `ADMIN_SETUP_KEY` from the environment.

   ```json
   {
     "email": "admin@example.com",
     "username": "ops-team",
     "password": "AdminPass!234",
     "adminKey": "replace-with-admin-setup-key"
   }
   ```

2. **Sign in** – use the standard `POST /patient/login` endpoint. The returned JWT will contain `"role": "admin"`.
3. **Authorize** – in Swagger or any client, send `Authorization: Bearer <token>`. All `/admin/*` routes additionally check the `admin` role.
4. **Capabilities** – admins can list, inspect, or delete any patient or medication in the system to support audits, incident response, or compliance tasks.

---

## Key Endpoints

| Method | Path                      | Auth | Description                               |
| ------ | ------------------------- | ---- | ----------------------------------------- |
| POST   | `/patient/register`       | ❌   | Create a new patient + token              |
| POST   | `/patient/login`          | ❌   | Authenticate + token                      |
| POST   | `/medications/scan-qr`    | ✅   | Store QR prescription for patient         |
| GET    | `/medications`            | ✅   | List meds for authenticated patient       |
| GET    | `/medications/:id`        | ✅   | Fetch a single medication                 |
| PATCH  | `/medications/:id`        | ✅   | Update medication fields                  |
| DELETE | `/medications/:id`        | ✅   | Remove a medication record                |
| POST   | `/admin/register`         | ❌   | Create an admin (needs `ADMIN_SETUP_KEY`) |
| GET    | `/admin/patients`         | ✅*  | List all patients (admin role)            |
| GET    | `/admin/patients/:id`     | ✅*  | Inspect a patient + meds                  |
| DELETE | `/admin/patients/:id`     | ✅*  | Remove a patient                          |
| GET    | `/admin/medications`      | ✅*  | List all medications                      |
| GET    | `/admin/medications/:id`  | ✅*  | Inspect a medication                      |
| DELETE | `/admin/medications/:id`  | ✅*  | Remove any medication                     |

`✅*` = requires JWT with `admin` role.

All protected routes use the `JwtAuthGuard`.

---

## Scripts

| Command            | Description                   |
| ------------------ | ----------------------------- |
| `npm run start`    | Start in production mode      |
| `npm run start:dev`| Start with hot reload         |
| `npm run build`    | Compile to `dist/`            |
| `npm run lint`     | ESLint w/ auto-fix            |
| `npm run test`     | Jest unit tests (placeholder) |

---

## API Docs (Swagger)

- Swagger UI is available at `http://localhost:3000/docs` or `http://localhost:3000/api-docs`.
- OpenAPI spec updates automatically from DTO/controller decorators.
- Use the **Authorize** button in Swagger to paste your `Bearer <token>` for protected routes (admin tokens unlock `/admin/*` operations).

---

## Deployment Notes

- Set `synchronize: false` and run TypeORM migrations in production.
- Provide strong secrets (`JWT_SECRET`, DB password) via environment variables or a secret manager.
- Consider adding rate limiting, refresh tokens, and audit logs before going live.

---

## Contributing

1. Fork / branch from `main`.
2. Run `npm run lint` before committing.
3. Open a PR describing the change and testing evidence.

---

## License

MIT © 2025 Medisafe Patient Backend Contributors"# medisafe-pharmacist-backend" 
