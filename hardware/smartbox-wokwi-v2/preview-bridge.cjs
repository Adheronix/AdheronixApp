// Optional local development bridge. Never expose the complete application API.
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
function createBridge(config) {
  const cache = new Map();
  let minute = 0, requests = 0;
  return http.createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (Date.now() > config.expiresAt) return reply(410, { message: 'Preview session expired' });
    const actual = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? ''), expected = Buffer.from(config.bridgeKey);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return reply(401, { message: 'Preview authentication required' });
    const slot = Math.floor(Date.now() / 60000); if (slot !== minute) { minute = slot; requests = 0; }
    if (++requests > 40) return reply(429, { message: 'Preview rate limit' });
    const schedule = '/api/smartbox/' + config.deviceId + '/schedule';
    if (!((req.method === 'GET' && req.url === schedule) || (req.method === 'POST' && ['/api/smartbox/weight', '/api/smartbox/dose-event'].includes(req.url)))) return reply(404, { message: 'Preview route not available' });
    try {
      let body, fingerprint;
      if (req.method === 'POST') {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 2048) return reply(413, { message: 'Payload too large' }); }
        try { body = JSON.parse(raw); } catch { return reply(400, { message: 'Invalid JSON' }); }
        if (!body || typeof body !== 'object' || body.deviceId !== config.deviceId || Object.hasOwn(body, 'patientId')) return reply(403, { message: 'Only the synthetic preview device is permitted' });
        const weight = req.url.endsWith('/weight');
        const fields = weight ? ['deviceId', 'weightG', 'pillsEst', 'source'] : ['deviceId', 'binIndex', 'timestamp', 'confirmed', 'weightBefore', 'weightAfter', 'weightLeftG', 'pillsRemaining'];
        if (Object.keys(body).some(k => !fields.includes(k))) return reply(400, { message: 'Unexpected field' });
        if (!weight) {
          if (typeof body.timestamp !== 'string' || !Number.isFinite(Date.parse(body.timestamp)) || body.binIndex !== 0) return reply(400, { message: 'Valid observation timestamp and bin required' });
          fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
          const previous = cache.get(fingerprint); if (previous) return reply(200, previous);
        }
      }
      const upstream = await fetch(config.upstream + req.url, { method: req.method, headers: { Authorization: 'Bearer ' + config.deviceKey, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) return reply(upstream.status, { message: 'Device request rejected by local API' });
      if (req.method === 'GET') {
        const text = await upstream.text(); res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end(text);
      } else {
        const result = await upstream.json(); const safe = { received: result.received === true, status: result.status, patientConfirmed: false };
        if (fingerprint) { if (cache.size >= 500) cache.delete(cache.keys().next().value); cache.set(fingerprint, safe); }
        reply(200, safe);
      }
      console.log(new Date().toISOString(), req.method, req.url.endsWith('/schedule') ? 'schedule' : req.url.endsWith('/weight') ? 'weight' : 'removal', 200);
    } catch { reply(502, { message: 'Local device service unavailable' }); }
  });
}
module.exports = { createBridge };
if (require.main === module) {
  const location = process.argv[2];
  if (!location) throw new Error('Usage: node preview-bridge.cjs /absolute/private/hardware-config.json');
  const config = JSON.parse(fs.readFileSync(location, 'utf8'));
  if (!config.deviceId.startsWith('WOKWI-PREVIEW-')) throw new Error('Only synthetic preview devices are supported');
  const server = createBridge({ ...config, upstream: 'http://127.0.0.1:3250' });
  server.requestTimeout = 10000;server.headersTimeout = 10000;
  server.listen(3256, '127.0.0.1', () => console.log('Synthetic MediBox bridge on 127.0.0.1:3256; expires ' + new Date(config.expiresAt).toISOString()));
}
