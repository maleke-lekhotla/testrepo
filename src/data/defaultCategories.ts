import type { Category } from '../types'

const now = '2026-03-19T00:00:00.000Z'

export const defaultCategories: Category[] = [
  { id: 'housing', displayName: 'Housing', class: 'Fixed Costs', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'utilities', displayName: 'Utilities', class: 'Fixed Costs', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'savings', displayName: 'Savings', class: 'Saving and Investments', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'investments', displayName: 'Investments', class: 'Saving and Investments', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'credit-payments', displayName: 'Credit Payments', class: 'Credit', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'banking', displayName: 'Banking', class: 'Credit', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'groceries', displayName: 'Groceries', class: 'Discretionary Spending', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'transport', displayName: 'Transport', class: 'Discretionary Spending', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'dining', displayName: 'Dining', class: 'Discretionary Spending', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'entertainment', displayName: 'Entertainment', class: 'Discretionary Spending', archivedAt: null, createdAt: now, updatedAt: now },
  { id: 'income', displayName: 'Income', class: 'Fixed Costs', archivedAt: null, createdAt: now, updatedAt: now }
]
