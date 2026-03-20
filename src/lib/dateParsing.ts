const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
}

export function parseTransactionDate(raw: string, todayISO = '2026-03-19'): string | null {
  const cleaned = raw.trim().replace(/,/g, '')
  const today = new Date(`${todayISO}T12:00:00Z`)
  const lowered = cleaned.toLowerCase()

  if (lowered === 'today') return todayISO
  if (lowered === 'yesterday') {
    const prior = new Date(today)
    prior.setUTCDate(today.getUTCDate() - 1)
    return prior.toISOString().slice(0, 10)
  }

  const words = cleaned.split(/\s+/)
  const maybeMonth = words.find((word) => MONTHS[word.slice(0, 3).toLowerCase()] !== undefined)
  const day = words.find((word) => /^\d{1,2}$/.test(word))
  const year = words.find((word) => /^\d{4}$/.test(word))

  if (!maybeMonth || !day || !year) return null

  const date = new Date(Date.UTC(Number(year), MONTHS[maybeMonth.slice(0, 3).toLowerCase()], Number(day)))
  return date.toISOString().slice(0, 10)
}
