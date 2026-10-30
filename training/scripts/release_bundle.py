#!/usr/bin/env python3
"""Build/verify the public-code-only training release, without cloud credentials."""
import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path

FORMAT = 'quicktrack-training-worker-v1'
REPOSITORY = 'dafepro/openGym'
RUNTIME = dict(compatibilityDate='2026-10-03', bindings=['ASSETS', 'TRAINING_CONTENT', 'LOGIN_LIMIT'], workerFirst=True)
AUDIT = dict(demoIncluded=False, privateContentIncluded=False, sourceMapsIncluded=False)
REQUIRED = {'worker/index.js', 'assets/index.html', 'assets/source.html',
            'assets/fonts/barlow-condensed-latin-600.woff2', 'assets/fonts/OFL.txt', 'assets/licenses/AGPL-3.0.txt'}
SHA = re.compile(r'[a-f0-9]{40}')
MAX_ARCHIVE = 128 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
MARKERS = (b'SYNTHETIC_TRAINING_DEMO_ONLY', b'LOCAL_PRIVATE_TRAINING_PREVIEW_ONLY', b'sourceMappingURL=')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def worker_entry(data):
    # Wrangler always writes a local debug map. Retain no map and remove only its terminal reference.
    return re.sub(rb'\n//# sourceMappingURL=index\.js\.map\r?\n?\Z', b'\n', data)


def assert_runtime_configuration(path):
    # The checked-in config uses only full-line JSONC comments; reject unsupported syntax.
    config = json.loads(re.sub(r'^\s*//[^\n]*$', '', path.read_text(), flags=re.MULTILINE))
    allowed = {'$schema', 'name', 'main', 'compatibility_date', 'workers_dev', 'preview_urls', 'assets', 'vars', 'r2_buckets', 'ratelimits'}
    if (not set(config).issubset(allowed)
            or config.get('main') != 'worker/index.js' or config.get('compatibility_date') != RUNTIME['compatibilityDate']
            or config.get('assets', {}).get('binding') != 'ASSETS' or config['assets'].get('directory') != 'dist'
            or config['assets'].get('run_worker_first') is not True
            or config['assets'].get('html_handling') != 'none' or config['assets'].get('not_found_handling') != 'none'
            or [entry.get('binding') for entry in config.get('r2_buckets', [])] != ['TRAINING_CONTENT']
            or [entry.get('name') for entry in config.get('ratelimits', [])] != ['LOGIN_LIMIT']
            or config.get('env')):
        raise ValueError('Source build runtime differs from the fixed training artifact contract')


def allowed_path(name):
    return name in REQUIRED or bool(re.fullmatch(r'assets/assets/[a-zA-Z0-9_-]+\.(js|css|woff2|svg|png)', name))


def audit_files(files, sha):
    if not SHA.fullmatch(sha):
        raise ValueError('Release requires a full lowercase source SHA')
    if not REQUIRED.issubset(files) or not all(allowed_path(name) for name in files):
        raise ValueError('Release contains missing or unapproved public files')
    if sum(map(len, files.values())) > MAX_EXPANDED:
        raise ValueError('Release exceeds expanded size limit')
    for name, data in files.items():
        if any(marker in data for marker in MARKERS):
            raise ValueError('Release contains demo, private preview or source-map code')
    source_link = f'https://github.com/{REPOSITORY}/tree/{sha}/training'.encode()
    if source_link not in files['assets/source.html']:
        raise ValueError('Source notice does not bind the released revision')
    if not any(re.fullmatch(r'assets/assets/[a-zA-Z0-9_-]+\.js', name) for name in files):
        raise ValueError('Application JavaScript missing')
    return {name: digest(files[name]) for name in sorted(files)}


def read_tree(directory, prefix):
    files = {}
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Release input must be a regular directory')
    for path in sorted(directory.rglob('*')):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Release inputs cannot contain links or special files')
        if path.is_file():
            files[f'{prefix}/{path.relative_to(directory).as_posix()}'] = path.read_bytes()
    return files


