import type { DigestNight } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: DigestNight }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">last status</th>
              <th scope="col">last error</th>
              <th scope="col">first at</th>
              <th scope="col">last at</th>
            </tr>
          </thead>
          <tbody>
            {[...digest.rows].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0).map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && <p class="warn">{digest.badLines} bad {digest.badLines === 1 ? 'line' : 'lines'}</p>}
    </>
  );
}
