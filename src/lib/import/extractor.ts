import { predictCategory } from '../classification'
import { createId } from '../utils'
import type { Category, ExtractedTransactionCandidate, MerchantRule, SupportedBank } from '../../types'
import { detectAbsa, extractAbsaRows } from './adapters/absa'
import { detectFnb, extractFnbRows } from './adapters/fnb'

export type Adapter = {
  key: SupportedBank
  detect: (text: string) => boolean
  extract: (text: string, todayISO?: string) => ReturnType<typeof extractAbsaRows>
}

export const adapters: Adapter[] = [
  { key: 'absa', detect: detectAbsa, extract: extractAbsaRows },
  { key: 'fnb', detect: detectFnb, extract: extractFnbRows }
]

export function detectBank(text: string): SupportedBank {
  return adapters.find((adapter) => adapter.detect(text))?.key ?? 'unknown'
}

export function extractCandidatesFromText(args: {
  text: string
  sourceImageId: string
  categories: Category[]
  merchantRules: MerchantRule[]
  todayISO?: string
  forcedBank?: SupportedBank
}) {
  const bank = args.forcedBank && args.forcedBank !== 'unknown' ? args.forcedBank : detectBank(args.text)
  const adapter = adapters.find((entry) => entry.key === bank)
  if (!adapter) return { bank, candidates: [] as ExtractedTransactionCandidate[] }

  const parsedRows = adapter.extract(args.text, args.todayISO)
  const candidates = parsedRows.map((row, rowIndex) => {
    const prediction = predictCategory(row, args.categories, args.merchantRules)
    const uncleared = row.transactionStatus === 'uncleared'
    return {
      id: createId('candidate'),
      rawDescription: row.rawDescription,
      normalizedDescription: row.normalizedDescription,
      normalizedMerchant: row.normalizedMerchant,
      transactionDateRaw: row.transactionDateRaw,
      transactionDateISO: row.transactionDateISO,
      amountRaw: row.amountRaw,
      signedAmount: row.signedAmount,
      amountAbs: row.amountAbs,
      currency: row.currency,
      direction: row.direction,
      transactionType: row.transactionType,
      transactionStatus: row.transactionStatus,
      predictedCategoryId: uncleared ? null : prediction.predictedCategoryId,
      predictedCategoryConfidence: prediction.confidence,
      predictedCategoryReason: prediction.reason,
      reviewDisposition: uncleared ? 'ignored' : 'categorized',
      countsTowardTotals: !uncleared,
      ignoredReason: uncleared ? 'Ignored by default because the transaction is marked as Uncleared.' : null,
      extractionConfidence: row.extractionConfidence,
      fieldConfidence: { ...row.fieldConfidence, categoryPrediction: prediction.confidence },
      reviewStatus: 'pending',
      source: {
        sourceImageId: args.sourceImageId,
        bank,
        rowIndex,
        adapterKey: adapter.key
      }
    } satisfies ExtractedTransactionCandidate
  })

  return { bank, candidates }
}
