import { expect, it, vi } from 'vitest';
import worker from './index';
const assets = { fetch: vi.fn(async () => new Response('asset')) };
const env = { ASSETS: assets, GARMIN_ENABLED: 'false' } as Parameters<typeof worker.fetch>[1];
it('serves only the built asset binding and keeps local-only API labels accurate', async () => {
  const config = await worker.fetch(new Request('https://host.test/api/config'), env);
  expect(await config.json()).toEqual({ allow_guest: true, local_only: true });
  expect(config.headers.get('cache-control')).toBe('no-store');
  expect((await worker.fetch(new Request('https://host.test/api/me'), env)).status).toBe(401);
  expect((await worker.fetch(new Request('https://host.test/api/state'), env)).status).toBe(503);
  expect(await (await worker.fetch(new Request('https://host.test/'), env)).text()).toBe('asset');
});
it('routes Garmin availability through the relay handler', async () => {
  const result = await worker.fetch(new Request('https://host.test/api/garmin/config'), env);
  expect(await result.json()).toMatchObject({ v: 1, available: false });
});
