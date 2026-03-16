import { useMemo, useState } from 'react'

const CATEGORY_CLASSES = [
  'Fixed Costs',
  'Saving and Investments',
  'Credit',
  'Discretionary Spending'
]

const CLASS_LABELS = {
  'Fixed Costs': 'Fixed Costs',
  'Saving and Investments': 'Savings & Investments',
  Credit: 'Credit',
  'Discretionary Spending': 'Discretionary Spending'
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(amount) || 0)
}

function percentValue(numerator, denominator) {
  if (!denominator) return 0
  return (numerator / denominator) * 100
}

function percentLabel(value) {
  return `${value.toFixed(1)}%`
}

export default function App() {
  const [plannedIncome, setPlannedIncome] = useState('')
  const [actualIncome, setActualIncome] = useState('')

  const [categories, setCategories] = useState([
    { id: crypto.randomUUID(), name: 'Rent', classification: 'Fixed Costs' },
    { id: crypto.randomUUID(), name: 'Emergency Fund', classification: 'Saving and Investments' }
  ])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryClass, setNewCategoryClass] = useState(CATEGORY_CLASSES[0])

  const [transactions, setTransactions] = useState([])
  const [transactionForm, setTransactionForm] = useState({
    description: '',
    amount: '',
    planned: '',
    categoryId: ''
  })

  const [receiptImage, setReceiptImage] = useState(null)

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories]
  )

  const totals = useMemo(() => {
    const plannedSpending = transactions.reduce((sum, t) => sum + (Number(t.planned) || 0), 0)
    const actualSpending = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

    const perClass = CATEGORY_CLASSES.map((classification) => {
      const classTransactions = transactions.filter(
        (transaction) => categoryMap[transaction.categoryId]?.classification === classification
      )

      const planned = classTransactions.reduce((sum, t) => sum + (Number(t.planned) || 0), 0)
      const actual = classTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

      return {
        classification,
        plannedPercent: percentValue(planned, Number(plannedIncome)),
        actualPercent: percentValue(actual, Number(actualIncome))
      }
    })

    const maxPercent = Math.max(60, ...perClass.map((item) => Math.max(item.plannedPercent, item.actualPercent)))

    return { plannedSpending, actualSpending, perClass, maxPercent }
  }, [transactions, categoryMap, plannedIncome, actualIncome])

  const addCategory = (event) => {
    event.preventDefault()
    if (!newCategoryName.trim()) return
    setCategories((current) => [
      ...current,
      { id: crypto.randomUUID(), name: newCategoryName.trim(), classification: newCategoryClass }
    ])
    setNewCategoryName('')
    setNewCategoryClass(CATEGORY_CLASSES[0])
  }

  const addTransaction = (event) => {
    event.preventDefault()
    if (!transactionForm.description.trim() || !transactionForm.amount || !transactionForm.categoryId) {
      return
    }

    setTransactions((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: transactionForm.description.trim(),
        amount: Number(transactionForm.amount),
        planned: Number(transactionForm.planned) || 0,
        categoryId: transactionForm.categoryId
      }
    ])

    setTransactionForm({ description: '', amount: '', planned: '', categoryId: '' })
  }

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setReceiptImage(URL.createObjectURL(file))
  }

  return (
    <main className="container">
      <h1>Budgeting App</h1>
      <p className="subtitle">
        Plan spending, upload a transaction screenshot, and categorize each transaction into one of the
        four budget classes.
      </p>

      <section className="panel dashboard-panel">
        <h2 className="chart-title">Spending as A percentage of Income</h2>
        <div className="chart-legend">
          <span><i className="dot planned" /> Planned</span>
          <span><i className="dot actual" /> Actual</span>
        </div>

        <div className="chart-grid">
          {totals.perClass.map((item) => (
            <div key={item.classification} className="chart-group">
              <div className="bar-pair">
                <div
                  className="bar planned"
                  style={{ height: `${(item.plannedPercent / totals.maxPercent) * 100}%` }}
                >
                  <span>{Math.round(item.plannedPercent)}</span>
                </div>
                <div
                  className="bar actual"
                  style={{ height: `${(item.actualPercent / totals.maxPercent) * 100}%` }}
                >
                  <span>{Math.round(item.actualPercent)}</span>
                </div>
              </div>
              <p className="group-label">{CLASS_LABELS[item.classification]}</p>
            </div>
          ))}
        </div>
        <p className="axis-label">Spending Classes</p>
        <p className="y-axis-label">Spending rate (% of income)</p>
      </section>

      <section className="panel grid two-col">
        <div>
          <h2>Income Inputs</h2>
          <label>
            Planned Income
            <input
              type="number"
              min="0"
              value={plannedIncome}
              onChange={(e) => setPlannedIncome(e.target.value)}
              placeholder="e.g. 5000"
            />
          </label>
          <label>
            Actual Income
            <input
              type="number"
              min="0"
              value={actualIncome}
              onChange={(e) => setActualIncome(e.target.value)}
              placeholder="e.g. 4900"
            />
          </label>
        </div>

        <div>
          <h2>Totals Overview</h2>
          <div className="kpi-card">
            <h3>Planned Spending</h3>
            <p>{formatCurrency(totals.plannedSpending)}</p>
            <small>{percentLabel(percentValue(totals.plannedSpending, Number(plannedIncome)))} of planned income</small>
          </div>
          <div className="kpi-card">
            <h3>Actual Spending</h3>
            <p>{formatCurrency(totals.actualSpending)}</p>
            <small>{percentLabel(percentValue(totals.actualSpending, Number(actualIncome)))} of actual income</small>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Add Categories</h2>
        <form className="grid form-row" onSubmit={addCategory}>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
          />
          <select value={newCategoryClass} onChange={(e) => setNewCategoryClass(e.target.value)}>
            {CATEGORY_CLASSES.map((categoryClass) => (
              <option key={categoryClass} value={categoryClass}>
                {categoryClass}
              </option>
            ))}
          </select>
          <button type="submit">Add Category</button>
        </form>

        <div className="category-list">
          {categories.map((category) => (
            <div key={category.id} className="pill">
              <strong>{category.name}</strong>
              <span>{category.classification}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel grid two-col">
        <div>
          <h2>Upload Transaction Screenshot</h2>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {receiptImage ? (
            <img className="preview" src={receiptImage} alt="Uploaded transactions screenshot" />
          ) : (
            <p className="hint">Upload a screenshot of your transactions so you can categorize them below.</p>
          )}
        </div>

        <div>
          <h2>Categorize Transactions</h2>
          <form className="grid" onSubmit={addTransaction}>
            <input
              type="text"
              placeholder="Description"
              value={transactionForm.description}
              onChange={(e) =>
                setTransactionForm((current) => ({ ...current, description: e.target.value }))
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Actual amount"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm((current) => ({ ...current, amount: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Planned amount"
              value={transactionForm.planned}
              onChange={(e) => setTransactionForm((current) => ({ ...current, planned: e.target.value }))}
            />
            <select
              value={transactionForm.categoryId}
              onChange={(e) =>
                setTransactionForm((current) => ({ ...current, categoryId: e.target.value }))
              }
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.classification})
                </option>
              ))}
            </select>
            <button type="submit">Add Transaction</button>
          </form>
        </div>
      </section>

      <section className="panel">
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <p className="hint">No transactions added yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Class</th>
                <th>Planned</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const category = categoryMap[transaction.categoryId]
                return (
                  <tr key={transaction.id}>
                    <td>{transaction.description}</td>
                    <td>{category?.name ?? 'Unknown'}</td>
                    <td>{category?.classification ?? 'Unknown'}</td>
                    <td>{formatCurrency(transaction.planned)}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