def package(sha, worker_directory, assets_directory, output):
    if os.environ.get('TRAINING_PREVIEW_BUNDLE') or os.environ.get('VITE_TRAINING_DEMO') == '1':
        raise ValueError('Preview and demo environments cannot produce releases')
    if os.environ.get('GITHUB_SHA', sha) != sha or os.environ.get('APP_BUILD', sha) != sha:
        raise ValueError('Source, controller and application build revisions must match')
    files = {**read_tree(worker_directory, 'worker'), **read_tree(assets_directory, 'assets')}
    inventory = audit_files(files, sha)
    output.mkdir(parents=True, exist_ok=False)
    archive = output / 'worker.tgz'
    with tarfile.open(archive, 'w:gz', format=tarfile.USTAR_FORMAT) as bundle:
        for name, data in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(data), 0o644, 0
            bundle.addfile(info, io.BytesIO(data))
    metadata = dict(schema=2, format=FORMAT, sha=sha, controllerSha=sha, profile='production',
                    checksum=digest(archive.read_bytes()), files=inventory, runtime=RUNTIME, audit=AUDIT,
                    source=dict(repository=REPOSITORY, revision=sha, path='assets/source.html'))
    (output / 'release-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    verify(output, sha)
    return metadata


def verify(directory, sha):
    if not SHA.fullmatch(sha):
        raise ValueError('Release requires a full lowercase source SHA')
    manifest_path, archive_path = directory / 'release-manifest.json', directory / 'worker.tgz'
    if manifest_path.is_symlink() or archive_path.is_symlink() or manifest_path.stat().st_size > 1024 * 1024:
        raise ValueError('Invalid release inputs')
    metadata = json.loads(manifest_path.read_text())
    expected = dict(schema=2, format=FORMAT, sha=sha, controllerSha=sha, profile='production',
                    runtime=RUNTIME, audit=AUDIT,
                    source=dict(repository=REPOSITORY, revision=sha, path='assets/source.html'))
    if set(metadata) != set(expected) | {'checksum', 'files'} or any(metadata.get(key) != value for key, value in expected.items()):
        raise ValueError('Manifest identity/runtime/audit contract mismatch')
    if archive_path.stat().st_size > MAX_ARCHIVE:
        raise ValueError('Archive size limit exceeded')
    data = archive_path.read_bytes()
    if metadata['checksum'] != digest(data):
        raise ValueError('Archive digest mismatch')
    files, size = {}, 0
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as bundle:
        for member in bundle:
            # Never extract untrusted archives. Exact names also reject traversal, alternate roots and links.
            if not member.isfile() or not allowed_path(member.name) or member.name in files:
                raise ValueError('Unsafe or unexpected archive member')
            size += member.size
            if size > MAX_EXPANDED:
                raise ValueError('Expanded archive size limit exceeded')
            files[member.name] = bundle.extractfile(member).read()
    if metadata['files'] != audit_files(files, sha):
        raise ValueError('File inventory mismatch')
    return metadata


def smoke(directory, sha):
    verify(directory, sha)
    with tarfile.open(directory / 'worker.tgz', 'r:gz') as bundle:
        entry = bundle.extractfile('worker/index.js').read()
    with tempfile.TemporaryDirectory(prefix='training-release-smoke-') as temporary:
        worker = Path(temporary) / 'index.mjs'
        worker.write_bytes(entry)
        program = '''
import assert from 'node:assert/strict';
const { default: worker } = await import(WORKER_URL);
const health = await worker.fetch(new Request('https://train.quicktrack.cc/api/health'), {});
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { app: 'quicktrack-training', ok: true });
const assetPaths = [];
const publicEnv = { ASSETS: { fetch: async request => {
  const path = new URL(request.url).pathname;
  assetPaths.push(path);
  return new Response(path, { status: ['/index.html', '/source.html'].includes(path) ? 200 : 404, headers: { 'Content-Type': 'text/html' } });
} } };
for (const [path, expected] of [['/', '/index.html'], ['/source.html', '/source.html']]) {
  const response = await worker.fetch(new Request('https://train.quicktrack.cc' + path), publicEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Location'), null);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0, no-transform');
  assert.equal(await response.text(), expected);
}
assert.deepEqual(assetPaths, ['/index.html', '/source.html']);
const unknown = await worker.fetch(new Request('https://train.quicktrack.cc/source'), publicEnv);
assert.equal(unknown.status, 404);
assert.equal(assetPaths.length, 2);
const privateContent = await worker.fetch(new Request('https://train.quicktrack.cc/api/catalog'), {});
assert.equal(privateContent.status, 503);
assert.deepEqual(await privateContent.json(), { error: 'service_unavailable' });
'''.replace('WORKER_URL', json.dumps(worker.as_uri()))
        subprocess.run(['node', '--input-type=module', '-'], input=program, text=True, check=True)


def build(sha, output):
    root = Path(__file__).resolve().parents[1]
    assert_runtime_configuration(root / 'wrangler.jsonc')
    # Only the deployable entry is retained; no Wrangler config, diagnostics or local debug map.
    with tempfile.TemporaryDirectory(prefix='training-worker-') as temporary:
        generated = Path(temporary) / 'generated'
        subprocess.run(['node', str(root.parent / 'node_modules/wrangler/bin/wrangler.js'), 'deploy',
                        '--dry-run', '--outdir', str(generated), '--minify'], cwd=root, check=True,
                       env=dict(os.environ, WRANGLER_SEND_METRICS='false'))
        entry = generated / 'index.js'
        if not entry.is_file() or entry.is_symlink():
            raise ValueError('Wrangler did not produce the expected Worker entry')
        worker = Path(temporary) / 'worker'
        worker.mkdir()
        (worker / 'index.js').write_bytes(worker_entry(entry.read_bytes()))
        metadata = package(sha, worker, root / 'dist', output)
        smoke(output, sha)
        return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'verify', 'smoke'])
    parser.add_argument('sha')
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    if args.command == 'build':
        build(args.sha, args.directory)
    elif args.command == 'verify':
        verify(args.directory, args.sha)
    else:
        smoke(args.directory, args.sha)
    print('Verified public-code-only QuickTrack Training release.')
