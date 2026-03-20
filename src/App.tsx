import { useMemo, useState } from 'react'
import { defaultCategories } from './data/defaultCategories'
import { extractCandidatesFromText } from './lib/import/extractor'
import { extractOcrText } from './lib/import/ocr'
import { createId, formatCurrency, slugify, toPercent } from './lib/utils'
import type {
  Category,
  ConfirmedTransaction,
  ExtractedTransactionCandidate,
  ImportBatch,
  MerchantRule,
  ReviewDisposition,
  SourceImage,
  SupportedBank
} from './types'
import './styles.css'

const TODAY_ISO = '2026-03-19'
const BANK_OPTIONS: SupportedBank[] = ['unknown', 'absa', 'fnb']

function cloneCategory(category: Category): Category {
  return { ...category }
}

function activeCategories(categories: Category[]) {
  return categories.filter((category) => !category.archivedAt)
}

function sortCandidates(candidates: ExtractedTransactionCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (left.reviewDisposition !== right.reviewDisposition) {
      return left.reviewDisposition === 'ignored' ? 1 : -1
    }
    return left.extractionConfidence - right.extractionConfidence
  })
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>(defaultCategories.map(cloneCategory))
  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([])
  const [confirmedTransactions, setConfirmedTransactions] = useState<ConfirmedTransaction[]>([])
  const [currentBatch, setCurrentBatch] = useState<ImportBatch | null>(null)
  const [plannedIncome, setPlannedIncome] = useState('25000')
  const [actualIncome, setActualIncome] = useState('24000')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryClass, setNewCategoryClass] = useState<Category['class']>('Discretionary Spending')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankOverrides, setBankOverrides] = useState<Record<string, SupportedBank>>({})

  const visibleConfirmed = useMemo(
    () => confirmedTransactions.filter((tx) => tx.reviewDisposition === 'categorized' && tx.countsTowardTotals),
    [confirmedTransactions]
  )

  const activeCategoryList = useMemo(() => activeCategories(categories), [categories])
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category])), [categories])

  const analytics = useMemo(() => {
    const perClass = ['Fixed Costs', 'Saving and Investments', 'Credit', 'Discretionary Spending'].map((group) => {
      const matchingCategories = new Set(categories.filter((category) => category.class === group).map((category) => category.id))
      const planned = visibleConfirmed
        .filter((tx) => tx.categoryId && matchingCategories.has(tx.categoryId))
        .reduce((sum, tx) => sum + tx.amountAbs, 0)
      const actual = currentBatch?.extractedCandidates
        .filter((tx) => tx.reviewDisposition === 'categorized' && tx.countsTowardTotals && tx.predictedCategoryId && matchingCategories.has(tx.predictedCategoryId))
        .reduce((sum, tx) => sum + tx.amountAbs, 0) ?? planned
      const plannedPct = Number(plannedIncome) ? (planned / Number(plannedIncome)) * 100 : 0
      const actualPct = Number(actualIncome) ? (actual / Number(actualIncome)) * 100 : 0
      return { group, plannedPct, actualPct }
    })

    const plannedTotal = visibleConfirmed.reduce((sum, tx) => sum + tx.amountAbs, 0)
    const actualTotal = currentBatch?.extractedCandidates
      .filter((tx) => tx.reviewDisposition === 'categorized' && tx.countsTowardTotals)
      .reduce((sum, tx) => sum + tx.amountAbs, 0) ?? plannedTotal

    return { perClass, plannedTotal, actualTotal, maxPct: Math.max(60, ...perClass.flatMap((g) => [g.plannedPct, g.actualPct])) }
  }, [categories, currentBatch, actualIncome, plannedIncome, visibleConfirmed])

  async function handleImport(files: FileList | null) {
    if (!files?.length) return
    setImporting(true)
    setError(null)

    try {
      const sourceImages: SourceImage[] = []
      let candidates: ExtractedTransactionCandidate[] = []

      for (const file of Array.from(files)) {
        const sourceImageId = createId('image')
        const objectUrl = URL.createObjectURL(file)
        const ocrText = await extractOcrText(file)
        const bankOverride = bankOverrides[file.name]
        const extraction = extractCandidatesFromText({
          text: ocrText,
          sourceImageId,
          categories,
          merchantRules,
          todayISO: TODAY_ISO,
          forcedBank: bankOverride
        })

        sourceImages.push({
          id: sourceImageId,
          fileName: file.name,
          objectUrl,
          sourceKind: 'image',
          bank: extraction.bank,
          uploadedAt: new Date().toISOString(),
          ocrText
        })
        candidates = candidates.concat(extraction.candidates)
      }

      setCurrentBatch({
        id: createId('batch'),
        createdAt: new Date().toISOString(),
        sourceImages,
        extractedCandidates: sortCandidates(candidates),
        confirmedTransactionIds: [],
        status: 'draft'
      })
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  function updateCandidate(candidateId: string, patch: Partial<ExtractedTransactionCandidate>) {
    setCurrentBatch((batch) => batch
      ? {
          ...batch,
          extractedCandidates: sortCandidates(batch.extractedCandidates.map((candidate) => {
            if (candidate.id !== candidateId) return candidate
            return { ...candidate, ...patch, reviewStatus: 'reviewed' }
          }))
        }
      : batch)
  }

  function setCandidateDisposition(candidate: ExtractedTransactionCandidate, disposition: ReviewDisposition, categoryId: string | null) {
    updateCandidate(candidate.id, {
      predictedCategoryId: disposition === 'ignored' ? null : categoryId,
      reviewDisposition: disposition,
      countsTowardTotals: disposition === 'categorized',
      ignoredReason: disposition === 'ignored' ? (candidate.transactionStatus === 'uncleared'
        ? 'Ignored by default because the transaction is marked as Uncleared.'
        : 'Ignored by reviewer.') : null
    })
  }

  function confirmBatch() {
    if (!currentBatch) return

    const confirmed = currentBatch.extractedCandidates.map((candidate) => ({
      id: createId('confirmed'),
      candidateId: candidate.id,
      rawDescription: candidate.rawDescription,
      normalizedDescription: candidate.normalizedDescription,
      normalizedMerchant: candidate.normalizedMerchant,
      transactionDateISO: candidate.transactionDateISO,
      signedAmount: candidate.signedAmount,
      amountAbs: candidate.amountAbs,
      currency: candidate.currency,
      direction: candidate.direction,
      transactionType: candidate.transactionType,
      transactionStatus: candidate.transactionStatus,
      categoryId: candidate.predictedCategoryId,
      reviewDisposition: candidate.reviewDisposition,
      countsTowardTotals: candidate.countsTowardTotals,
      confirmedAt: new Date().toISOString(),
      source: candidate.source
    }))

    const nextRules = [...merchantRules]
    currentBatch.extractedCandidates.forEach((candidate) => {
      if (candidate.reviewDisposition === 'categorized' && candidate.countsTowardTotals && candidate.predictedCategoryId && candidate.normalizedMerchant) {
        const existing = nextRules.find((rule) => rule.normalizedMerchant === candidate.normalizedMerchant)
        if (existing) {
          existing.categoryId = candidate.predictedCategoryId
          existing.learnedFromCount += 1
          existing.confidence = Math.min(0.99, existing.confidence + 0.05)
          existing.updatedAt = new Date().toISOString()
        } else {
          nextRules.push({
            id: createId('rule'),
            normalizedMerchant: candidate.normalizedMerchant,
            categoryId: candidate.predictedCategoryId,
            confidence: Math.max(0.75, candidate.predictedCategoryConfidence),
            learnedFromCount: 1,
            updatedAt: new Date().toISOString()
          })
        }
      }
    })

    setMerchantRules(nextRules)
    setConfirmedTransactions((current) => [...confirmed, ...current])
    setCurrentBatch({ ...currentBatch, confirmedTransactionIds: confirmed.map((tx) => tx.id), status: 'completed' })
  }

  function addCategory() {
    if (!newCategoryName.trim()) return
    const now = new Date().toISOString()
    setCategories((current) => [
      ...current,
      {
        id: slugify(newCategoryName) || createId('category'),
        displayName: newCategoryName.trim(),
        class: newCategoryClass,
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      }
    ])
    setNewCategoryName('')
  }

  function renameCategory(categoryId: string) {
    const draft = renameDrafts[categoryId]?.trim()
    if (!draft) return
    setCategories((current) => current.map((category) => category.id === categoryId
      ? { ...category, displayName: draft, updatedAt: new Date().toISOString() }
      : category))
  }

  function archiveCategory(categoryId: string, archived: boolean) {
    setCategories((current) => current.map((category) => category.id === categoryId
      ? { ...category, archivedAt: archived ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }
      : category))
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Phase 1 import engine</p>
          <h1>Budget screenshot import and review</h1>
          <p className="subtitle">
            Upload ABSA and FNB mobile banking screenshots, extract only clearly visible rows, review predictions,
            ignore Uncleared rows by default, and confirm transactions into your budget ledger.
          </p>
        </div>
        <div className="hero-stats">
          <label>
            Planned income
            <input value={plannedIncome} onChange={(event) => setPlannedIncome(event.target.value)} type="number" />
          </label>
          <label>
            Actual income
            <input value={actualIncome} onChange={(event) => setActualIncome(event.target.value)} type="number" />
          </label>
        </div>
      </header>

      <section className="panel import-panel">
        <div className="section-head">
          <div>
            <h2>Modular transaction import</h2>
            <p>Supports multi-image import, adapter-isolated bank logic, and future PDF/CSV/offline extraction extensions.</p>
          </div>
          <button className="secondary">Planned extensions: PDF, CSV, duplicates, recurring, split, offline OCR</button>
        </div>

        <div className="import-controls">
          <label className="upload-box">
            <span>{importing ? 'Extracting screenshots…' : 'Upload one or more screenshots'}</span>
            <input type="file" accept="image/*" multiple onChange={(event) => void handleImport(event.target.files)} />
          </label>
          <div className="bank-hint">
            <h3>Phase 1 banks</h3>
            <p>ABSA and FNB are enabled today. Additional bank adapters can plug into the import pipeline later.</p>
          </div>
        </div>

        <div className="fixture-tip">
          <strong>Quick demo:</strong> rename screenshots to one of these fixture names to simulate extraction with the attached layouts:
          <code>absa-current-account.png</code>, <code>absa-credit-account.png</code>, <code>fnb-transaction-history.png</code>, <code>absa-uncleared.png</code>.
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel chart-panel">
        <h2>Spending as a percentage of income</h2>
        <div className="legend"><span><i className="swatch planned" /> Planned</span><span><i className="swatch actual" /> Actual</span></div>
        <div className="chart-grid">
          {analytics.perClass.map((item) => (
            <div key={item.group} className="chart-group">
              <div className="bars">
                <div className="bar planned" style={{ height: `${(item.plannedPct / analytics.maxPct) * 100}%` }}><span>{Math.round(item.plannedPct)}</span></div>
                <div className="bar actual" style={{ height: `${(item.actualPct / analytics.maxPct) * 100}%` }}><span>{Math.round(item.actualPct)}</span></div>
              </div>
              <p>{item.group === 'Saving and Investments' ? 'Savings & Investments' : item.group}</p>
            </div>
          ))}
        </div>
        <div className="totals-grid">
          <article className="metric-card"><h3>Planned total</h3><p>{formatCurrency(analytics.plannedTotal)}</p><small>{toPercent(Number(plannedIncome) ? (analytics.plannedTotal / Number(plannedIncome)) * 100 : 0)} of planned income</small></article>
          <article className="metric-card"><h3>Actual total</h3><p>{formatCurrency(analytics.actualTotal)}</p><small>{toPercent(Number(actualIncome) ? (analytics.actualTotal / Number(actualIncome)) * 100 : 0)} of actual income</small></article>
        </div>
      </section>

      <section className="panel two-column">
        <div>
          <div className="section-head compact">
            <div>
              <h2>Category system</h2>
              <p>Add, rename, archive, and restore categories with stable IDs.</p>
            </div>
          </div>
          <div className="category-create">
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="New category name" />
            <select value={newCategoryClass} onChange={(event) => setNewCategoryClass(event.target.value as Category['class'])}>
              <option>Fixed Costs</option>
              <option>Saving and Investments</option>
              <option>Credit</option>
              <option>Discretionary Spending</option>
            </select>
            <button onClick={addCategory}>Add category</button>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <div key={category.id} className={`category-card ${category.archivedAt ? 'archived' : ''}`}>
                <div>
                  <strong>{category.displayName}</strong>
                  <p>{category.class}</p>
                  <small>ID: {category.id}</small>
                </div>
                <div className="category-actions">
                  <input
                    value={renameDrafts[category.id] ?? category.displayName}
                    onChange={(event) => setRenameDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                  />
                  <button onClick={() => renameCategory(category.id)}>Rename</button>
                  <button className="secondary" onClick={() => archiveCategory(category.id, !category.archivedAt)}>
                    {category.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2>Merchant memory</h2>
          <p>Confirmed category choices teach future imports without hard-coding merchants into the UI.</p>
          <div className="memory-list">
            {merchantRules.length === 0 ? <p className="empty-state">No learned merchant rules yet.</p> : merchantRules.map((rule) => (
              <div key={rule.id} className="memory-card">
                <strong>{rule.normalizedMerchant}</strong>
                <span>{categoryMap[rule.categoryId]?.displayName ?? rule.categoryId}</span>
                <small>confidence {Math.round(rule.confidence * 100)}% · learned {rule.learnedFromCount}×</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Import review</h2>
            <p>Low-confidence rows are shown first. Ignored rows remain visible and never count toward totals.</p>
          </div>
          <button onClick={confirmBatch} disabled={!currentBatch || currentBatch.extractedCandidates.length === 0}>Confirm reviewed transactions</button>
        </div>

        {!currentBatch ? <p className="empty-state">No import batch yet. Upload screenshots to start review.</p> : (
          <div className="review-layout">
            <aside className="source-list">
              <h3>Source images</h3>
              {currentBatch.sourceImages.map((image) => (
                <div key={image.id} className="source-card">
                  <img src={image.objectUrl} alt={image.fileName} />
                  <div>
                    <strong>{image.fileName}</strong>
                    <p>Detected bank: {image.bank.toUpperCase()}</p>
                    <label>
                      Override adapter
                      <select value={bankOverrides[image.fileName] ?? image.bank} onChange={(event) => setBankOverrides((current) => ({ ...current, [image.fileName]: event.target.value as SupportedBank }))}>
                        {BANK_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </aside>
            <div className="review-list">
              {currentBatch.extractedCandidates.map((candidate) => (
                <article key={candidate.id} className={`review-card ${candidate.reviewDisposition === 'ignored' ? 'ignored' : ''}`}>
                  <div className="review-main">
                    <div>
                      <h3>{candidate.rawDescription}</h3>
                      <p>{candidate.normalizedDescription}</p>
                      <small>
                        {candidate.transactionDateISO ?? candidate.transactionDateRaw} · {candidate.transactionType} · {candidate.direction}
                      </small>
                    </div>
                    <div className="amount-col">
                      <strong>{formatCurrency(candidate.amountAbs)}</strong>
                      <span className={`status-badge ${candidate.transactionStatus}`}>{candidate.transactionStatus}</span>
                      <small>OCR {Math.round(candidate.extractionConfidence * 100)}%</small>
                    </div>
                  </div>

                  <div className="review-meta">
                    <label>
                      Category / disposition
                      <select
                        value={candidate.reviewDisposition === 'ignored' ? '__ignored__' : candidate.predictedCategoryId ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (nextValue === '__ignored__') {
                            setCandidateDisposition(candidate, 'ignored', null)
                            return
                          }
                          updateCandidate(candidate.id, {
                            predictedCategoryId: nextValue || null,
                            reviewDisposition: 'categorized',
                            countsTowardTotals: true,
                            ignoredReason: null
                          })
                        }}
                      >
                        <option value="">Uncategorized</option>
                        {activeCategoryList.map((category) => <option key={category.id} value={category.id}>{category.displayName}</option>)}
                        <option value="__ignored__">Ignored</option>
                      </select>
                    </label>
                    <div>
                      <p><strong>Prediction:</strong> {candidate.predictedCategoryId ? categoryMap[candidate.predictedCategoryId]?.displayName ?? candidate.predictedCategoryId : 'None'} ({Math.round(candidate.predictedCategoryConfidence * 100)}%)</p>
                      <p><strong>Reason:</strong> {candidate.predictedCategoryReason}</p>
                      {candidate.ignoredReason ? <p className="ignored-note">{candidate.ignoredReason}</p> : null}
                    </div>
                  </div>

                  <div className="review-actions">
                    <button className="secondary" onClick={() => setCandidateDisposition(candidate, 'ignored', null)}>Ignore</button>
                    <button onClick={() => updateCandidate(candidate.id, {
                      reviewDisposition: 'categorized',
                      countsTowardTotals: true,
                      predictedCategoryId: candidate.predictedCategoryId ?? activeCategoryList[0]?.id ?? null,
                      ignoredReason: null
                    })}>Restore</button>
                    <span>{candidate.countsTowardTotals ? 'Counts toward totals' : 'Excluded from totals'}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Confirmed transaction history</h2>
        {confirmedTransactions.length === 0 ? <p className="empty-state">No confirmed transactions yet.</p> : (
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Date</th>
                <th>Category</th>
                <th>Disposition</th>
                <th>Counts?</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {confirmedTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.rawDescription}</td>
                  <td>{transaction.transactionDateISO ?? 'Unknown'}</td>
                  <td>{transaction.categoryId ? categoryMap[transaction.categoryId]?.displayName ?? transaction.categoryId : 'None'}</td>
                  <td>{transaction.reviewDisposition}</td>
                  <td>{transaction.countsTowardTotals ? 'Yes' : 'No'}</td>
                  <td>{formatCurrency(transaction.amountAbs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
