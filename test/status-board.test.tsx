import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it('links every night and counts jobs by last status, not log events', async () => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-board-'));
  tempDirs.push(runsDir);
  const event = (job: string, status: string) => JSON.stringify({
    at: '2026-10-28T10:00:00+01:00', job, status, owner: null,
  });
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
    event('recovered', 'retry'), event('recovered', 'ok'),
    event('still-trying', 'retry'), event('failed', 'fail'),
    '{bad json',
  ].join('\n'));
  writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');

  const response = await createApp({
    adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir,
  }).request('/');
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · 1 ok / 1 retry / 1 fail');
  expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a> · 0 ok / 0 retry / 0 fail');
  expect(html.indexOf('/digest/2026-10-28')).toBeLessThan(html.indexOf('/digest/2026-10-27'));
  expect(html).toContain('Counts are jobs by last status, not log events.');
});
