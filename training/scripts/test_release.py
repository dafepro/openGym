import hashlib
import importlib.util
import io
import json
import os
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from release_bundle import REQUIRED, audit_files, package, verify, worker_entry, assert_runtime_configuration

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).with_name('publish-release.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
SHA = 'a' * 40


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.worker, self.assets, self.output = self.root / 'worker', self.root / 'assets', self.root / 'output'
        self.files = {name: b'public code' for name in REQUIRED}
        self.files['assets/source.html'] = f'<a href="https://github.com/dafepro/openGym/tree/{SHA}/training">Source</a>'.encode()
        self.files['assets/assets/index-Ab123.js'] = b'console.log("public application")'
        for name, data in self.files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.environment = dict(GITHUB_SHA=SHA, APP_BUILD=SHA, GITHUB_REPOSITORY='dafepro/openGym',
                                GITHUB_REF=publisher.BRANCH, GITHUB_EVENT_NAME='push', GITHUB_RUN_ID='123',
                                GITHUB_WORKFLOW_REF=publisher.WORKFLOW_REF,
                                GITHUB_RUN_ATTEMPT='2', QUICKTRACK_TRAINING_PUBLISH_ENABLED='true',
                                GH_TOKEN='synthetic-source-token', DEPLOY_REQUEST_TOKEN='synthetic-request-token')
        self.env = patch.dict(os.environ, self.environment, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def make_release(self):
        return package(SHA, self.worker, self.assets, self.output)

    def test_only_terminal_wrangler_debug_reference_is_removed(self):
        self.assertEqual(worker_entry(b'export default {};\n//# sourceMappingURL=index.js.map\n'), b'export default {};\n')
        other = b'export default {};\n//# sourceMappingURL=unexpected.map\n'
        self.assertEqual(worker_entry(other), other)
        self.assertEqual(worker_entry(b'/* sourceMappingURL=index.js.map */'), b'/* sourceMappingURL=index.js.map */')

    def test_declared_runtime_must_match_the_actual_build_configuration(self):
        config = dict(main='worker/index.js', compatibility_date='2026-10-03',
                      assets=dict(binding='ASSETS', directory='dist', run_worker_first=True),
                      r2_buckets=[dict(binding='TRAINING_CONTENT')], ratelimits=[dict(name='LOGIN_LIMIT')])
        path = self.root / 'wrangler.jsonc'
        path.write_text('// public compilation contract\n' + json.dumps(config))
        assert_runtime_configuration(path)
        for changes in [dict(compatibility_date='2026-09-01'), dict(r2_buckets=[]), dict(ratelimits=[]),
                        dict(assets=dict(binding='ASSETS', directory='dist', run_worker_first=False)), dict(env={'other': {}}),
                        dict(services=[{'binding': 'UNEXPECTED'}])]:
            path.write_text(json.dumps({**config, **changes}))
            with self.assertRaises(ValueError):
                assert_runtime_configuration(path)

    def test_exact_inventory_round_trip_and_no_configuration_or_environment_in_archive(self):
        metadata = self.make_release()
        self.assertEqual(verify(self.output, SHA), metadata)
        self.assertEqual(metadata['sha'], metadata['controllerSha'])
        self.assertEqual(set(metadata['files']), set(self.files))
        self.assertEqual(metadata['runtime']['bindings'], ['ASSETS', 'TRAINING_CONTENT', 'LOGIN_LIMIT'])
        self.assertFalse(any(metadata['audit'].values()))
        with tarfile.open(self.output / 'worker.tgz') as archive:
            self.assertEqual(set(archive.getnames()), set(self.files))
            for member in archive:
                self.assertTrue(member.isfile())
                self.assertEqual(archive.extractfile(member).read(), self.files[member.name])
        with self.assertRaises(FileExistsError):
            self.make_release()  # No accidental overwrite of retained bytes.

    def test_forbidden_media_catalog_map_config_and_preview_code_fail_before_output(self):
        for name in ['assets/media/video', 'assets/private/catalog.json', 'assets/assets/index.js.map',
                     'worker/wrangler.json', 'assets/.env', 'assets/assets/secrets.txt']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                audit_files({**self.files, name: b'private'}, SHA)
        for marker in [b'SYNTHETIC_TRAINING_DEMO_ONLY', b'LOCAL_PRIVATE_TRAINING_PREVIEW_ONLY', b'sourceMappingURL=secret.map']:
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                audit_files({**self.files, 'assets/assets/bad.js': marker}, SHA)
        self.assertFalse(self.output.exists())

    def test_missing_source_wrong_source_revision_and_symlink_fail(self):
        for changes in [{'assets/source.html': b'No source'}, {'assets/source.html': b'https://github.com/dafepro/openGym/tree/' + b'b' * 40 + b'/training'}]:
            with self.assertRaises(ValueError):
                audit_files({**self.files, **changes}, SHA)
        incomplete = dict(self.files)
        del incomplete['assets/index.html']
        with self.assertRaises(ValueError):
            audit_files(incomplete, SHA)
        (self.assets / 'linked').symlink_to(self.worker / 'index.js')
        with self.assertRaises(ValueError):
            self.make_release()

    def test_demo_preview_or_mismatched_build_identity_cannot_package(self):
        for changes in [dict(VITE_TRAINING_DEMO='1'), dict(TRAINING_PREVIEW_BUNDLE='/outside/git/bundle.json'),
                        dict(GITHUB_SHA='b' * 40), dict(APP_BUILD='local')]:
            with patch.dict(os.environ, changes), self.assertRaises(ValueError):
                self.make_release()
        self.assertFalse(self.output.exists())

    def rewrite_archive(self, entries):
        with tarfile.open(self.output / 'worker.tgz', 'w:gz') as archive:
            for name, kind in entries:
                member = tarfile.TarInfo(name)
                if kind == 'link':
                    member.type, member.linkname = tarfile.SYMTYPE, 'assets/index.html'
                    archive.addfile(member)
                else:
                    member.size = 1
                    archive.addfile(member, io.BytesIO(b'x'))
        manifest = json.loads((self.output / 'release-manifest.json').read_text())
        manifest['checksum'] = hashlib.sha256((self.output / 'worker.tgz').read_bytes()).hexdigest()
        (self.output / 'release-manifest.json').write_text(json.dumps(manifest))

    def test_tampered_bytes_inventory_runtime_and_unsafe_archives_rejected(self):
        original = self.make_release()
        manifest_path = self.output / 'release-manifest.json'
        for field, value in [('checksum', '0' * 64), ('files', {}), ('runtime', {}), ('audit', {'demoIncluded': True}), ('sha', 'b' * 40)]:
            with self.subTest(field=field):
                manifest_path.write_text(json.dumps({**original, field: value}))
                with self.assertRaises(ValueError):
                    verify(self.output, SHA)
        manifest_path.write_text(json.dumps(original))
        for entries in [[('../outside', 'file')], [('/assets/index.html', 'file')], [('worker/index.js', 'link')],
                        [('assets/index.html', 'file'), ('assets/index.html', 'file')]]:
            self.rewrite_archive(entries)
            with self.assertRaises(ValueError):
                verify(self.output, SHA)

    def test_only_exact_trusted_event_source_and_positive_run_ids_can_publish(self):
        self.assertEqual(publisher.publication_identity(self.environment), (SHA, 123, 2))
        dispatched = {**self.environment, 'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_ACTOR_ID': '313492551'}
        self.assertEqual(publisher.publication_identity(dispatched), (SHA, 123, 2))
        for changes in [dict(GITHUB_REPOSITORY='other/repo'), dict(GITHUB_REF='refs/heads/codex/focused-workout-overlay'),
                        dict(GITHUB_EVENT_NAME='pull_request'), dict(GITHUB_WORKFLOW_REF='other-workflow'), dict(QUICKTRACK_TRAINING_PUBLISH_ENABLED='false'),
                        dict(GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_ACTOR_ID='1'), dict(GITHUB_SHA='main'),
                        dict(GITHUB_RUN_ID='0'), dict(GITHUB_RUN_ATTEMPT='-1')]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                publisher.publication_identity({**self.environment, **changes})

    def retained_release(self):
        tag = f'deploy-production-{SHA}-123-2'
        return dict(id=900, tag_name=tag, target_commitish=SHA, draft=False, prerelease=False,
                    assets=[dict(id=index, name=name, state='uploaded', size=(self.output / name).stat().st_size,
                                 digest='sha256:' + hashlib.sha256((self.output / name).read_bytes()).hexdigest())
                            for index, name in enumerate(['worker.tgz', 'release-manifest.json'], start=901)])

    def test_publisher_retains_exact_files_then_requests_only_code_pointer(self):
        self.make_release()
        with patch.object(publisher.subprocess, 'run') as command, patch.object(publisher, 'api') as api, patch('builtins.print'):
            api.side_effect = [self.retained_release(), {'html_url': 'https://github.com/dafepro/deploy/issues/1'}]
            pointer = publisher.publish(self.output)
            args = command.call_args.args[0]
            self.assertEqual(args[:3], ['gh', 'release', 'create'])
            self.assertNotIn('--clobber', args)
            self.assertIn(str(self.output / 'worker.tgz'), args)
            self.assertIn(str(self.output / 'release-manifest.json'), args)
            self.assertEqual(len(pointer), 13)
            self.assertEqual(pointer['app'], 'quicktrack-training')
            self.assertEqual(pointer['variant'], 'training')
            self.assertEqual(pointer['producer_sha'], SHA)
            self.assertNotEqual(pointer['bundle_asset_id'], pointer['manifest_asset_id'])
            body = api.call_args.args[2]['body']
            self.assertTrue(body.startswith('dafepro-release-request-v1\n'))
            self.assertEqual(json.loads(body.split('\n', 1)[1]), pointer)
            self.assertEqual(json.loads((self.output / 'deploy-request.json').read_text()), pointer)

    def test_publisher_refuses_missing_credentials_or_changed_retained_assets(self):
        self.make_release()
        with patch.dict(os.environ, DEPLOY_REQUEST_TOKEN=''), patch.object(publisher.subprocess, 'run') as command:
            with self.assertRaises(ValueError):
                publisher.publish(self.output)
            command.assert_not_called()
        bad = self.retained_release()
        bad['assets'][0]['digest'] = 'sha256:' + '0' * 64
        with patch.object(publisher.subprocess, 'run'), patch.object(publisher, 'api', return_value=bad) as api:
            with self.assertRaises(ValueError):
                publisher.publish(self.output)
            self.assertEqual(api.call_count, 1)
            self.assertFalse((self.output / 'deploy-request.json').exists())


if __name__ == '__main__':
    unittest.main()
