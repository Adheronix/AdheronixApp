const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'medisafe_patient_db',
  password: 'postgres',
  port: 5432,
});

client.connect()
  .then(() => {
    console.log('Connected successfully');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Result:', res.rows[0]);
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error', err.stack);
    process.exit(1);
  });
