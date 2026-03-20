import type { ConfirmedTransaction, ExtractedTransactionCandidate } from '../../types'

export function sumCountedTransactions(items: Array<Pick<ExtractedTransactionCandidate | ConfirmedTransaction, 'reviewDisposition' | 'countsTowardTotals' | 'amountAbs'>>) {
  return items
    .filter((item) => item.reviewDisposition === 'categorized' && item.countsTowardTotals)
    .reduce((sum, item) => sum + item.amountAbs, 0)
}
