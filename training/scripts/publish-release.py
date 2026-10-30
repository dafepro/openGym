#!/usr/bin/env python3
"""Retain tested training bytes and submit their pointer; never deploy infrastructure."""
import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from release_bundle import REPOSITORY, verify

BRANCH = 'refs/heads/codex/quicktrack-training-release'
WORKFLOW_REF = f'{REPOSITORY}/.github/workflows/training-release.yml@{BRANCH}'


def publication_identity(env):
    sha = env.get('GITHUB_SHA', '')
    if (env.get('GITHUB_REPOSITORY') != REPOSITORY or env.get('GITHUB_REF') != BRANCH
            or env.get('GITHUB_WORKFLOW_REF') != WORKFLOW_REF
            or env.get('GITHUB_EVENT_NAME') not in ('push', 'workflow_dispatch')
            or env.get('QUICKTRACK_TRAINING_PUBLISH_ENABLED') != 'true'
            or not re.fullmatch(r'[a-f0-9]{40}', sha)
            or (env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' and env.get('GITHUB_ACTOR_ID') != '313492551')):
        raise ValueError('Publication requires the trusted training branch/event and enabled source switch')
    ids = [env.get('GITHUB_RUN_ID', ''), env.get('GITHUB_RUN_ATTEMPT', '')]
    if any(not re.fullmatch(r'[1-9][0-9]*', value) or int(value) >= 2**63 for value in ids):
        raise ValueError('Publication requires exact positive run identities')
    return sha, *map(int, ids)


def api(path, method='GET', payload=None, token=None):
    result = subprocess.run(['gh', 'api', path, '--method', method, *(['--input', '-'] if payload is not None else [])],
                            input=json.dumps(payload) if payload is not None else None, text=True, capture_output=True,
                            env=dict(os.environ, GH_TOKEN=token or os.environ['GH_TOKEN']))
    if result.returncode:
        raise RuntimeError('GitHub release/request failed; inspect permissions and immutable release identity')
    return json.loads(result.stdout)


def publish(directory):
    sha, run, attempt = publication_identity(os.environ)
    verify(directory, sha)  # Re-audit retained bytes immediately before giving them publication authority.
    if not os.environ.get('GH_TOKEN') or not os.environ.get('DEPLOY_REQUEST_TOKEN'):
        raise ValueError('Source publication and release-request credentials must both be configured')
    tag = f'deploy-production-{sha}-{run}-{attempt}'
    paths = [directory / 'worker.tgz', directory / 'release-manifest.json']
    subprocess.run(['gh', 'release', 'create', tag, *map(str, paths), '--repo', REPOSITORY,
                    '--target', sha, '--title', f'QuickTrack Training {sha[:12]} ({run}/{attempt})',
                    '--notes', 'Immutable tested public application code. Retain these assets for rollback; never overwrite. Private content is separate.',
                    '--latest=false'], check=True)
    release = api(f'repos/{REPOSITORY}/releases/tags/{tag}')
    if release.get('tag_name') != tag or release.get('target_commitish') != sha or release.get('draft') or release.get('prerelease'):
        raise ValueError('Retained release identity mismatch')
    assets = {asset['name']: asset for asset in release['assets']}
    if set(assets) != {'worker.tgz', 'release-manifest.json'} or len(release['assets']) != 2:
        raise ValueError('Retained release must have exactly the tested bundle and manifest')
    for path in paths:
        asset = assets[path.name]
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        if (asset.get('state') != 'uploaded' or asset.get('size') != path.stat().st_size
                or asset.get('digest') != 'sha256:' + expected):
            raise ValueError('Retained release asset digest/size mismatch')
    pointer = dict(schema=1, app='quicktrack-training', environment='production', variant='training',
                   sha=sha, producer_sha=sha, run_id=run, run_attempt=attempt, release_id=release['id'],
                   bundle_asset_id=assets['worker.tgz']['id'], manifest_asset_id=assets['release-manifest.json']['id'],
                   bundle_sha256=hashlib.sha256(paths[0].read_bytes()).hexdigest(),
                   manifest_sha256=hashlib.sha256(paths[1].read_bytes()).hexdigest())
    (directory / 'deploy-request.json').write_text(json.dumps(pointer, indent=2) + '\n')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('Retained QuickTrack Training release pointer (public identities only):\n\n```json\n' + json.dumps(pointer, indent=2) + '\n```\n')
    result = api('repos/dafepro/deploy/issues', 'POST', {
        'title': f'Release request: quicktrack-training/production {sha[:12]}',
        'body': 'dafepro-release-request-v1\n' + json.dumps(pointer, indent=2),
    }, token=os.environ['DEPLOY_REQUEST_TOKEN'])
    print(result['html_url'])
    return pointer


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    publish(parser.parse_args().directory)
