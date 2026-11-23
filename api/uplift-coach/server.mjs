import { createCoachServer } from './http-server.mjs'
import { counters, createCoach } from './service.mjs'
const handler = createCoach(process.env, counters('/data/quota.sqlite'))
createCoachServer(handler).listen(8787, '0.0.0.0')
