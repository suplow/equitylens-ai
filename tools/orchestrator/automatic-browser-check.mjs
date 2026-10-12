import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AutomaticManager } from './automatic.mjs';
import { createDashboard } from './server.mjs';

const root = mkdtempSync(join(tmpdir(), 'equity-auto-browser-'));
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
git('init'); git('config', 'user.name', 'Simulation'); git('config', 'user.email', 'simulation@localhost');
writeFileSync(join(root, 'fixture.txt'), 'fixture'); git('add', '.'); git('commit', '-m', 'fixture');
const plan = { version: 1, phases: [{ id: 'SIM', title: 'Simulation', dependencies: [], tasks: [{ id: 'SIM-1', objective: 'Simulation only', inputs: [], dependencies: [], files: ['fixture.txt'], acceptance: ['Independent review'], tests: ['simulation'], maxRetries: 0 }] }] };
const m = new AutomaticManager(root, plan, { worker: async () => ({ outcome: 'completed' }), reviewer: async () => ({ outcome: 'completed', runId: 'separate-review', verdict: { approved: true, note: 'Independent fixture checked' } }), qa: async () => [{ name: 'simulation', code: 0 }] });
const app = createDashboard(m, { port: 0 }); await app.listen();
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.getByRole('button', { name: 'Phê duyệt và chạy kế hoạch tổng thể', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('confirmation'));
  assert.equal(m.state.program, undefined);
  await page.getByLabel('Xác nhận kế hoạch tổng thể').fill(`APPROVE PROGRAM ${m.state.planHash}`);
  await page.getByRole('button', { name: 'Phê duyệt và chạy kế hoạch tổng thể', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#program-status').textContent.includes('Đang bật'));
  await page.getByRole('button', { name: 'Stop — ngừng nhận task', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#program-status').textContent.includes('Đã dừng'));
  await m.tick(); assert.equal(m.task('SIM-1').attempts, 0);
  await page.getByRole('button', { name: 'Resume chương trình đã duyệt', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#program-status').textContent.includes('Đang bật'));
  for (let i = 0; i < 4; i++) await m.tick();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.state').textContent === 'ACCEPTED');
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  assert.deepEqual(errors, []); console.log('PASS automatic dashboard: explicit program approval, stop/resume, independent review, acceptance, mobile/desktop. SIM only.');
} finally { await browser.close(); await new Promise(r => app.server.close(r)); m.close(); }
