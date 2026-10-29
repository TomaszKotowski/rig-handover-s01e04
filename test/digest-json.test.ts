import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/reader.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON', () => {
  it('returns the reader rows in job order for a night on disk', async () => {
    const response = await createApp(config).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const rows = await response.json();
    expect(rows).toEqual(readNight(config.runsDir, '2026-10-28')?.rows);
    expect(rows).toHaveLength(5);
    expect(rows.map((row: { job: string }) => row.job)).toEqual(
      [...rows.map((row: { job: string }) => row.job)].sort(),
    );
  });

  it('returns 404 for a missing or invalid night', async () => {
    const app = createApp(config);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/not-a-night')).status).toBe(404);
  });
});
