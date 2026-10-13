import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Version uploads preserve domains/triggers. Provisioning and DO class migrations
// deliberately require the owner's separate deploy:admin command.
const wrangler = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);
const tag = `release-${randomUUID()}`;

if (process.argv.length > 2) {
  throw new Error(
    'Deploy takes no arguments. For a dry run use npm run deploy:admin -- --dry-run.',
  );
}
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before deploying.');
}

for (const args of [
  ['versions', 'upload', '--tag', tag],
  ['versions', 'deploy', '--version-tag', `${tag}@100%`, '--yes'],
]) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
