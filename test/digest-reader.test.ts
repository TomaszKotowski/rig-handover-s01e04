import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const fixtureDir = dirname(fileURLToPath(new URL('../runs/2026-10-28.jsonl', import.meta.url)));
const tempDirs: string[] = [];

function nightWith(...lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), lines.join('\n'));
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('groups the fixture into five jobs and counts its malformed line', () => {
    const night = readNight(fixtureDir, '2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(night?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(night?.rows[0]).toEqual({
      job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok',
      lastError: null, firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00',
    });
    expect(night?.rows[1]).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok',
      lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night?.rows[2]).toEqual({
      job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok',
      lastError: 'lock held', firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(night?.rows[3]).toMatchObject({
      owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
    });
  });

  it('distinguishes a missing night from an empty file', () => {
    const dir = nightWith();
    expect(readNight(dir, '2026-10-28')).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    expect(readNight(dir, '2026-10-27')).toBeNull();
    expect(readNight(dir, '../2026-10-28')).toBeNull();
  });

  it('counts invalid records and internal blank lines without losing valid runs', () => {
    const dir = nightWith(
      '{bad json',
      '',
      'null',
      JSON.stringify({ at: '2026-10-28T10:00:00+01:00', job: 'a', status: 'unknown', owner: null }),
      JSON.stringify({ at: '2026-10-28T10:00:00+01:00', job: 'a', status: 'ok' }),
      JSON.stringify({ at: '2026-10-28T10:00:00+01:00', job: 'a', status: 'ok', owner: null }),
      '',
    );
    expect(readNight(dir, '2026-10-28')).toMatchObject({ badLines: 5, rows: [{ job: 'a', runs: 1 }] });
  });

  it('uses actual time order across offsets, preserving the original timestamps', () => {
    const dir = nightWith(
      JSON.stringify({ at: '2026-10-28T11:00:00+02:00', job: 'a', status: 'fail', owner: 'later', error: 'oops' }),
      JSON.stringify({ at: '2026-10-28T09:30:00+01:00', job: 'a', status: 'retry', owner: null, error: 'try again' }),
      JSON.stringify({ at: '2026-10-28T10:15:00+01:00', job: 'a', status: 'ok', owner: 'latest' }),
    );
    expect(readNight(dir, '2026-10-28')?.rows).toEqual([{
      job: 'a', owner: 'latest', runs: 3, retries: 1, lastStatus: 'ok', lastError: 'oops',
      firstAt: '2026-10-28T09:30:00+01:00', lastAt: '2026-10-28T10:15:00+01:00',
    }]);
  });
});
