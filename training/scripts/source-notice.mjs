const repository = 'https://github.com/dafepro/openGym'

export function sourceNotice(revision = 'local') {
  const ref = /^[a-f0-9]{40}$/.test(revision) ? revision : 'codex/quicktrack-training'
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QuickTrack Training source</title>
<main><h1>QuickTrack Training source</h1>
<p>This application is free software under the GNU AGPL, version 3 or later.</p>
<p><a href="${repository}/tree/${ref}/training">Corresponding application source</a></p>
<p><a href="${repository}/archive/${ref}.tar.gz">Download corresponding repository source</a></p>
<p><a href="/licenses/AGPL-3.0.txt">GNU AGPL license</a></p>
<p>Application revision: <code>${ref}</code>. Private family content and access credentials are not part of this public code release.</p>
</main></html>\n`
}

export function sourceNoticePlugin(revision) {
  return {
    name: 'training-corresponding-source',
    apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'source.html', source: sourceNotice(revision) }) }
  }
}
