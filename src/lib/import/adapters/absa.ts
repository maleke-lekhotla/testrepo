import { buildParsedRow, splitLines } from './shared'

const MONTH_HEADER = /^(january|february|march|april|may|june|july|august|september|october|november|december) \d{4}$/i
const DATE_LINE = /^(today|yesterday|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),? \d{1,2} [a-z]{3} \d{4}|\d{1,2} [a-z]{3} \d{4})$/i
const AMOUNT_LINE = /^-?R ?[\d.,]+$/i
const IGNORE_LINE = /^(current account|credit account|transactions|cards|statements|transaction history|account options|previous \d+ days|select it to view details|ok)$/i

export function detectAbsa(text: string) {
  return /(absa bank|notifyme|current account|credit account)/i.test(text)
}

export function extractAbsaRows(text: string, todayISO = '2026-03-19') {
  const lines = splitLines(text)
  const rows = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (MONTH_HEADER.test(line) || IGNORE_LINE.test(line) || !DATE_LINE.test(line)) continue

    const dateRaw = line
    const statusLine = lines[index + 1] && /uncleared/i.test(lines[index + 1]) ? lines[index + 1] : ''
    const amountLineIndex = statusLine ? index + 2 : index + 1
    const amountRaw = lines[amountLineIndex]
    if (!amountRaw || !AMOUNT_LINE.test(amountRaw)) continue

    const descriptionParts: string[] = []
    let walk = index - 1
    while (walk >= 0 && !DATE_LINE.test(lines[walk]) && !MONTH_HEADER.test(lines[walk]) && !AMOUNT_LINE.test(lines[walk]) && !IGNORE_LINE.test(lines[walk])) {
      descriptionParts.unshift(lines[walk])
      walk -= 1
    }

    if (descriptionParts.length === 0) continue
    const description = descriptionParts.join(' ')
    const rowText = [description, dateRaw, statusLine, amountRaw].filter(Boolean).join(' ')
    rows.push(buildParsedRow(description, dateRaw, amountRaw, rowText, todayISO))
  }

  return dedupeRows(rows)
}

function dedupeRows<T extends { rawDescription: string; transactionDateRaw: string; amountRaw: string }>(rows: T[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.rawDescription}|${row.transactionDateRaw}|${row.amountRaw}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
