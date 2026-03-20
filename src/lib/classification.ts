import type { Category, ExtractedTransactionCandidate, MerchantRule } from '../types'

const merchantKeywords: Array<{ match: RegExp; categoryId: string; reason: string }> = [
  { match: /(fee|finance charge|notifyme|archive stmt enq|international transaction fee)/i, categoryId: 'banking', reason: 'Matched banking fee keywords.' },
  { match: /(uber)/i, categoryId: 'transport', reason: 'Matched transport merchant keyword.' },
  { match: /(spar|superspar)/i, categoryId: 'groceries', reason: 'Matched grocery merchant keyword.' },
  { match: /(spotify|itunes|apple\.com\/bill|midjourney|elevenlabs)/i, categoryId: 'entertainment', reason: 'Matched digital subscription keyword.' },
  { match: /(vida e caffe|caffe)/i, categoryId: 'dining', reason: 'Matched dining merchant keyword.' },
  { match: /(savings)/i, categoryId: 'savings', reason: 'Matched savings transfer keyword.' },
  { match: /(credit card|digital transf)/i, categoryId: 'credit-payments', reason: 'Matched credit transfer keyword.' },
  { match: /(electricity|utilities)/i, categoryId: 'utilities', reason: 'Matched utilities keyword.' }
]

export function predictCategory(
  candidate: Pick<ExtractedTransactionCandidate, 'normalizedDescription' | 'normalizedMerchant' | 'transactionStatus'>,
  categories: Category[],
  rules: MerchantRule[]
) {
  const activeCategoryIds = new Set(categories.filter((category) => !category.archivedAt).map((category) => category.id))

  if (candidate.transactionStatus === 'uncleared') {
    return {
      predictedCategoryId: null,
      confidence: 0,
      reason: 'Uncleared transactions are ignored by default until reviewed.'
    }
  }

  const merchant = candidate.normalizedMerchant ?? ''
  const rule = rules.find((entry) => entry.normalizedMerchant === merchant && activeCategoryIds.has(entry.categoryId))
  if (rule) {
    return {
      predictedCategoryId: rule.categoryId,
      confidence: Math.min(0.98, rule.confidence),
      reason: `Learned merchant rule matched ${merchant}.`
    }
  }

  const haystack = `${candidate.normalizedDescription} ${merchant}`
  const keywordMatch = merchantKeywords.find((entry) => entry.match.test(haystack) && activeCategoryIds.has(entry.categoryId))
  if (keywordMatch) {
    return {
      predictedCategoryId: keywordMatch.categoryId,
      confidence: 0.82,
      reason: keywordMatch.reason
    }
  }

  return {
    predictedCategoryId: null,
    confidence: 0.3,
    reason: 'No confident category match yet.'
  }
}
