import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bank, CalendarDots, CaretLeft, CaretRight, ChartBar, Check, ClockCounterClockwise, CreditCard, Plus, Trash } from '@phosphor-icons/react'
import { isoDate, money, shortDate, type Entry, type SheetRow } from './lib/data'
import { scheduledForMonth, type ScheduleItem } from './lib/schedule'
import { additionalExpense, monthSummary, sheetTemplate, sheetTotals, sheetsForPeriod, summarizeSheets, type ReportPeriod } from './lib/paydaySheet'

export function TrackerMark({ size = 28 }: { size?: number }) {
  return <span className="tracker-mark" style={{ width: size, height: size }} aria-hidden="true"><i /><i /></span>
}

const amountText = (value?: number) => value === undefined ? '' : value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parseAmount = (value: string) => value.trim() === '' ? undefined : Math.max(0, Number(value.replace(/,/g, '')) || 0)

export function PaydayPage({ sheet, all, onNew, onSave, onHistory, onTemplate, onSelect }: { sheet?: Entry; all: Entry[]; onNew: () => void; onSave: (sheet: Entry, values: Partial<Entry>) => Promise<void>; onHistory: () => void; onTemplate: () => void; onSelect: (id: string) => void }) {
  const sheets = all.filter((entry) => entry.kind === 'payday' && Array.isArray(entry.sheetRows)).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return <section className="simple-page simple-payday">
    <div className="simple-page-heading"><div><h2>Payday sheet</h2><p>Everything for one payday, in one place.</p></div><button className="simple-outline-button" onClick={onNew}><Plus size={17} /> New</button></div>
    {sheet ? <SheetEditor key={sheet.id} sheet={sheet} sheets={sheets} onSave={onSave} onSelect={onSelect} /> : <div className="simple-empty-card"><CalendarDots size={35} weight="duotone" /><h3>Your first payday sheet</h3><p>Start with the rows from your Excel template. Add income and Tracker will calculate the rest.</p><button className="simple-primary-button" onClick={onNew}>Create payday sheet <ArrowRight size={17} /></button></div>}
    <div className="simple-quick-links"><button onClick={onHistory}><ClockCounterClockwise size={19} /> Payday history <ArrowRight size={16} /></button><button onClick={onTemplate}><ChartBar size={19} /> Edit template <ArrowRight size={16} /></button></div>
  </section>
}

