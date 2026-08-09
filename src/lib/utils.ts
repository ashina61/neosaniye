export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function formatNumber(
  n: number,
  format: 'integer' | 'decimal' | 'currency' | 'percent' = 'integer'
): string {
  switch (format) {
    case 'integer':
      return Math.round(n).toLocaleString()
    case 'decimal':
      return n.toFixed(1)
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
    case 'percent':
      return `${Math.round(n)}%`
  }
}
