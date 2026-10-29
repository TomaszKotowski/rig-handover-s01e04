import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Run = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function parseRun(line: string): Run | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const run = value as Record<string, unknown>;
  const { at, job, status, owner, error } = run;
  if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) ||
      !Number.isFinite(Date.parse(at)) || typeof job !== 'string' || job.length === 0 ||
      (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
      (typeof owner !== 'string' && owner !== null) ||
      (error !== undefined && typeof error !== 'string')) return null;

  return {
    at, job, status, owner,
    ...(error === undefined ? {} : { error }),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  const lastErrorAt = new Map<string, number>();
  let badLines = 0;
  const counts = { ok: 0, retry: 0, fail: 0 };
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    const run = parseRun(line);
    if (!run) {
      badLines++;
      continue;
    }
    counts[run.status]++;

    const row = rows.get(run.job);
    const at = Date.parse(run.at);
    if (run.error !== undefined && at >= (lastErrorAt.get(run.job) ?? -Infinity)) {
      lastErrorAt.set(run.job, at);
    }
    if (!row) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error ?? null,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }

    row.runs++;
    if (run.status === 'retry') row.retries++;
    if (at < Date.parse(row.firstAt)) row.firstAt = run.at;
    if (at >= Date.parse(row.lastAt)) {
      row.lastAt = run.at;
      row.lastStatus = run.status;
      row.owner = run.owner;
    }
    if (run.error !== undefined && at === lastErrorAt.get(run.job)) row.lastError = run.error;
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0),
    badLines,
    counts,
  };
};
