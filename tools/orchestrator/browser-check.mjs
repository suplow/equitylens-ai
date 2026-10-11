import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Manager } from './core.mjs';
import { createDashboard } from './server.mjs';

const root = mkdtempSync(join(tmpdir(), 'equity-orchestrator-browser-'));
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
git('init'); git('config', 'user.email', 'test@localhost'); git('config', 'user.name', 'Test'); writeFileSync(join(root, 'fixture.txt'), 'no app data'); git('add', '.'); git('commit', '-m', 'fixture');
const plan = { version: 1, phases: [{ id: 'SIM', title: 'Browser simulation', dependencies: [], tasks: [{ id: 'SIM-1', objective: 'Harmless local task', inputs: [], dependencies: [], files: ['fixture.txt'], acceptance: ['Independent verification'], tests: ['simulation'], maxRetries: 1 }] }] };
const manager = new Manager(root, plan, { qa: async () => [{ name: 'simulation', code: 0 }] });
const app = createDashboard(manager, { port: 0 }); await app.listen();
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => {
    const text = dialog.message();
    if (text.includes('APPROVE SIM')) dialog.accept('APPROVE SIM');
    else if (text.includes('ACCEPT SIM')) dialog.accept('ACCEPT SIM');
    else if (text.includes('commit SHA')) dialog.accept(git('rev-parse', 'HEAD'));
    else dialog.accept('Independent simulated fixture review');
  });
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.getByRole('button', { name: 'Approve phase', exact: true }).click();
  await page.getByRole('button', { name: 'Start Approved Phase', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Stop — ngừng nhận task', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.state')?.textContent === 'RUNNING');
  await manager.tick(); await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByRole('button', { name: 'Submit manual handoff', exact: true }).click();
  await page.getByRole('button', { name: 'Record independent review', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.task h3')?.textContent.includes('ACCEPTED'));
  await page.getByRole('button', { name: 'Accept outcome', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.state')?.textContent === 'ACCEPTED');
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  assert.deepEqual(errors, []); assert.equal(manager.view().phases[0].state, 'ACCEPTED');
  console.log('PASS: local Chrome approve/start/pause/resume/stop/manual handoff/QA/review/accept; 390px and 1440px; no runtime errors. Only SIM fixture ran.');
} finally { await browser.close(); await new Promise(resolve => app.server.close(resolve)); manager.close(); rmSync(root, { recursive: true, force: true }); }
