import { parseTransactionDate } from '../../dateParsing'
import type { Direction, TransactionStatus, TransactionType } from '../../../types'

export type ParsedRow = {
  rawDescription: string
  normalizedDescription: string
  normalizedMerchant: string | null
  transactionDateRaw: string
  transactionDateISO: string | null
  amountRaw: string
  signedAmount: number
  amountAbs: number
  currency: string
  direction: Direction
  transactionType: TransactionType
  transactionStatus: TransactionStatus
  extractionConfidence: number
  fieldConfidence: {
    description: number
    date: number
    amount: number
    status: number
    categoryPrediction: number
  }
}

export function normalizeDescription(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function inferMerchant(text: string): string | null {
  const cleaned = text
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\b(za|cpt|western cape|stockholm|ie|sms|notifications|amt|eff)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null

  const fragments = cleaned.split(/ {2,}| - /).map((part) => part.trim()).filter(Boolean)
  return (fragments[0] ?? cleaned).toLowerCase()
}

export function parseAmount(amountRaw: string) {
  const compact = amountRaw.replace(/\s+/g, '')
  const negative = compact.includes('-')
  const numeric = Number(compact.replace(/[R,]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  const signedAmount = negative ? -Math.abs(numeric) : Math.abs(numeric)
  return {
    signedAmount,
    amountAbs: Math.abs(signedAmount),
    direction: (signedAmount < 0 ? 'debit' : 'credit') as Direction,
    currency: 'ZAR'
  }
}

export function inferTransactionType(description: string): TransactionType {
  if (/fee|charge/i.test(description)) return 'fee'
  if (/transf|transfer|payment|credit card|savings/i.test(description)) return 'transfer'
  if (/purch|uber|spotify|apple|spar|caffe/i.test(description)) return 'card'
  return 'unknown'
}

export function inferStatus(rowText: string): TransactionStatus {
  return /uncleared/i.test(rowText) ? 'uncleared' : 'posted'
}

export function buildParsedRow(description: string, dateRaw: string, amountRaw: string, rowText: string, todayISO: string): ParsedRow {
  const normalizedDescription = normalizeDescription(description)
  const parsedAmount = parseAmount(amountRaw)
  return {
    rawDescription: description.trim(),
    normalizedDescription,
    normalizedMerchant: inferMerchant(description),
    transactionDateRaw: dateRaw.trim(),
    transactionDateISO: parseTransactionDate(dateRaw, todayISO),
    amountRaw: amountRaw.trim(),
    signedAmount: parsedAmount.signedAmount,
    amountAbs: parsedAmount.amountAbs,
    currency: parsedAmount.currency,
    direction: parsedAmount.direction,
    transactionType: inferTransactionType(description),
    transactionStatus: inferStatus(rowText),
    extractionConfidence: /uncleared/i.test(rowText) ? 0.88 : 0.92,
    fieldConfidence: {
      description: 0.9,
      date: 0.86,
      amount: 0.94,
      status: /uncleared/i.test(rowText) ? 0.97 : 0.7,
      categoryPrediction: 0
    }
  }
}

export function splitLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
