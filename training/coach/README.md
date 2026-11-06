# Coach’s desk

A coach writes a soccer brief at `/#/coach`, optionally adds notification recipients,
and receives a researched practice proposal in a GitHub issue. The player interface
remains public. Coach requests require a verified Cloudflare Access identity.

This is implemented but **not activated or deployed**. The OpenAI key still needs
configuration. No live model, issue, email or SMS calls have been made during local
validation. Tests use synthetic provider responses. They establish software behavior,
not the quality of real generated coaching or deliverability of real messages.

## Request and publication flow

1. The form accepts 20–1,000 characters, up to 20 email/phone recipients, and explicit
   confirmation that recipients expect the notification. Phone numbers need an
   international country code. A draft survives navigation/reload in this browser
   tab’s session storage; Clear draft removes it.
2. The server validates origin, signed Access JWT, limits, and provider availability.
   A private Durable Object queue per coach persists the request before returning.
3. An alarm runs a tool-free relevance/injection check, bounded web research using
   OpenAI Responses, and a separate structured-output pass. The model receives no
   recipient list, secrets, GitHub tools, code execution or publication capability.
   Accidental contact details in the brief are redacted before model calls.
4. Every drill must have setup, instructions, a focus cue, sets, reps or time, rest,
   side, `futbol:` tags, and a URL actually present in the research results. A fixed
   issue formatter writes `quicktrack-coach-practice-v1` JSON to `dafepro/openGym`.
5. A human reviews the issue, verifies demonstrations and suitability, reuses or
   creates catalog drills, and publishes through the existing training release
   process. The overall `goal` maps to the assignment’s `note`, displayed during
   practice. Research candidates are not automatically approved videos.
6. After publication, an authenticated ready callback supplies the actual practice
   link and live source SHA. The service resolves the shared practice against the
   live catalog and archived editions before notifying recipients. Opening that link
   lets the player save or start the practice in their own stateless instance.

An issue proposal does **not** publish a practice. Automatic issue-to-catalog
implementation, authorized-player accounts, push notifications, and provider delivery
receipts are future work. For now, the existing reviewed catalog/release process is
the publication step, and Resend/Twilio acceptance is reported as “accepted for sending.”

## Server configuration

Use a dedicated OpenAI project key with an account spending limit. Keep it in the
server/GitHub environment secrets, never Vite variables, local browser storage, issue
text, committed files, or a chat message. Select an OpenAI model supporting Responses
web search and strict JSON schema; set `OPENAI_MODEL` explicitly. No default silently
chooses a paid model.

Required Worker settings:

| Name | Type | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | secret | OpenAI project credential |
| `OPENAI_MODEL` | variable | Explicit compatible model identifier |
| `COACH_GITHUB_TOKEN` | secret | Fine-grained token owned by **dafepro**, limited to Issues read/write on `dafepro/openGym` |
| `COACH_GITHUB_REPOSITORY` | variable | Fixed to `dafepro/openGym` |
| `COACH_ACCESS_ISSUER` | variable | `https://<team>.cloudflareaccess.com` |
| `COACH_ACCESS_AUD` | variable | Access application audience |
| `COACH_READY_SECRET` | secret | Independently generated random secret, at least 32 characters |
| `APP_ORIGIN` | variable | Fixed to `https://train.quicktrack.cc` |
| `COACH_REQUESTS` | binding | SQLite Durable Object, class `CoachRequests` |

Optional email: `RESEND_API_KEY` secret and `COACH_EMAIL_FROM` verified sender variable.
Optional text: `TWILIO_AUTH_TOKEN` secret, `TWILIO_ACCOUNT_SID` and `TWILIO_FROM`
variables. The form reports unavailable channels and the server rejects their use.
No recipient messages are sent when only a proposal exists. For SMS, use a compact
catalog-based practice pass; oversized messages are rejected before publication
readiness or provider submission. [Twilio message limits](https://www.twilio.com/docs/messaging/api/message-resource).

Configure Cloudflare Access to protect **only** the coach API paths, not the player
website. Use an explicit coach email allowlist initially. Protect `/api/coach/requests`
and `/api/coach/login`; leave `/api/coach/config` readable so the player app can explain
setup status. Exempt `/api/coach/ready/*` from Access login redirects: it independently
requires a body/path-bound HMAC signature with a five-minute freshness window. Do not
bypass authentication on `/requests`. The Worker also verifies the JWT signature,
issuer, audience, expiry and subject; an email header alone grants no access.

## Deployment

The `dafepro/deploy` repository has a separate, disabled-by-default
`quicktrack-coach.yml` manual workflow. It accepts an exact source commit from the
trusted training release branch. Building, unit checks, and a real local workerd
queue/alarm test run without deployment credentials. The deploy job verifies the
artifact digest, stages the Worker, configures secrets through standard input, then
attaches only `train.quicktrack.cc/api/coach/*`.

See the deploy app README for the exact GitHub secret/variable names. Activate only
after Access policies, keys, model choice and optional delivery providers are ready.
Deploying the player UI alone leaves the coach form in the honest “setup pending”
state. The existing `/api/coach/config` placeholder returns `configured:false`.

## Marking a reviewed practice ready

The issue JSON contains `request: "<coach-owner-hash>.<request-uuid>"`. After the
practice is deployed, create a temporary publication JSON file containing only:

```json
{"practiceUrl":"https://train.quicktrack.cc/#/shared/<actual-practice-code>","sourceSha":"<40-character-live-source-commit>"}
```

With `COACH_READY_SECRET` configured in the calling process’s environment, run:

```sh
node coach/publish-ready.mjs '<request-reference-from-issue>' /path/to/publication.json
```

The command never prints the secret or recipient addresses. A repeated callback for
the same practice is idempotent; a different practice for that request is rejected.
Do not run it before reviewing and publishing the practice.

## Operational boundaries

- Per-coach quota: 10 new requests per 24 hours, 100 retained requests maximum.
- Every request uses a browser-generated idempotency key. The queue preserves a
  payload hash so retries remain recognizable after recipients are deleted.
- At most three web-search tool calls per research stage; each model call has a
  timeout/output cap. There are no automatic paid model retries.
- Interrupted issue creation or notification sends enter a review state. Check
  GitHub/provider logs before creating another request; ambiguous sends are not
  automatically repeated. Resend also receives a stable idempotency key.
- Recipient addresses stay in private queue storage, never the issue or model
  request. They are removed after notification attempts; all jobs expire after
  30 days. The API returns counts/channel statuses, not the recipient addresses.
- Prompt-injection checks are defense in depth, not a guarantee. The stronger
  boundary is that model output is inert, schema-checked data, and publication
  requires review. Sources and workload prescriptions still need a coach’s judgment.

## Validation

`npm run test:coach` covers request bounds, relevance/injection rejection, source
validation, contact redaction, signed identities/HMAC, queue idempotency/limits,
interrupted side effects, live-publication checks, notification deduplication and
expiry. `e2e/coach.spec.js` checks the form, draft recovery, proposal states and saving
controls with mocked APIs across all six browser/layout projects.

The deploy repository’s `tests/coach-runtime.mjs <bundled-worker.js>` exercises the
actual workerd + SQLite Durable Object + alarm with every external request mocked.
Before first activation, run one owner-only real request and review its sources,
proposal quality, issue format and one opted-in notification per enabled channel.

References: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).
