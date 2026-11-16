-- Apply before deploying the patient experience backend to an existing database.
-- Historical entries intentionally retain NULL: their origin is unknown.
BEGIN;
ALTER TABLE medication_schedules
  ADD COLUMN IF NOT EXISTS confirmation_source varchar NULL;
COMMENT ON COLUMN medication_schedules.confirmation_source IS
  'patient for explicit patient confirmation; NULL for historical or unconfirmed records. Device removal is never ingestion confirmation.';
COMMIT;
