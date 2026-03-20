export type CategoryClass = 'Fixed Costs' | 'Saving and Investments' | 'Credit' | 'Discretionary Spending'

export type Category = {
  id: string
  displayName: string
  class: CategoryClass
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ImportSourceKind = 'image' | 'pdf' | 'csv'
export type ReviewDisposition = 'categorized' | 'ignored'
export type ReviewStatus = 'pending' | 'reviewed' | 'confirmed'
export type Direction = 'debit' | 'credit' | 'unknown'
export type TransactionType = 'card' | 'transfer' | 'fee' | 'cash' | 'payment' | 'unknown'
export type TransactionStatus = 'posted' | 'uncleared' | 'unknown'
export type SupportedBank = 'absa' | 'fnb' | 'unknown'

export type SourceImage = {
  id: string
  fileName: string
  objectUrl: string
  sourceKind: ImportSourceKind
  bank: SupportedBank
  uploadedAt: string
  width?: number
  height?: number
  ocrText?: string
}

export type ConfidenceMap = {
  description: number
  date: number
  amount: number
  status: number
  categoryPrediction: number
}

export type SourceMetadata = {
  sourceImageId: string
  bank: SupportedBank
  rowIndex: number
  adapterKey: string
}

export type ExtractedTransactionCandidate = {
  id: string
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
  predictedCategoryId: string | null
  predictedCategoryConfidence: number
  predictedCategoryReason: string
  reviewDisposition: ReviewDisposition
  countsTowardTotals: boolean
  ignoredReason: string | null
  extractionConfidence: number
  fieldConfidence: ConfidenceMap
  reviewStatus: ReviewStatus
  source: SourceMetadata
}

export type ConfirmedTransaction = {
  id: string
  candidateId: string
  rawDescription: string
  normalizedDescription: string
  normalizedMerchant: string | null
  transactionDateISO: string | null
  signedAmount: number
  amountAbs: number
  currency: string
  direction: Direction
  transactionType: TransactionType
  transactionStatus: TransactionStatus
  categoryId: string | null
  reviewDisposition: ReviewDisposition
  countsTowardTotals: boolean
  confirmedAt: string
  source: SourceMetadata
}

export type MerchantRule = {
  id: string
  normalizedMerchant: string
  categoryId: string
  confidence: number
  learnedFromCount: number
  updatedAt: string
}

export type ImportBatch = {
  id: string
  createdAt: string
  sourceImages: SourceImage[]
  extractedCandidates: ExtractedTransactionCandidate[]
  confirmedTransactionIds: string[]
  status: 'draft' | 'reviewed' | 'completed'
}
