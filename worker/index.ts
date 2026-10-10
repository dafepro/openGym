import garmin from './garmin';
export { GarminRelay } from './garmin';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
// Browser/Drive deployment: the existing Node account/coach backend is optional.
export default {
  async fetch(request: Request, env: Parameters<typeof garmin.fetch>[1]) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/garmin/')) return garmin.fetch(request, env);
    if (path === '/api/config' && request.method === 'GET') return json({ allow_guest: true, local_only: true });
    if (path === '/api/me') return json({ error: 'No account server on this host.' }, 401);
    if (path.startsWith('/api/')) return json({ error: 'This host uses local storage and optional Google Drive.' }, 503);
    return env.ASSETS.fetch(request);
  },
};
