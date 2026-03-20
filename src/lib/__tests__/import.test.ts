import { describe, expect, it } from 'vitest'
import { defaultCategories } from '../../data/defaultCategories'
import { predictCategory } from '../classification'
import { parseTransactionDate } from '../dateParsing'
import { extractCandidatesFromText } from '../import/extractor'
import { sampleOcrByFileName } from '../import/fixtures'
import { sumCountedTransactions } from '../import/review'
import type { ExtractedTransactionCandidate, MerchantRule } from '../../types'

const categories = defaultCategories
const rules: MerchantRule[] = []

describe('transaction import extraction', () => {
  it('extracts only visible transaction rows from ABSA screenshots', () => {
    const result = extractCandidatesFromText({
      text: sampleOcrByFileName['absa-current-account.png'],
      sourceImageId: 'img-1',
      categories,
      merchantRules: rules,
      todayISO: '2026-02-18'
    })

    expect(result.bank).toBe('absa')
    expect(result.candidates).toHaveLength(4)
    expect(result.candidates.map((candidate) => candidate.rawDescription)).toContain('DIGITAL TRANSF DT 45502714-1687-1013 ABSA BANK credit card')
  })

  it('does not treat month headers as transactions', () => {
    const result = extractCandidatesFromText({
      text: sampleOcrByFileName['absa-current-account.png'],
      sourceImageId: 'img-1',
      categories,
      merchantRules: rules,
      todayISO: '2026-02-18'
    })

    expect(result.candidates.some((candidate) => /february 2026/i.test(candidate.rawDescription))).toBe(false)
  })

  it('parses Today and Yesterday relative dates', () => {
    expect(parseTransactionDate('Today', '2026-03-19')).toBe('2026-03-19')
    expect(parseTransactionDate('Yesterday', '2026-03-19')).toBe('2026-03-18')
  })

  it('detects uncleared status and defaults it to ignored', () => {
    const result = extractCandidatesFromText({
      text: sampleOcrByFileName['absa-uncleared.png'],
      sourceImageId: 'img-2',
      categories,
      merchantRules: rules,
      todayISO: '2026-03-19'
    })

    const uncleared = result.candidates.find((candidate) => candidate.transactionStatus === 'uncleared')
    expect(uncleared).toBeDefined()
    expect(uncleared?.reviewDisposition).toBe('ignored')
    expect(uncleared?.countsTowardTotals).toBe(false)
    expect(uncleared?.predictedCategoryId).toBeNull()
  })

  it('excludes ignored rows from totals and supports override back to categorized', () => {
    const base: ExtractedTransactionCandidate[] = [
      {
        id: 'a', rawDescription: 'Finance Charge', normalizedDescription: 'finance charge', normalizedMerchant: 'finance charge', transactionDateRaw: 'Yesterday', transactionDateISO: '2026-03-18', amountRaw: '-R 1,53', signedAmount: -1.53, amountAbs: 1.53, currency: 'ZAR', direction: 'debit', transactionType: 'fee', transactionStatus: 'posted', predictedCategoryId: 'banking', predictedCategoryConfidence: 0.8, predictedCategoryReason: 'fee', reviewDisposition: 'categorized', countsTowardTotals: true, ignoredReason: null, extractionConfidence: 0.9, fieldConfidence: { description: 0.9, date: 0.9, amount: 0.9, status: 0.9, categoryPrediction: 0.9 }, reviewStatus: 'reviewed', source: { sourceImageId: 'x', bank: 'absa', rowIndex: 0, adapterKey: 'absa' }
      },
      {
        id: 'b', rawDescription: 'Superspar', normalizedDescription: 'superspar', normalizedMerchant: 'superspar', transactionDateRaw: 'Today', transactionDateISO: '2026-03-19', amountRaw: 'R 106,00', signedAmount: 106, amountAbs: 106, currency: 'ZAR', direction: 'credit', transactionType: 'card', transactionStatus: 'uncleared', predictedCategoryId: null, predictedCategoryConfidence: 0, predictedCategoryReason: 'uncleared', reviewDisposition: 'ignored', countsTowardTotals: false, ignoredReason: 'Ignored by default because the transaction is marked as Uncleared.', extractionConfidence: 0.9, fieldConfidence: { description: 0.9, date: 0.9, amount: 0.9, status: 0.9, categoryPrediction: 0.1 }, reviewStatus: 'reviewed', source: { sourceImageId: 'x', bank: 'absa', rowIndex: 1, adapterKey: 'absa' }
      }
    ]

    expect(sumCountedTransactions(base)).toBeCloseTo(1.53)
    const overridden = base.map((item) => item.id === 'b' ? { ...item, reviewDisposition: 'categorized' as const, countsTowardTotals: true, predictedCategoryId: 'groceries', ignoredReason: null } : item)
    expect(sumCountedTransactions(overridden)).toBeCloseTo(107.53)
  })

  it('classifies banking fees into Banking', () => {
    const prediction = predictCategory({ normalizedDescription: 'international transaction fee', normalizedMerchant: 'international transaction fee', transactionStatus: 'posted' }, categories, rules)
    expect(prediction.predictedCategoryId).toBe('banking')
  })
})
