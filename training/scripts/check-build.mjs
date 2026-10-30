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
if (containsDemo !== expectedDemo) throw new Error(`Sample module ${expectedDemo ? 'missing from demo' : 'present in default'} build`)
const containsSampleMedia = paths.includes(resolve(directory, 'media/sample-playback'))
if (containsSampleMedia !== expectedDemo) throw new Error(`Sample media ${expectedDemo ? 'missing from demo' : 'present in default'} build`)
if (paths.some(path => /exercise-media|\.map$/.test(path))) throw new Error('Unexpected source map or inherited exercise media in build')
if (!paths.includes(resolve(directory, 'fonts/OFL.txt'))) throw new Error('Font license missing from distribution')
console.log(`Verified ${expectedDemo ? 'explicit demo' : 'default no-sample'} build (${scripts.length} script files).`)
