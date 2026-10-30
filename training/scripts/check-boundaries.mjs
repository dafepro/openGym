import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = resolve(root, 'src')

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat()
}

for (const path of await walk(source)) {
  if (!['.js', '.jsx', '.css'].includes(extname(path))) continue
  const text = await readFile(path, 'utf8')
  const sourcePath = relative(source, path)
  const canUseFixtures = /\.test\.[jt]sx?$/.test(path) || sourcePath.startsWith('demo/')
  const imports = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s*)['"]([^'"]+)['"]/g)]
  for (const [, specifier] of imports) {
    if (specifier.startsWith('.')) {
      const absoluteTarget = resolve(dirname(path), specifier)
      const target = relative(source, absoluteTarget)
      const fixture = relative(resolve(root, 'fixtures'), absoluteTarget)
      const allowedFixture = canUseFixtures && !fixture.startsWith('..') && !fixture.startsWith('/')
      if ((target.startsWith('..') || target.startsWith('/')) && !allowedFixture) throw new Error(`Import leaves training/src: ${relative(root, path)}`)
    } else if (!['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'vitest', 'fake-indexeddb', 'fake-indexeddb/auto'].includes(specifier)) {
      throw new Error(`Review a new training dependency before importing: ${specifier}`)
    }
  }
}
console.log('Training source imports stay inside the isolated app and declared dependency boundary.')
