export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function formatCurrency(amount: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

export function toPercent(value: number) {
  return `${value.toFixed(1)}%`
}
