export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  rows: DigestRow[];
  badLines: number;
};

// A missing night returns null. A present but empty night has no rows.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
