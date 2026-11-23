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

it('sends only the signed assertion to the fixed private service; rejects alternate hosts and cross-site writes', async () => {
  const {invitedCoach} = await import('./invited-coach')
  const site = 'https://uplift.quicktrack.cc'
  const call = vi.fn(async () => Response.json({invited:true}))
  const login = new Request(site+'/api/invited-coach/login',{headers:{'Cf-Access-Jwt-Assertion':'signed','Cookie':'private'}})
  const r=await invitedCoach(login,call)
  expect(r.status).toBe(303)
  expect(r.headers.get('location')).toBe(site+'/#/coach')
  expect(call.mock.calls[0]).toEqual(['https://uplift-coach-origin.quicktrack.cc/api/invited-coach/session',expect.objectContaining({headers:{'Cf-Access-Jwt-Assertion':'signed'}, redirect:'manual'})])
  for(const request of [new Request(site+'/api/invited-coach/run',{method:'POST',headers:{Origin:'https://another.test','Cf-Access-Jwt-Assertion':'signed'}}),new Request('https://preview.test/api/invited-coach/session'),new Request(site+'/api/invited-coach/session')]){
    expect((await invitedCoach(request,call)).status).toBeGreaterThanOrEqual(400)
  }
  expect(call).toHaveBeenCalledTimes(1)
})
