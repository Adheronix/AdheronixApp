/* Fresh, isolated Adheronix databases only; never import an existing app's data. */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const crypto = require('node:crypto');
const file = path.join(__dirname, '../migrations/20261117-initial-preview.sql');
const sql = fs.readFileSync(file, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
async function main() {
  if (!/^adheronix(?:_[a-z0-9]+)*$/.test(process.env.DB_NAME || ''))
    throw new Error('Migration requires a dedicated adheronix database name.');
  if ((process.env.APP_DB_PASSWORD || '').length < 32)
    throw new Error('Set a separate random APP_DB_PASSWORD of at least 32 characters.');
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('adheronix-schema-migrations'))");
    const tracked = await db.query("SELECT to_regclass('public.adheronix_schema_migrations') AS name");
    if (!tracked.rows[0].name) {
      const existing = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
      if (existing.rowCount) throw new Error('Refusing an unversioned existing schema; review an explicit upgrade separately.');
      await db.query('CREATE TABLE public.adheronix_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    }
    const applied = await db.query('SELECT checksum FROM public.adheronix_schema_migrations WHERE name=$1', [path.basename(file)]);
    if (applied.rowCount && applied.rows[0].checksum !== checksum) throw new Error('Applied migration checksum differs; refusing to continue.');
    if (!applied.rowCount) {
      await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await db.query('CREATE EXTENSION IF NOT EXISTS vector');
      await db.query(sql);
      await db.query('INSERT INTO public.adheronix_schema_migrations(name,checksum) VALUES($1,$2)', [path.basename(file), checksum]);
    }
    const role = await db.query("SELECT 1 FROM pg_roles WHERE rolname='adheronix_api'");
    if (!role.rowCount) {
      const statement = await db.query("SELECT format('CREATE ROLE adheronix_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', $1::text) AS sql", [process.env.APP_DB_PASSWORD]);
      await db.query(statement.rows[0].sql);
    }
    // Do not rotate an existing role's password implicitly during deployment.
    const grant = await db.query("SELECT format('GRANT CONNECT ON DATABASE %I TO adheronix_api', current_database()) AS sql");
    await db.query(grant.rows[0].sql);
    await db.query('GRANT USAGE ON SCHEMA public TO adheronix_api');
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'adheronix_schema_migrations'");
    for (const table of tables.rows) {
      const query = await db.query("SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO adheronix_api', $1::text) AS sql", [table.tablename]);
      await db.query(query.rows[0].sql);
    }
    await db.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO adheronix_api');
    await db.query('COMMIT');
    console.log(applied.rowCount ? 'Schema checksum verified; runtime grants checked.' : 'Fresh preview schema applied; separate runtime role provisioned.');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}
main().catch(error => { console.error('Migration failed:', error.message); process.exitCode = 1; });
