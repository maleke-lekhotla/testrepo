import { buildParsedRow, splitLines } from './shared'

const IGNORE_LINE = /^(accounts|transaction history|account options|previous \d+ days|ok)$/i
const DATE_LINE = /^\d{1,2} [a-z]{3} \d{4}$/i
const AMOUNT_LINE = /^R-?[\d.,]+$/i

export function detectFnb(text: string) {
  return /(transaction history|accounts|previous 7 days|purch )/i.test(text)
}

export function extractFnbRows(text: string, todayISO = '2026-03-19') {
  const lines = splitLines(text)
  const rows = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!DATE_LINE.test(line)) continue

    const dateRaw = line
    const descriptionParts: string[] = []
    let walk = index - 1
    while (walk >= 0 && !DATE_LINE.test(lines[walk]) && !AMOUNT_LINE.test(lines[walk]) && !IGNORE_LINE.test(lines[walk])) {
      descriptionParts.unshift(lines[walk])
      walk -= 1
    }
    if (descriptionParts.length === 0) continue

    const amountRaw = lines[index + 1]
    if (!amountRaw || !AMOUNT_LINE.test(amountRaw)) continue
    const description = descriptionParts.join(' ')
    rows.push(buildParsedRow(description, dateRaw, amountRaw, `${description} ${dateRaw} ${amountRaw}`, todayISO))
  }

  return rows
}