export function MonthSummary({ sheets, initialMonth, onOpen }: { sheets: Entry[]; initialMonth: string; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(initialMonth)
  const totals = monthSummary(sheets, month)
  return <section className="simple-month-summary" aria-label="Monthly payday summary">
    <div className="simple-month-heading"><h3>Month at a glance</h3><input type="month" aria-label="Summary month" value={month} onChange={(event) => setMonth(event.target.value || initialMonth)} /></div>
    <div className="simple-month-metrics"><div><span>Payday expenses</span><strong>{money(totals.rows)}</strong></div><div><span>Remaining money</span><strong>{totals.remaining === undefined ? 'Income needed' : money(totals.remaining)}</strong></div></div>
    <p>{totals.sheets.length} payday{totals.sheets.length === 1 ? '' : 's'} · All rows, including extra expenses{totals.drafts > 0 && ` · ${totals.drafts} awaiting income`}</p>
    {totals.sheets.length > 0 && <details><summary>Paydays & row breakdown</summary><div className="simple-month-table"><div className="simple-month-table-head"><span>Payday</span><span>Expenses</span><span>Remaining</span></div>{totals.sheets.map((sheet) => { const total = sheetTotals(sheet); return <button key={sheet.id} onClick={() => onOpen(sheet.id)}><span>{shortDate(sheet.date)}</span><b>{money(total.rows)}</b><b>{total.remaining === undefined ? '—' : money(total.remaining)}</b></button> })}</div><div className="simple-month-rows">{totals.byName.map(([name, amount]) => <div key={name}><span>{name}</span><strong>{money(amount)}</strong></div>)}</div></details>}
  </section>
}

function SheetEditor({ sheet, sheets, onSave, onSelect }: { sheet: Entry; sheets: Entry[]; onSave: (sheet: Entry, values: Partial<Entry>) => Promise<void>; onSelect: (id: string) => void }) {
  const [income, setIncome] = useState<number | undefined>(sheet.sheetIncome)
  const [rows, setRows] = useState<SheetRow[]>(() => sheet.sheetRows || [])
  const [date, setDate] = useState(sheet.date || isoDate())
  const [saveStatus, setSaveStatus] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready')
  const [adding, setAdding] = useState(false)
  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseError, setExpenseError] = useState('')
  const saveQueue = useRef(Promise.resolve())
  const revision = useRef(0)
  const totals = sheetTotals({ sheetIncome: income, sheetTitheRate: sheet.sheetTitheRate, sheetRows: rows })
  const persist = (values: Partial<Entry>) => {
    const snapshot = { sheetIncome: income, sheetRows: rows, date, ...values }
    const version = ++revision.current
    setSaveStatus('saving')
    saveQueue.current = saveQueue.current.then(async () => {
      try { await onSave(sheet, snapshot); if (version === revision.current) setSaveStatus('saved') }
      catch { if (version === revision.current) setSaveStatus('error') }
    })
  }
  function addExpense(event: React.FormEvent) {
    event.preventDefault()
    try {
      const extra = additionalExpense(expenseName, Number(expenseAmount.replace(/,/g, '')))
      const next = [...rows, extra]
      setRows(next); persist({ sheetRows: next }); setExpenseName(''); setExpenseAmount(''); setExpenseError(''); setAdding(false)
    } catch (error) { setExpenseError(error instanceof Error ? error.message : 'Check the expense details.') }
  }
  const liveSheets = sheets.map((item) => item.id === sheet.id ? { ...item, sheetIncome: income, sheetRows: rows, date } : item)
  return <>
    <MonthSummary sheets={liveSheets} initialMonth={date.slice(0, 7)} onOpen={onSelect} />
    <div className="simple-date-line"><label htmlFor="simple-cycle">Payday date</label><select id="simple-cycle" value={sheet.id} onChange={(event) => onSelect(event.target.value)}>{sheets.map((item) => <option key={item.id} value={item.id}>{shortDate(item.id === sheet.id ? date : item.date)}</option>)}</select></div>
    <div className="simple-summary-card"><div className="simple-summary-row"><label htmlFor="sheet-income">Income</label><input id="sheet-income" inputMode="decimal" defaultValue={amountText(sheet.sheetIncome)} placeholder="Enter income" onChange={(event) => setIncome(parseAmount(event.target.value))} onBlur={() => persist({ sheetIncome: income })} /></div><div className="simple-summary-row"><span>Tithes <small>{totals.rate}%</small></span><strong>{totals.tithes === undefined ? '—' : money(totals.tithes)}</strong></div><div className="simple-summary-row tinted"><span>Money after tithes</span><strong>{totals.moneyAfterTithes === undefined ? '—' : money(totals.moneyAfterTithes)}</strong></div></div>
    <div className="simple-remaining"><span>This payday · remaining</span><strong>{totals.remaining === undefined ? 'Enter income' : money(totals.remaining)}</strong></div>
    <div className="simple-section-title"><h3>Payday expenses</h3><button className="simple-inline-add" onClick={() => setAdding(!adding)} aria-expanded={adding}><Plus size={15} /> Add expense</button></div>
    <div className="simple-row-list">{rows.map((row) => <div className={`simple-sheet-row ${row.additional ? 'is-additional' : ''}`} key={row.id}><label htmlFor={`amount-${row.id}`}>{row.name}{row.additional && <small>This payday only</small>}</label><input id={`amount-${row.id}`} inputMode="decimal" aria-label={`${row.name} amount`} defaultValue={amountText(row.amount)} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: parseAmount(event.target.value) || 0 } : item))} onBlur={() => persist({ sheetRows: rows })} />{row.additional && <button className="simple-remove-expense" aria-label={`Remove ${row.name}`} onClick={() => { const next = rows.filter((item) => item.id !== row.id); setRows(next); persist({ sheetRows: next }) }}><Trash size={16} /></button>}</div>)}</div>
    {adding && <form className="simple-extra-form" onSubmit={addExpense}><div className="simple-extra-heading"><strong>Extra expense</strong><span>For this payday only</span></div><label>Expense name<input autoFocus value={expenseName} onChange={(event) => setExpenseName(event.target.value)} placeholder="e.g. School supplies" required maxLength={80} /></label><label>Amount (₱)<input inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" required /></label><div className="simple-extra-actions"><button type="button" className="simple-outline-button" onClick={() => { setAdding(false); setExpenseError('') }}>Cancel</button><button className="simple-primary-button" type="submit">Add expense</button></div>{expenseError && <p role="alert">{expenseError}</p>}</form>}
    <div className="simple-total"><span>Total expenses</span><strong>{money(totals.rows)}</strong></div>
    <div className="simple-sheet-footer"><label>Sheet date <input type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value) }} onBlur={() => persist({ date })} /></label><small role="status">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? <button onClick={() => persist({})}>Save failed · Retry</button> : saveStatus === 'saved' ? 'Saved on this device' : 'Saves after editing'}</small></div>
  </>
}

