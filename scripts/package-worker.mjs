import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [variant, sha, output] = process.argv.slice(2);
if (variant !== "opengym" || !/^[0-9a-f]{40}$/.test(sha ?? "")) {
  throw new Error("The openGym variant and inspected source SHA are required.");
}
if (!/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
  throw new Error("A trusted producer SHA is required.");
}
const directory = resolve(output);
const bundle = resolve(directory, "bundle");
await mkdir(resolve(bundle, "worker"), { recursive: true });
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const result = spawnSync(
  process.execPath,
  [wrangler, "deploy", "--dry-run", "--outdir", resolve(bundle, "worker")],
  {
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
if (result.status !== 0) throw new Error("Prebuilt Worker packaging failed.");
await cp(resolve("frontend/dist"), resolve(bundle, "assets"), {
  recursive: true,
});
await readFile(resolve(bundle, "worker/index.js"));
await readFile(resolve(bundle, "assets/index.html"));
const archive = resolve(directory, "worker.tgz");
const tar = spawnSync(
  "tar",
  ["-czf", archive, "-C", bundle, "worker", "assets"],
  { stdio: "inherit" },
);
if (tar.status !== 0) throw new Error("Worker archive failed.");
const manifest = {
  schema: 2,
  sha,
  controllerSha: process.env.GITHUB_SHA,
  profile: "production",
  checksum: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
};
await writeFile(
  resolve(directory, "release-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
