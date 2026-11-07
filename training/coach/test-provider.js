// Shared, strict transport fake: unexpected network calls fail closed.
export function practiceGitHubFixture() {
  let head,
    collection = { schemaVersion: 1, practices: [] },
    pr
  return async (url, options = {}) => {
    const method = options.method || 'GET',
      data = options.body && JSON.parse(options.body)
    if (url.startsWith('https://www.youtube.com/oembed?'))
      return Response.json({
        provider_name: 'YouTube',
        type: 'video',
        title: 'Cone control demonstration',
        author_name: 'Coach',
      })
    if (url.endsWith('/api/catalog'))
      return Response.json({ revision: 'v1', assignments: [] })
    if (!url.startsWith('https://api.github.com/repos/dafepro/openGym'))
      throw new Error('Unexpected network request: ' + url)
    const path = url.slice(
      'https://api.github.com/repos/dafepro/openGym'.length,
    )
    if (path.startsWith('/issues?')) return Response.json([])
    if (path.startsWith('/git/ref/heads/codex/'))
      return Response.json({ object: { sha: 'a'.repeat(40) } })
    if (path.startsWith('/git/ref/heads/coach/'))
      return head
        ? Response.json({ object: { sha: head } })
        : new Response('', { status: 404 })
    if (path.startsWith('/contents/')) {
      const value = path.includes('ref=' + 'a'.repeat(40))
        ? { schemaVersion: 1, practices: [] }
        : collection
      return Response.json({
        encoding: 'base64',
        size: 1000,
        content: Buffer.from(JSON.stringify(value)).toString('base64'),
      })
    }
    if (path.startsWith('/git/commits/') && method === 'GET')
      return Response.json({ tree: { sha: 'b'.repeat(40) } })
    if (path === '/git/trees') {
      collection = JSON.parse(data.tree[0].content)
      return Response.json({ sha: 'c'.repeat(40) })
    }
    if (path === '/git/commits') return Response.json({ sha: 'd'.repeat(40) })
    if (path === '/git/refs' || path.startsWith('/git/refs/heads/')) {
      head = data.sha
      return Response.json({ object: { sha: head } })
    }
    if (path.startsWith('/pulls?')) return Response.json(pr ? [pr] : [])
    if (path === '/pulls' && method === 'POST') {
      pr = {
        number: 123,
        html_url: 'https://github.com/dafepro/openGym/pull/123',
        state: 'open',
      }
      return Response.json(pr)
    }
    if (path === '/labels' || path === '/issues/123/labels')
      return Response.json({})
    if (path === '/pulls/123' && method === 'PATCH') return Response.json(pr)
    throw new Error('Unexpected GitHub request: ' + method + ' ' + path)
  }
}
