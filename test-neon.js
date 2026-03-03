const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_JPn16ALwROut@ep-misty-smoke-abhsjmsh-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const client = new Client({
  connectionString: connectionString,
});

async function testConnection() {
  try {
    console.log('Connecting to Neon DB...');
    await client.connect();
    console.log('Connected successfully!');

    const res = await client.query('SELECT current_database(), current_user, now();');
    console.log('Database info:', res.rows[0]);

    await client.end();
    console.log('Connection closed.');
  } catch (err) {
    console.error('Connection error:', err.stack);
    process.exit(1);
  }
}

testConnection();
