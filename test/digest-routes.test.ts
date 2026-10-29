import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dirs: string[] = [];
const nights = ['2026-10-27', '2026-10-28'];

function runsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  dirs.push(dir);
  return dir;
}

function app(runsDir: string) {
  return createApp({
    adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir,
  });
}

function jobsInPage(html: string) {
  const body = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? '';
  return [...body.matchAll(/<tr>\s*<td>([^<]+)<\/td>/g)].map((match) => match[1]);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('returns 404 from both routes when the night has no file', async () => {
    const server = app(runsDir());
    expect((await server.request('/digest/2026-10-26')).status).toBe(404);
    expect((await server.request('/api/digest/2026-10-26')).status).toBe(404);
  });

  it('renders nothing ran and returns no JSON rows for an empty night', async () => {
    const dir = runsDir();
    writeFileSync(join(dir, '2026-10-26.jsonl'), '');
    const server = app(dir);
    const page = await server.request('/digest/2026-10-26');
    const json = await server.request('/api/digest/2026-10-26');

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(json.headers.get('content-type')).toContain('application/json');
    expect(await json.json()).toEqual([]);
  });

  it('keeps valid jobs in both routes when a line is malformed', async () => {
    const dir = runsDir();
    writeFileSync(join(dir, '2026-10-26.jsonl'), [
      JSON.stringify({ at: '2026-10-26T23:00:00+01:00', job: 'zeta', status: 'fail', owner: null }),
      '{bad json',
      JSON.stringify({ at: '2026-10-26T22:00:00+01:00', job: 'alpha', status: 'ok', owner: 'rook' }),
    ].join('\n'));
    const server = app(dir);
    const page = await server.request('/digest/2026-10-26');
    const json = await server.request('/api/digest/2026-10-26');

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('1 bad line');
    const rows: { job: string }[] = await json.json();
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(jobsInPage(html)).toEqual(rows.map((row) => row.job));
  });

  it('links both fixture nights from the board to working HTML and JSON digests', async () => {
    const dir = runsDir();
    for (const night of nights) {
      copyFileSync(fileURLToPath(new URL(`../runs/${night}.jsonl`, import.meta.url)), join(dir, `${night}.jsonl`));
    }
    const server = app(dir);
    const board = await server.request('/');
    expect(board.status).toBe(200);
    const links = [...(await board.text()).matchAll(/<a href="(\/digest\/\d{4}-\d{2}-\d{2})">([^<]+)<\/a>/g)];
    expect(links.map(([, href, label]) => [href, label])).toEqual([
      ['/digest/2026-10-28', '2026-10-28'],
      ['/digest/2026-10-27', '2026-10-27'],
    ]);

    for (const [, href, night] of links) {
      const page = await server.request(href);
      const json = await server.request(`/api/digest/${night}`);
      expect(page.status).toBe(200);
      expect(json.status).toBe(200);
      const rows: { job: string }[] = await json.json();
      expect(jobsInPage(await page.text())).toEqual(rows.map((row) => row.job));
      expect(rows.length).toBeGreaterThan(0);
    }
  });
});
