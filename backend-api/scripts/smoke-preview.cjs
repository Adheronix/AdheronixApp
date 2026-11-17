const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
async function main() {
  if (process.env.ALLOW_PREVIEW_SMOKE_TEST !== 'yes' || !/^adheronix(?:_[a-z0-9]+)*$/.test(process.env.DB_NAME || '')) throw new Error('Opt in only against a dedicated disposable Adheronix preview database.');
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD });
  await db.connect();
  try {
    const role = (await db.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(role, { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
    await db.query('BEGIN');
    let denied = false;
    try { await db.query('CREATE TABLE public.adheronix_permission_probe (id int)'); }
    catch (error) { denied = error.code === '42501'; }
    finally { await db.query('ROLLBACK'); }
    assert.equal(denied, true, 'Runtime role must not create tables');
  } finally { await db.end(); }
  const base = 'http://127.0.0.1:3000';
  async function call(route, method = 'GET', body, token, status = 200) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, status, `${method} ${route} returned ${response.status}`);
    return response.json();
  }
  await call('/ready');
  const stamp = randomBytes(6).toString('hex');
  const password = randomBytes(20).toString('base64url');
  const account = { username: 'release_' + stamp, email: 'release_' + stamp + '@example.com', full_names: 'Synthetic release check', password };
  const first = await call('/patient/register', 'POST', account, undefined, 201);
  assert.ok(first.access_token);
  assert.equal(first.patient.password_hash, undefined);
  const login = await call('/patient/login', 'POST', { username: account.username, password });
  const token = login.access_token;
  assert.ok(token);
  const profile = await call('/patient/profile', 'GET', undefined, token);
  assert.equal(profile.username, account.username);
  assert.equal(profile.password_hash, undefined);
  const med = await call('/medications', 'POST', { prescription: { name: 'Synthetic preview item', dose: 'Simulation only' }, intake_recommendation: 'Disposable verification fixture', period: '1 day', source: 'patient', frequency: 1 }, token, 201);
  assert.equal(med.source, 'patient');
  await call('/medication-schedules', 'POST', { medication_id: med.medication_id, times: ['23:59'], replace_pending: true }, token, 201);
  const history = await call('/medication-schedules/history', 'GET', undefined, token);
  assert.ok(history.length);
  await call('/medication-schedules/' + history[0].schedule_id + '/taken', 'PATCH', {}, token);
  const confirmed = await call('/medication-schedules/history', 'GET', undefined, token);
  assert.equal(confirmed.find(d => d.schedule_id === history[0].schedule_id).confirmation_source, 'patient');
  const second = await call('/patient/register', 'POST', { ...account, username: account.username + 'b', email: 'second_' + stamp + '@example.com' }, undefined, 201);
  await call('/medications/' + med.medication_id, 'GET', undefined, second.access_token, 404);
  await call('/api/smartbox/weight', 'POST', { deviceId: 'UNPAIRED-PREVIEW', weightG: 20 }, undefined, 401);
  const scoped = await call('/ai/chat', 'POST', { messages: [{ role: 'user', content: 'write a servlet in java' }], patient_context: false }, token);
  assert.equal(scoped.response_kind, 'scope');
  console.log('PASS: fresh production schema, migration replay, runtime DDL denial, readiness, registration/login, patient isolation, medication/schedule confirmation, device authentication and care chat scope.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
