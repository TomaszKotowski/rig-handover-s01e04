import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dirs: string[] = [];

function runsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-page-'));
  dirs.push(dir);
  return dir;
}

function app(dir: string) {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders sorted jobs, missing owners, original offsets, and warnings', async () => {
    const dir = runsDir();
    writeFileSync(join(dir, '2026-10-28.jsonl'), [
      { at: '2026-10-28T22:00:00+02:00', job: 'zeta', status: 'fail', owner: null, error: 'broken' },
      { at: '2026-10-28T21:00:00-04:00', job: 'alpha', status: 'retry', owner: 'Ada' },
      { at: '2026-10-28T21:01:00-04:00', job: 'alpha', status: 'retry', owner: 'Ada' },
      { at: '2026-10-28T21:02:00-04:00', job: 'alpha', status: 'retry', owner: 'Ada' },
    ].map((run) => JSON.stringify(run)).join('\n') + '\nnot json\n');

    const res = await app(dir).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<title>rig · digest · 2026-10-28</title>');
    expect(html.indexOf('<td>alpha</td>')).toBeLessThan(html.indexOf('<td>zeta</td>'));
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('2026-10-28T22:00:00+02:00');
    expect(html).toContain('2026-10-28T21:00:00-04:00');
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('1 bad line');
  });

  it('returns 404 for a missing night', async () => {
    expect((await app(runsDir()).request('/digest/2026-10-27')).status).toBe(404);
  });

  it('shows nothing ran for an empty file', async () => {
    const dir = runsDir();
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await app(dir).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});
