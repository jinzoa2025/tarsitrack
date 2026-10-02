import { useState, type FormEvent } from 'react'
import { Check, Trash, X } from '@phosphor-icons/react'
import { isoDate, shortDate, type Entry, type Kind, type TransactionType } from './lib/data'
import { txLabels } from './lib/labels'

export interface FormConfig { kind: Kind; entry?: Entry; preset?: Partial<Entry> }

export function EntryForm({ config, all, busy, onClose, onSave, onDelete }: {
  config: FormConfig; all: Entry[]; busy: boolean; onClose: () => void
  onSave: (values: Partial<Entry>) => void; onDelete?: () => void
}) {
  const initial = { date: config.kind === 'transaction' ? isoDate() : undefined, transactionType: config.kind === 'transaction' ? 'expense' : undefined, remindDays: config.kind === 'bill' ? [7, 3, 1, 0] : undefined, ...config.preset, ...config.entry }
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, value == null ? '' : String(value)])))
  const [error, setError] = useState('')
  const kind = config.kind
  const change = (key: string, value: string) => setValues((current) => key === 'transactionType' ? { ...current, transactionType: value, accountId: '' } : { ...current, [key]: value })
  const field = (label: string, key: string, type = 'text', options?: { value: string; label: string }[]) => <label className="field" key={key}><span>{label}</span>{options ? <select value={values[key] || ''} onChange={(event) => change(key, event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={values[key] || ''} onChange={(event) => change(key, event.target.value)} />}</label>
  const transactionType = (values.transactionType || 'expense') as TransactionType
  const accounts = all.filter((item) => transactionType === 'loan_payment' ? item.kind === 'loan' : transactionType === 'card_payment' ? item.kind === 'card' : transactionType === 'goal_deposit' ? item.kind === 'goal' : transactionType === 'wish_contribution' ? item.kind === 'wish' : transactionType === 'expense' ? item.kind === 'card' || item.kind === 'bill' : false)
  const requiresAccount = ['loan_payment', 'card_payment', 'goal_deposit', 'wish_contribution'].includes(transactionType)
  const title = config.entry ? `Edit ${kind === 'transaction' ? 'entry' : kind}` : `Add ${kind === 'transaction' ? 'entry' : kind}`
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!values.name?.trim()) { setError('Add a name.'); return }
    if (kind === 'transaction' && (!values.amount || Number(values.amount) <= 0)) { setError('Enter an amount greater than zero.'); return }
    if (requiresAccount && kind === 'transaction' && !values.accountId) { setError('Choose the linked account or goal.'); return }
    if (kind === 'payday' && !values.date) { setError('Choose a payday date.'); return }
    if (kind === 'plan' && !values.paydayId) { setError('Choose a payday cycle.'); return }
    if (kind === 'plan' && !values.category) { setError('Choose a category.'); return }
    const result: Partial<Entry> = { name: values.name.trim(), notes: values.notes || undefined }
    for (const key of ['amount', 'target', 'saved', 'budget', 'limit', 'rate', 'dueDay', 'ruleValue']) if (values[key] !== undefined && values[key] !== '') Object.assign(result, { [key]: Number(values[key]) })
    for (const key of ['date', 'paydayId', 'accountId', 'category', 'transactionType', 'priority', 'targetDate', 'dueDate', 'recurrence', 'ruleMode']) if (key in values) Object.assign(result, { [key]: values[key] || undefined })
    if (kind === 'transaction' && !result.transactionType) result.transactionType = 'expense'
    if (kind === 'bill' && !result.recurrence) result.recurrence = 'monthly'
    if (kind === 'bill') result.remindDays = (values.remindDays || '').split(',').filter(Boolean).map(Number)
    if (kind === 'rule' && !result.ruleMode) result.ruleMode = 'income_percent'
    onSave(result)
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="form-sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-head"><div><p className="eyebrow">TARSITRACK</p><h2>{title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div><form onSubmit={submit}><div className="fields">
    {kind === 'transaction' && <div className="type-choice">{(['expense', 'income', 'transfer'] as TransactionType[]).map((type) => <button type="button" key={type} className={transactionType === type ? 'active' : ''} onClick={() => change('transactionType', type)}>{txLabels[type]}</button>)}</div>}
    {kind === 'transaction' && field('Entry type', 'transactionType', 'text', Object.entries(txLabels).filter(([value]) => value !== 'adjustment').map(([value, label]) => ({ value, label })))}
    {field(kind === 'payday' ? 'Payday name' : kind === 'transaction' ? 'Description' : 'Name', 'name')}
    {['transaction', 'loan', 'card', 'bill'].includes(kind) && field(kind === 'loan' || kind === 'card' ? 'Current balance (₱)' : 'Amount (₱)', 'amount', 'number')}
    {kind === 'plan' && field('Budgeted amount (₱)', 'budget', 'number')}
    {['wish', 'goal'].includes(kind) && <>{field('Target amount (₱)', 'target', 'number')}{field('Already saved (₱)', 'saved', 'number')}{field('Target date', 'targetDate', 'date')}</>}
    {kind === 'wish' && field('Priority', 'priority', 'text', ['Need', 'Want', 'Someday'].map((value) => ({ value, label: value })))}
    {kind === 'loan' && <>{field('Original loan amount (₱)', 'target', 'number')}{field('Monthly payment (₱)', 'budget', 'number')}{field('Interest rate (% p.a.)', 'rate', 'number')}{field('Due day of month', 'dueDay', 'number')}</>}
    {kind === 'card' && <>{field('Credit limit (₱)', 'limit', 'number')}{field('Planned payment (₱)', 'budget', 'number')}{field('Due day of month', 'dueDay', 'number')}</>}
    {kind === 'bill' && <>{field('Schedule', 'recurrence', 'text', ['monthly', 'once'].map((value) => ({ value, label: value })))}{values.recurrence === 'once' ? field('Due date', 'dueDate', 'date') : field('Due day of month', 'dueDay', 'number')}</>}
    {kind === 'bill' && <div className="reminder-options"><strong>In-app reminders</strong><div>{[7, 3, 1, 0].map((days) => { const chosen = (values.remindDays || '').split(',').includes(String(days)); return <label key={days}><input type="checkbox" checked={chosen} onChange={() => change('remindDays', [7, 3, 1, 0].filter((item) => item === days ? !chosen : (values.remindDays || '').split(',').includes(String(item))).join(','))} />{days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} before`}</label> })}</div></div>}
    {kind === 'rule' && <>{field('Rule type', 'ruleMode', 'text', [{ value: 'income_percent', label: '% of income' }, { value: 'remaining_percent', label: '% of remaining' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'manual', label: 'Manual' }])}{values.ruleMode !== 'manual' && field(values.ruleMode?.includes('percent') || !values.ruleMode ? 'Percentage (%)' : 'Fixed amount (₱)', 'ruleValue', 'number')}</>}
    {kind === 'payday' && field('Payday date', 'date', 'date')}
    {kind === 'transaction' && <>{field('Date', 'date', 'date')}{field('Payday cycle', 'paydayId', 'text', all.filter((item) => item.kind === 'payday').map((item) => ({ value: item.id, label: shortDate(item.date) })))}{(accounts.length > 0 || requiresAccount) && field('Linked account or bill', 'accountId', 'text', accounts.map((item) => ({ value: item.id, label: item.name })))}</>}
    {kind === 'plan' && field('Payday cycle', 'paydayId', 'text', all.filter((item) => item.kind === 'payday').map((item) => ({ value: item.id, label: shortDate(item.date) })))}
    {['transaction', 'plan', 'bill'].includes(kind) && <label className="field"><span>Category</span><input list="categories" value={values.category || ''} onChange={(event) => change('category', event.target.value)} /><datalist id="categories">{Array.from(new Set(['Food', 'Family', 'Utilities', 'Transport', 'Health', 'Shopping', 'Loans', 'Cards', ...all.filter((item) => item.kind === 'category').map((item) => item.name)])).map((item) => <option key={item} value={item} />)}</datalist></label>}
    {kind === 'transaction' && <div className="quick-categories"><strong>Quick Categories</strong><div>{['Tithes', 'Food', 'Bills', 'Transport', 'Gas', 'Shopping', 'Miscellaneous'].map((category) => <button type="button" key={category} className={values.category === category ? 'active' : ''} onClick={() => change('category', category)}>{category}</button>)}</div></div>}
    {kind !== 'category' && <label className="field"><span>Notes (optional)</span><textarea rows={3} value={values.notes || ''} onChange={(event) => change('notes', event.target.value)} /></label>}
  </div>{error && <p className="form-error">{error}</p>}<div className="form-actions">{onDelete && <button type="button" className="delete-button" onClick={onDelete}><Trash size={17} /> Delete</button>}<button type="button" className="subtle-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={busy}><Check size={18} /> Save</button></div></form></div></div>
}
