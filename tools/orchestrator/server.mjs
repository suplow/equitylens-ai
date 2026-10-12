import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AutomaticManager } from './automatic.mjs';
import { codexWorker, qaRunner } from './worker.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export function createDashboard(manager, { port = 4310 } = {}) {
  const session = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const expectedHost = `127.0.0.1:${server.address().port}`;
    const origin = `http://${expectedHost}`;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const reply = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Local same-origin access only' });
    const cookie = (req.headers.cookie || '').split('; ').find(c => c.startsWith('equity_owner='))?.slice(13) || '';
    const supplied = Buffer.from(cookie); const expected = Buffer.from(session);
    const authenticated = supplied.length === expected.length && timingSafeEqual(supplied, expected);
    try {
      if (req.method === 'GET' && req.url === '/') {
        // Local operator session, never inserted into HTML, URL, storage, logs or worker env.
        res.setHeader('Set-Cookie', `equity_owner=${session}; HttpOnly; SameSite=Strict; Path=/`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(readFileSync(join(here, 'dashboard.html')));
      }
      if (req.method === 'GET' && ['/dashboard.js', '/dashboard.css'].includes(req.url)) {
        res.writeHead(200, { 'Content-Type': req.url.endsWith('.js') ? 'text/javascript' : 'text/css' }); return res.end(readFileSync(join(here, req.url.slice(1))));
      }
      if (!authenticated) return reply(403, { error: 'Open the local dashboard first' });
      if (req.method === 'GET' && req.url === '/api/state') return reply(200, manager.view());
      if (req.method !== 'POST' || req.url !== '/api/action') return reply(404, { error: 'Not found' });
      if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return reply(403, { error: 'Same-origin JSON required' });
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) return reply(413, { error: 'Request too large' }); }
      const input = JSON.parse(body);
      if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.action !== 'string') throw Error('Invalid action');
      if (input.revision !== manager.state.revision) return reply(409, { error: 'State changed; refresh before acting' });
      const { action, id, confirmation } = input;
      if (['approve', 'accept', 'reconcile'].includes(action) && confirmation !== `${action.toUpperCase()} ${id}`) throw Error('Explicit owner confirmation required');
      switch (action) {
        case 'approveProgram': manager.approveProgram(confirmation); break;
        case 'resumeProgram': manager.resumeProgram(); break;
        case 'approve': manager.approve(id); break;
        case 'start': manager.start(id); break;
        case 'pause': manager.pause(id); break;
        case 'resume': manager.resume(id); break;
        case 'stop': manager.stop(); break;
        case 'accept': manager.accept(id); break;
        case 'review': manager.review(id, input.note); break;
        case 'handoff': await manager.handoff(id, input.commit); break;
        case 'reconcile': manager.reconcile(id, input.fingerprint); break;
        case 'reverify': await manager.reverify(id); break;
        default: throw Error('Unsupported action');
      }
      manager.export(); reply(200, { ok: true });
    } catch (error) { reply(400, { error: error instanceof SyntaxError ? 'Invalid JSON' : error.message }); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  return { server, listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(a => !a.startsWith('--codex=') && !a.startsWith('--port='))) throw Error('Supported options: --port=4310 --codex=<absolute executable>');
  const root = resolve(here, '../..');
  const plan = JSON.parse(readFileSync(join(here, 'plan.json'), 'utf8'));
  const executable = args.find(a => a.startsWith('--codex='))?.slice(8);
  const port = Number(args.find(a => a.startsWith('--port='))?.slice(7) || 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid port');
  const manager = new AutomaticManager(root, plan, { worker: executable ? codexWorker(executable) : null, reviewer: executable ? codexWorker(executable, { review: true }) : null, qa: qaRunner });
  const dashboard = createDashboard(manager, { port }); await dashboard.listen(); manager.export();
  console.log(`EquityLens Project Manager: http://127.0.0.1:${port} (${executable ? 'Codex opt-in' : 'manual fallback'})`);
  console.log('No phase starts without owner approval. Stop drains active work; never kills unrelated processes.');
  const timer = setInterval(() => { manager.tick().then(() => manager.export()).catch(() => { manager.stop(); console.error('Scheduler stopped: inspect state and Git before recovery'); }); }, 5000);
  function shutdown() {
    clearInterval(timer); manager.stop();
    const drain = setInterval(() => { if (!manager.busy) { clearInterval(drain); dashboard.server.close(() => { manager.export(); manager.close(); }); } }, 500);
    console.log('Stopped scheduling. Waiting for active worker/QA to end; force closing requires manual recovery.');
  }
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
