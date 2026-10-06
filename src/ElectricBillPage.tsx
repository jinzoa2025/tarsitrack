import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Lightning } from '@phosphor-icons/react'
import { isoDate, money, type ElectricBillInput, type Entry } from './lib/data'
import { calculateElectricBill, isElectricBillEntry } from './lib/electricBill'

type Draft = Record<'totalBill' | 'mainPrevious' | 'mainLatest' | 'subPrevious' | 'subLatest', string>
const fields: (keyof Draft)[] = ['totalBill', 'mainPrevious', 'mainLatest', 'subPrevious', 'subLatest']
const emptyDraft: Draft = { totalBill: '', mainPrevious: '', mainLatest: '', subPrevious: '', subLatest: '' }
const kwh = (value: number) => `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(value)} kWh`
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

function initialDraft(saved?: Entry & { electricBill: ElectricBillInput }, previous?: Entry & { electricBill: ElectricBillInput }): Draft {
  if (saved) return Object.fromEntries(fields.map((key) => [key, String(saved.electricBill[key])])) as Draft
  return { ...emptyDraft, mainPrevious: previous ? String(previous.electricBill.mainLatest) : '', subPrevious: previous ? String(previous.electricBill.subLatest) : '' }
}

function Editor({ month, saved, previous, onSave }: { month: string; saved?: Entry & { electricBill: ElectricBillInput }; previous?: Entry & { electricBill: ElectricBillInput }; onSave: (input: ElectricBillInput, existing?: Entry) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(saved, previous))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const parsed = fields.every((key) => draft[key].trim() !== '' && /^\d+(?:\.\d+)?$/.test(draft[key].trim()))
    ? { month, ...Object.fromEntries(fields.map((key) => [key, Number(draft[key])])) } as ElectricBillInput
    : undefined
  const result = parsed ? calculateElectricBill(parsed) : undefined
  const ready = result && !('error' in result) && parsed && /^\d+(?:\.\d{1,2})?$/.test(draft.totalBill)
  function change(key: keyof Draft, value: string) { setDraft((current) => ({ ...current, [key]: value })); setStatus('') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) { setStatus(result && 'error' in result ? result.error || 'Check the meter readings.' : 'Complete all fields. Enter the bill to two decimal places.'); return }
    setSaving(true); setStatus('')
    try { await onSave(parsed, saved); setStatus('Saved on this device') }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save this month') }
    finally { setSaving(false) }
  }
  const field = (key: keyof Draft, label: string) => <label className="electric-field" htmlFor={`electric-${key}`}><span>{label}</span><input id={`electric-${key}`} type="number" inputMode="decimal" min="0" step={key === 'totalBill' ? '0.01' : 'any'} value={draft[key]} onChange={(event) => change(key, event.target.value)} placeholder={key === 'totalBill' ? '0.00' : '0'} required /></label>
  return <form className="electric-layout" onSubmit={(event) => void submit(event)}>
    <div className="electric-inputs">
      <section className="electric-card"><h3>Total electric bill</h3><p>Enter the full amount charged for both houses.</p>{field('totalBill', 'Total bill (₱)')}</section>
      <section className="electric-card"><div className="electric-card-heading"><span className="electric-icon"><Lightning size={19} /></span><div><h3>Main meter · both houses</h3><p>Enter the physical meter readings from the main meter.</p></div></div><div className="electric-readings">{field('mainPrevious', 'Previous reading')}{field('mainLatest', 'Latest reading')}</div><div className="electric-usage"><span>Total usage</span><strong>{result && !('error' in result) ? kwh(result.totalKwh) : '—'}</strong></div></section>
      <section className="electric-card"><div className="electric-card-heading"><span className="electric-icon"><Lightning size={19} /></span><div><h3>Sub-meter · other house</h3><p>Enter the other house’s sub-meter readings.</p></div></div><div className="electric-readings">{field('subPrevious', 'Previous reading')}{field('subLatest', 'Latest reading')}</div><div className="electric-usage"><span>Other house usage</span><strong>{result && !('error' in result) ? kwh(result.otherKwh) : '—'}</strong></div></section>
      <section className="electric-ours"><span>Our house · calculated automatically</span><strong>{result && !('error' in result) ? kwh(result.ourKwh) : '—'}</strong><small>Main meter total minus the other house’s sub-meter usage</small></section>
    </div>
    <section className="electric-card electric-results"><h3>Bill split</h3>{result && !('error' in result) ? <><div><span>Rate per kWh</span><b>{money(result.rate)} / kWh</b></div><div><span>Other house</span><b>{money(result.otherBill)}</b></div><div className="electric-our-bill"><span>Our house bill</span><strong>{money(result.ourBill)}</strong></div><div><span>Full electric bill</span><b>{money(parsed!.totalBill)}</b></div></> : <p>Enter the bill and both meter readings to see each house’s share.</p>}{result && 'error' in result && <p className="electric-error" role="alert">{result.error}</p>}<button className="simple-primary-button electric-save" type="submit" disabled={saving}>{saving ? 'Saving…' : saved ? 'Update month' : 'Save month'}</button>{status && <p className={status.startsWith('Saved') ? 'electric-status' : 'electric-error'} role="status">{status.startsWith('Saved') && <Check size={15} />}{status}</p>}</section>
  </form>
}

export default function ElectricBillPage({ all, onBack, onSave }: { all: Entry[]; onBack: () => void; onSave: (input: ElectricBillInput, existing?: Entry) => Promise<void> }) {
  const [month, setMonth] = useState(() => isoDate().slice(0, 7))
  const records = all.filter(isElectricBillEntry).sort((a, b) => b.electricBill.month.localeCompare(a.electricBill.month))
  const saved = records.find((record) => record.electricBill.month === month)
  const previous = records.find((record) => record.electricBill.month < month)
  return <section className="simple-page electric-page"><button className="electric-back" onClick={onBack}><ArrowLeft size={16} /> Bills</button><div className="simple-page-heading"><div><h2>Electric bill calculator</h2><p>Main meter for both houses; sub-meter for the other house.</p></div></div><label className="electric-month">Bill month<input type="month" value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value) }} /></label><Editor key={`${month}:${saved?.id || 'new'}`} month={month} saved={saved} previous={previous} onSave={onSave} /><div className="simple-section-title"><h3>Saved months</h3><span>Our house bill</span></div>{records.length ? <div className="electric-history">{records.map((record) => { const amount = calculateElectricBill(record.electricBill); return <button key={record.id} className={record.electricBill.month === month ? 'selected' : ''} onClick={() => setMonth(record.electricBill.month)}><span><strong>{monthLabel(record.electricBill.month)}</strong><small>{'error' in amount ? 'Review readings' : `${kwh(amount.ourKwh)} · our house`}</small></span><b>{'error' in amount ? '—' : money(amount.ourBill)}</b></button> })}</div> : <p className="simple-note">Saved months will appear here with our house’s share as the headline amount.</p>}<p className="simple-note">Saving a split keeps the bill and readings for reference. It does not record a paid expense; use Record payment when you pay it.</p></section>
}
