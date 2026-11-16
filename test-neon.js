const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required; provide it through your environment.');
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('Database connection succeeded.');
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error('Database connection failed. Check DATABASE_URL and connectivity.');
  process.exitCode = 1;
});
