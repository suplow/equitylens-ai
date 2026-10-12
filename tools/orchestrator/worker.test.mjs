import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { codexWorker, qaRunner, workerEnv } from './worker.mjs';

async function run(events, code = 0, suffix = '', review = false) {
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 123;
  const worker = codexWorker(process.execPath, {
    review,
    authenticate: () => ({ status: 0, stdout: '', stderr: 'Logged in using ChatGPT' }),
    launch: (_file, args, options) => {
      assert.ok(args.includes('--json')); assert.ok(args.includes(review ? 'read-only' : 'workspace-write'));
      assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
      return child;
    },
  });
  const promise = worker({ id: 'SIM' }, { root: process.cwd(), onPid() {}, onRunId() {} });
  child.stdout.write(events.map(e => JSON.stringify(e)).join('\n') + '\n' + suffix);
  child.emit('close', code);
  return promise;
}
const started = { type: 'thread.started', thread_id: 'simulation-1' };
test('independent reviewer uses read-only sandbox and returns a structured verdict', async () => {
  const result = await run([started, { type: 'item.completed', item: { type: 'agent_message', text: '{"approved":false,"note":"missing evidence"}' } }, { type: 'turn.completed' }], 0, '', true);
  assert.deepEqual(result.verdict, { approved: false, note: 'missing evidence' });
  const invalid = await run([started, { type: 'item.completed', item: { type: 'agent_message', text: 'looks good' } }, { type: 'turn.completed' }], 0, '', true);
  assert.equal(invalid.verdict, null);
});
test('worker confirms a complete observed run and recognizes an explicit quota code', async () => {
  assert.equal((await run([started, { type: 'turn.completed' }])).outcome, 'completed');
  assert.equal((await run([started, { type: 'turn.failed', error: { code: 'quota_exceeded' } }], 1)).outcome, 'quota');
});
test('worker fails closed on contradictory terminal events, missing identity and truncated output', async () => {
  for (const events of [
    [started, { type: 'turn.completed' }, { type: 'turn.failed' }],
    [started, { type: 'turn.failed' }, { type: 'turn.completed' }],
    [{ type: 'turn.completed' }],
  ]) assert.equal((await run(events)).outcome, 'unknown');
  assert.equal((await run([started, { type: 'turn.completed' }], 0, '{"type":')).outcome, 'unknown');
});
test('worker credentials are never inherited and API-key login fails closed', () => {
  assert.deepEqual(workerEnv({ PATH: 'os', OPENAI_API_KEY: 'test-not-a-key', CODEX_API_KEY: 'test-not-a-key', CODEX_HOME: 'override', SESSION: 'private' }), { PATH: 'os' });
  assert.throws(() => codexWorker(process.execPath, { authenticate: () => ({ status: 0, stdout: 'Logged in using an API key', stderr: '' }) }), /No API-key fallback/);
});
test('QA preserves an explicitly selected browser without passing provider credentials', async () => {
  const before = process.env.PLAYWRIGHT_CHANNEL;
  process.env.PLAYWRIGHT_CHANNEL = 'chrome';
  let seen;
  try {
    const result = await qaRunner(['test:e2e'], process.cwd(), { launch: (_exe, _args, options) => {
      seen = options.env;
      const child = new EventEmitter(); queueMicrotask(() => child.emit('close', 0)); return child;
    } });
    assert.deepEqual(result, [{ name: 'test:e2e', code: 0 }]);
    assert.equal(seen.PLAYWRIGHT_CHANNEL, 'chrome');
    assert.equal(seen.OPENAI_API_KEY, undefined);
  } finally { if (before === undefined) delete process.env.PLAYWRIGHT_CHANNEL; else process.env.PLAYWRIGHT_CHANNEL = before; }
});
