import { Client } from 'pg';

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export async function ensureDatabaseExists(): Promise<void> {
  const database = process.env.DB_NAME;

  if (!database) {
    throw new Error('DB_NAME is required');
  }

  const maintenanceDatabase = process.env.DB_MAINTENANCE_NAME || 'postgres';

  if (database === maintenanceDatabase) {
    return;
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: maintenanceDatabase,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
    }
  } finally {
    await client.end();
  }
}