export function HistoryPage({ sheets, onOpen, onNew }: { sheets: Entry[]; onOpen: (id: string) => void; onNew: () => void }) {
  const completed = sheets.filter((sheet) => sheet.sheetIncome !== undefined)
  const summary = summarizeSheets(completed)
  return <section className="simple-page"><div className="simple-page-heading"><div><h2>Payday history</h2><p>Each sheet keeps its own numbers.</p></div><button className="simple-outline-button" onClick={onNew}><Plus size={17} /> New</button></div>
    <MonthSummary sheets={sheets} initialMonth={sheets[0]?.date?.slice(0, 7) || isoDate().slice(0, 7)} onOpen={onOpen} /><div className="simple-history-all"><span>All saved paydays · remaining</span><strong>{money(summary.remaining)}</strong></div>
    {sheets.length ? <div className="simple-history-list">{sheets.map((sheet) => { const totals = sheetTotals(sheet); return <button className="simple-history-card" key={sheet.id} onClick={() => onOpen(sheet.id)}><span className="simple-history-top"><strong>{shortDate(sheet.date)}</strong><small>{totals.income === undefined ? 'Draft' : 'Sheet'}</small></span><b>{totals.remaining === undefined ? 'Enter income' : money(totals.remaining)}</b><span className="simple-history-meta">Income {totals.income === undefined ? '—' : money(totals.income)} <span>{sheet.sheetRows?.length || 0} rows</span></span><span className="simple-history-open">Open payday sheet <ArrowRight size={15} /></span></button> })}</div> : <div className="simple-empty-card"><ClockCounterClockwise size={32} /><h3>No payday sheets yet</h3><p>Once you create a sheet, it will appear here.</p><button className="simple-primary-button" onClick={onNew}>Create payday sheet</button></div>}
    <p className="simple-note">New paydays copy your template. Editing a sheet does not change older paydays.</p>
  </section>
}

