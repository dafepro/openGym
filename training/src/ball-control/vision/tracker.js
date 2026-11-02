// Pure, local sampled-color tracking. A detection is observed pixels, never a prediction.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const hueDistance = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b))
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1

function validImage(image) {
  return image && Number.isInteger(image.width) && Number.isInteger(image.height) &&
    image.width >= 8 && image.height >= 8 && image.width * image.height <= 2000000 &&
    image.data && image.data.length === image.width * image.height * 4
}

function hsv(data, index) {
  const r = data[index] / 255, g = data[index + 1] / 255, b = data[index + 2] / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  let h = 0
  if (delta) {
    h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
    h = (h / 6 + 1) % 1
  }
  return { h, s: max ? delta / max : 0, v: max }
}

export function sampleBallColor(imageData, point) {
  if (!validImage(imageData)) throw new Error('Camera frame is unavailable. Wait for the preview and try again.')
  if (!point || !unit(point.x) || !unit(point.y)) throw new Error('Choose a point inside the camera image.')
  const { width, height, data } = imageData
  const cx = Math.round(point.x * (width - 1)), cy = Math.round(point.y * (height - 1))
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.018))
  const colors = []
  let total = 0
  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
      total++
      const color = hsv(data, (y * width + x) * 4)
      if (data[(y * width + x) * 4 + 3] >= 200 && color.s >= 0.3 && color.v >= 0.16) colors.push(color)
    }
  }
  if (colors.length < total * 0.7) throw new Error('Tap a bright, strongly colored panel on the ball, away from white, black and shadows.')
  // Choose the dominant local hue; circular arithmetic also handles a red panel at 0/1.
  let cluster = []
  for (const seed of colors) {
    const nearby = colors.filter(color => hueDistance(color.h, seed.h) <= 0.055)
    if (nearby.length > cluster.length) cluster = nearby
  }
  if (cluster.length < total * 0.7) throw new Error('That sample mixes colors. Tap the middle of one colored ball panel.')
  const sx = cluster.reduce((sum, c) => sum + Math.cos(c.h * Math.PI * 2), 0)
  const sy = cluster.reduce((sum, c) => sum + Math.sin(c.h * Math.PI * 2), 0)
  const hue = (Math.atan2(sy, sx) / (Math.PI * 2) + 1) % 1
  const saturation = cluster.reduce((sum, c) => sum + c.s, 0) / cluster.length
  const value = cluster.reduce((sum, c) => sum + c.v, 0) / cluster.length
  return { version: 1, hue, hueTolerance: 0.065, minSaturation: Math.max(0.25, saturation * 0.5), minValue: Math.max(0.12, value * 0.35) }
}

function validProfile(profile) {
  return profile?.version === 1 && unit(profile.hue) && Number.isFinite(profile.hueTolerance) &&
    profile.hueTolerance >= 0.01 && profile.hueTolerance <= 0.12 &&
    unit(profile.minSaturation) && profile.minSaturation >= 0.2 &&
    unit(profile.minValue) && profile.minValue >= 0.08
}

export function detectBall(imageData, profile, previous = null) {
  if (!validImage(imageData) || !validProfile(profile)) return null
  const { width, height, data } = imageData
  const size = width * height, mask = new Uint8Array(size), queue = new Int32Array(size)
  for (let i = 0; i < size; i++) {
    if (data[i * 4 + 3] < 200) continue
    const color = hsv(data, i * 4)
    if (color.s >= profile.minSaturation && color.v >= profile.minValue && hueDistance(color.h, profile.hue) <= profile.hueTolerance) mask[i] = 1
  }
  const prior = previous && unit(previous.x) && unit(previous.y) && Number.isFinite(previous.radius) && previous.radius > 0 && previous.radius < 0.5 ? previous : null
  const candidates = []
  for (let start = 0; start < size; start++) {
    if (!mask[start]) continue
    let head = 0, tail = 1, sumX = 0, sumY = 0
    let minX = width, minY = height, maxX = 0, maxY = 0
    queue[0] = start; mask[start] = 0
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width)
      sumX += x; sumY += y
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const next = ny * width + nx
          if (mask[next]) { mask[next] = 0; queue[tail++] = next }
        }
      }
    }
    const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1
    const ratio = boxWidth / boxHeight, fill = tail / (boxWidth * boxHeight)
    if (tail < Math.max(9, size * 0.0004) || tail > size * 0.18 || boxWidth < 3 || boxHeight < 3 ||
      ratio < 0.5 || ratio > 2 || fill < 0.4 || minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1) continue
    const detection = { x: (sumX / tail + 0.5) / width, y: (sumY / tail + 0.5) / height,
      radius: Math.sqrt(tail / Math.PI) / width,
      confidence: clamp(0.65 + 0.2 * Math.min(ratio, 1 / ratio) + 0.15 * Math.min(fill / 0.78, 1), 0, 1) }
    let distance = 0
    if (prior) {
      distance = Math.hypot(detection.x - prior.x, (detection.y - prior.y) * height / width)
      const scale = detection.radius / prior.radius
      if (distance > clamp(prior.radius * 4, 0.075, 0.22) || scale < 0.45 || scale > 2.2) continue
    }
    candidates.push({ detection, score: detection.confidence - distance * 1.5 })
  }
  candidates.sort((a, b) => b.score - a.score)
  if (!candidates.length || (candidates[1] && candidates[0].score - candidates[1].score < 0.08)) return null
  return candidates[0].detection
}
