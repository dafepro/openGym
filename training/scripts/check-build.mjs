import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('../dist/', import.meta.url))
const expectedDemo = process.argv.includes('--demo')
async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat()
}
const paths = await files(directory)
const scripts = paths.filter(path => path.endsWith('.js'))
const text = (await Promise.all(scripts.map(path => readFile(path, 'utf8')))).join('\n')
const containsDemo = text.includes('SYNTHETIC_TRAINING_DEMO_ONLY')
if (text.includes('LOCAL_PRIVATE_TRAINING_PREVIEW_ONLY')) throw new Error('Private local preview module present in build')
if (containsDemo !== expectedDemo) throw new Error(`Sample module ${expectedDemo ? 'missing from demo' : 'present in default'} build`)
const containsSampleMedia = paths.includes(resolve(directory, 'media/sample-playback'))
if (containsSampleMedia !== expectedDemo) throw new Error(`Sample media ${expectedDemo ? 'missing from demo' : 'present in default'} build`)
if (paths.some(path => /exercise-media|\.map$/.test(path))) throw new Error('Unexpected source map or inherited exercise media in build')
if (!paths.includes(resolve(directory, 'fonts/OFL.txt'))) throw new Error('Font license missing from distribution')
const source = await readFile(resolve(directory, 'source.html'), 'utf8')
if (!source.includes('Corresponding application source')) throw new Error('Corresponding-source notice missing')
if (/^[a-f0-9]{40}$/.test(process.env.APP_BUILD || '') && !source.includes(`/tree/${process.env.APP_BUILD}/training`)) throw new Error('Source notice revision differs from build')
console.log(`Verified ${expectedDemo ? 'explicit demo' : 'default no-sample'} build (${scripts.length} script files).`)