export function BillsPage({ all, onAdd, onEdit, onPay }: { all: Entry[]; onAdd: () => void; onEdit: (entry: Entry) => void; onPay: (item: ScheduleItem) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const items = scheduledForMonth(all, month)
  const visible = selectedDay ? items.filter((item) => item.day === selectedDay) : items
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const move = (offset: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1)); setSelectedDay(null) }
  return <section className="simple-page"><div className="simple-page-heading"><div><h2>Bills</h2><p>See what is due without opening a sheet.</p></div><button className="simple-outline-button" onClick={onAdd}><Plus size={17} /> Add</button></div>
    <div className="simple-calendar"><div className="simple-calendar-head"><button aria-label="Previous month" onClick={() => move(-1)}><CaretLeft size={17} /></button><strong>{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</strong><button aria-label="Next month" onClick={() => move(1)}><CaretRight size={17} /></button></div><div className="simple-calendar-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <b key={index}>{day}</b>)}{Array.from({ length: first }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const due = items.some((item) => item.day === day); return <button key={day} className={`${due ? 'due' : ''} ${selectedDay === day ? 'selected' : ''}`} aria-label={`${month.toLocaleDateString('en-PH', { month: 'long' })} ${day}${due ? ', bill due' : ''}`} aria-pressed={selectedDay === day} onClick={() => setSelectedDay(selectedDay === day ? null : day)}>{day}</button> })}</div></div>
    <div className="simple-section-title"><h3>{selectedDay ? `Due ${month.toLocaleDateString('en-PH', { month: 'short' })} ${selectedDay}` : 'Due this month'}</h3>{selectedDay && <button onClick={() => setSelectedDay(null)}>See all</button>}</div>
    {visible.length ? <div className="simple-bill-list">{visible.map((item) => { const paid = all.some((tx) => tx.kind === 'transaction' && tx.accountId === item.entry.id && tx.date?.slice(0, 7) === monthKey && tx.transactionType === (item.entry.kind === 'bill' ? 'expense' : `${item.entry.kind}_payment`)); const Icon = item.entry.kind === 'loan' ? Bank : item.entry.kind === 'card' ? CreditCard : CalendarDots; return <div className="simple-bill-row" key={item.entry.id}><span className="simple-bill-icon"><Icon size={21} /></span><div><strong>{item.entry.name}</strong><small>{month.toLocaleDateString('en-PH', { month: 'short' })} {item.day}{paid ? ' · Paid' : ''}</small></div><span className="simple-bill-value"><b>{money(item.amount)}</b><button onClick={() => paid ? onEdit(item.entry) : onPay(item)}>{paid ? 'Edit bill' : 'Record payment'}</button></span></div> })}</div> : <div className="simple-empty-card compact"><CalendarDots size={29} /><h3>{selectedDay ? 'Nothing due that day' : 'No bills this month'}</h3><p>Bill and account due dates will appear here.</p></div>}
    <p className="simple-note">Bills are reminders. A payment only affects actual spending when you record it.</p>
  </section>
}

export function ReportsPage({ sheets }: { sheets: Entry[] }) {
  const complete = sheets.filter((sheet) => sheet.sheetIncome !== undefined && sheet.date)
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [choice, setChoice] = useState('')
  const options = useMemo(() => period === 'payday' ? complete.map((sheet) => ({ key: sheet.id, label: shortDate(sheet.date) })) : [...new Set(complete.map((sheet) => sheet.date!.slice(0, period === 'month' ? 7 : 4)))].sort().reverse().map((key) => ({ key, label: period === 'month' ? new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) : key })), [complete, period])
  const activeChoice = options.some((option) => option.key === choice) ? choice : options[0]?.key || ''
  const included = sheetsForPeriod(complete, period, activeChoice)
  const totals = summarizeSheets(included)
  return <section className="simple-page"><div className="simple-page-heading"><div><h2>Breakdown</h2><p>Choose the time period you want to see.</p></div></div>
    <div className="simple-period-tabs" role="group" aria-label="Report period">{([['payday', 'Payday'], ['month', 'Monthly'], ['year', 'Yearly']] as const).map(([id, label]) => <button key={id} className={period === id ? 'active' : ''} aria-pressed={period === id} onClick={() => { setPeriod(id); setChoice('') }}>{label}</button>)}</div>
    <label className="simple-period-choice">Choose {period === 'month' ? 'month' : period === 'year' ? 'year' : 'payday'}<select value={activeChoice} onChange={(event) => setChoice(event.target.value)} disabled={!options.length}>{options.length ? options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>) : <option value="">No saved sheets</option>}</select></label>
    {included.length ? <><p className="simple-report-caption">{options.find((option) => option.key === activeChoice)?.label} · {included.length} payday{included.length === 1 ? '' : 's'}</p><div className="simple-report-metrics"><div><span>Income</span><strong>{money(totals.income)}</strong></div><div><span>Tithes</span><strong>{money(totals.tithes)}</strong></div></div><div className="simple-report-total"><span>Payday expenses</span><strong>{money(totals.rows)}</strong><div><span>Remaining money</span><b>{money(totals.remaining)}</b></div></div><div className="simple-section-title"><h3>Expenses by row</h3><span>Share of total</span></div><div className="simple-report-bars">{totals.byName.map(([name, amount]) => <div key={name}><span>{name}<strong>{money(amount)}</strong></span><i><b style={{ width: `${totals.rows ? Math.max(2, amount / totals.rows * 100) : 0}%` }} /></i></div>)}</div><p className="simple-note">This view totals payday allocations. Paid transactions stay in Detailed expenses under More.</p></> : <div className="simple-empty-card"><ChartBar size={34} /><h3>No sheets in this period</h3><p>Create a payday sheet with income to see its breakdown.</p></div>}
  </section>
}

