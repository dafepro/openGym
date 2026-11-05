import { readFile } from 'node:fs/promises'

const decoder = await readFile(new URL('../node_modules/jsqr/dist/jsQR.js', import.meta.url), 'utf8')
export async function decodeVisibleQR(page) {
  await page.addScriptTag({ content: decoder })
  return page.getByRole('img', { name: 'Scan to open this practice' }).evaluate(async svg => {
    const size = Math.round(svg.getBoundingClientRect().width * devicePixelRatio)
    const rendered = svg.cloneNode(true)
    rendered.setAttribute('width', size); rendered.setAttribute('height', size)
    rendered.style.width = `${size}px`; rendered.style.height = `${size}px`
    const image = new Image()
    image.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(rendered))}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, size, size)
    const pixels = context.getImageData(0, 0, size, size)
    return window.jsQR(pixels.data, size, size)?.data
  })
}

