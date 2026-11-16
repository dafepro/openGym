// The companion U-and-up-arrow mark, on the same 40 × 40 grid as public/icon.svg.
// Sample the two quadratic bends for the dependency-free native icon rasterizer.
export const MARK_STROKES = [
  [
    [12, 11],
    [12, 25],
    ...Array.from({ length: 24 }, (_, i) => {
      const t = (i + 1) / 24
      return [12 + 8 * t * t, 25 + 10 * t - 5 * t * t]
    }),
    ...Array.from({ length: 24 }, (_, i) => {
      const t = (i + 1) / 24
      return [20 + 16 * t - 8 * t * t, 30 - 5 * t * t]
    }),
    [28, 11]
  ],
  [
    [20, 26],
    [20, 10]
  ],
  [
    [15, 15],
    [20, 10],
    [25, 15]
  ]
]
export const MARK_PATH = 'M12 11v14q0 5 8 5t8-5V11M20 26V10m-5 5 5-5 5 5'