export function TemplatePage({ all, onSave, onBack }: { all: Entry[]; onSave: (values: Partial<Entry>, existing?: Entry) => Promise<void>; onBack: () => void }) {
  const current = sheetTemplate(all)
  const [rateText, setRateText] = useState(String(current.rate))
  const [rows, setRows] = useState<SheetRow[]>(() => current.rows.map((row) => ({ ...row })))
  const [rowTexts, setRowTexts] = useState<Record<string, string>>(() => Object.fromEntries(current.rows.map((row) => [row.id, amountText(row.amount)])))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  async function save() {
    const clean = rows.map((row) => ({ ...row, name: row.name.trim(), amount: Math.max(0, row.amount || 0) })).filter((row) => row.name)
    setSaving(true)
    setSaveError(false)
    try { await onSave({ sheetTemplate: true, sheetTitheRate: Math.max(0, Math.min(100, Number(rateText) || 0)), sheetRows: clean }, current.entry) }
    catch { setSaveError(true) }
    finally { setSaving(false) }
  }
  return <section className="simple-page"><div className="simple-page-heading"><div><button className="simple-back" onClick={onBack}><ArrowLeft size={16} /> More</button><h2>Your template</h2><p>Defaults for a new payday sheet.</p></div></div><p className="simple-template-intro">Start with the rows from your Excel file. Change a name or amount here, then save the template.</p><label className="simple-rate"><span><strong>Tithes percentage</strong><small>Calculated from income</small></span><span><input type="number" min="0" max="100" step="0.1" value={rateText} onChange={(event) => setRateText(event.target.value)} aria-label="Tithes percentage" />%</span></label><div className="simple-section-title"><h3>Default rows</h3><span>Copied into new sheets</span></div><div className="simple-template-rows">{rows.map((row, index) => <div key={row.id}><input aria-label={`Row ${index + 1} name`} value={row.name} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /><input inputMode="decimal" aria-label={`${row.name} default amount`} value={rowTexts[row.id] ?? ''} onChange={(event) => { const text = event.target.value; setRowTexts((current) => ({ ...current, [row.id]: text })); setRows((current) => current.map((item, i) => i === index ? { ...item, amount: parseAmount(text) || 0 } : item)) }} onBlur={() => setRowTexts((current) => ({ ...current, [row.id]: amountText(row.amount) }))} /><button aria-label={`Remove ${row.name}`} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}><Trash size={16} /></button></div>)}</div><button className="simple-add-row" onClick={() => { const id = crypto.randomUUID(); setRows((current) => [...current, { id, name: '', amount: 0 }]); setRowTexts((current) => ({ ...current, [id]: '' })) }}><Plus size={16} /> Add another row</button><p className="simple-note">Template edits affect future paydays. Earlier sheets keep their own numbers.</p><button className="simple-primary-button simple-save-template" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : <><Check size={17} /> Save template</>}</button>{saveError && <p className="simple-note" role="alert">Could not save the template. Try again.</p>}{!current.entry && <p className="simple-note">These seven starting rows came from your Excel example. Save to customize them.</p>}</section>
}
