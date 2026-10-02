import { useState } from 'react'
import { Bank, Bell, CalendarDots, CaretLeft, CaretRight, CreditCard, PencilSimple } from '@phosphor-icons/react'
import { money, type Entry, type Kind } from './lib/data'
import { scheduledForMonth, type ScheduleItem, type ScheduleTone } from './lib/schedule'
import { BillSymbol, Empty, SectionHead } from './ui'

type OpenForm = (kind: Kind, entry?: Entry, preset?: Partial<Entry>) => void
const toneNames: Record<ScheduleTone, string> = { utility: 'Utilities', card: 'Cards', loan: 'Loans', other: 'Other' }

function ScheduleIcon({ item }: { item: ScheduleItem }) {
  const { entry, tone } = item
  if (entry.kind === 'bill') return <BillSymbol name={entry.name} />
  const Icon = entry.kind === 'card' ? CreditCard : Bank
  return <span className={`schedule-icon ${tone}`}><Icon size={24} weight="fill" /></span>
}

export default function BillsSchedule({ all, open, cycle, onToggleReminder }: { all: Entry[]; open: OpenForm; cycle?: Entry; onToggleReminder: (item: Entry, enabled: boolean) => void }) {
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const year = month.getFullYear()
  const index = month.getMonth()
  const firstWeekday = new Date(year, index, 1).getDay()
  const items = scheduledForMonth(all, month)
  const visibleItems = selectedDay ? items.filter((item) => item.day === selectedDay) : items
  const tones = (['utility', 'card', 'loan', 'other'] as ScheduleTone[]).filter((tone) => items.some((item) => item.tone === tone))
  const monthLabel = month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const changeMonth = (offset: number) => { setMonth(new Date(year, index + offset, 1)); setSelectedDay(null) }
  const cells = Array.from({ length: 42 }, (_, cellIndex) => new Date(year, index, cellIndex - firstWeekday + 1))

  function record(item: ScheduleItem) {
    const { entry, amount } = item
    open('transaction', undefined, {
      name: entry.kind === 'bill' ? entry.name : `${entry.name} payment`,
      amount,
      category: entry.kind === 'loan' ? 'Loans' : entry.kind === 'card' ? 'Cards' : entry.category,
      transactionType: entry.kind === 'loan' ? 'loan_payment' : entry.kind === 'card' ? 'card_payment' : 'expense',
      paydayId: cycle?.id,
      accountId: entry.id,
    })
  }

  return <div className="planning-grid bills-layout schedule-layout">
    <section className="panel schedule-calendar-panel"><SectionHead title="Bills calendar" action="Add bill" onAction={() => open('bill')} />
      <div className="bill-calendar reference-calendar">
        <div className="calendar-head"><button aria-label="Previous month" onClick={() => changeMonth(-1)}><CaretLeft size={20} weight="bold" /></button><strong>{monthLabel}</strong><button aria-label="Next month" onClick={() => changeMonth(1)}><CaretRight size={20} weight="bold" /></button></div>
        <div className="calendar-grid reference-calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => <span className="weekday" key={name}>{name}</span>)}
          {cells.map((date) => { const isCurrent = date.getMonth() === index; const dateItems = isCurrent ? items.filter((item) => item.day === date.getDate()) : []; const isToday = date.toDateString() === today.toDateString(); const selected = isCurrent && selectedDay === date.getDate(); return <button key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`} className={`calendar-date ${isCurrent ? '' : 'outside'} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''} ${dateItems.length ? 'has-due' : ''}`} aria-label={`${date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}${dateItems.length ? `, ${dateItems.map((item) => item.entry.name).join(', ')} due` : ''}`} aria-pressed={selected} onClick={() => { if (!isCurrent) { setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedDay(date.getDate()) } else setSelectedDay(selected ? null : date.getDate()) }}><span className="calendar-number">{date.getDate()}</span>{dateItems.length > 0 && <span className="calendar-dots">{dateItems.slice(0, 3).map((item) => <i key={item.entry.id} className={item.tone} />)}</span>}</button> })}
        </div>
        <div className="calendar-legend">{tones.map((tone) => <span key={tone}><i className={tone} />{toneNames[tone]}</span>)}{!tones.length && <span><CalendarDots size={14} /> No dates scheduled</span>}</div>
      </div>
    </section>
    <section className="panel schedule-list-panel"><div className="section-head"><h2>{selectedDay ? `Due ${month.toLocaleDateString('en-PH', { month: 'short' })} ${selectedDay}` : 'Due this month'}</h2>{selectedDay && <button className="text-button" onClick={() => setSelectedDay(null)}>See all</button>}</div>
      {visibleItems.length ? <div className="schedule-list">{visibleItems.map((item) => { const { entry, amount, day } = item; const reminderOn = entry.kind === 'bill' && (entry.remindDays === undefined || entry.remindDays.length > 0); const paid = all.some((tx) => tx.kind === 'transaction' && tx.accountId === entry.id && tx.date?.slice(0, 7) === `${year}-${String(index + 1).padStart(2, '0')}` && (entry.kind === 'bill' ? tx.transactionType === 'expense' : tx.transactionType === `${entry.kind}_payment`)); return <div className="schedule-row" key={entry.id}><ScheduleIcon item={item} /><div className="schedule-copy"><strong>{entry.name}</strong><small>{month.toLocaleDateString('en-PH', { month: 'short' })} {day}{paid ? ' · Paid this month' : ''}</small></div><strong className="schedule-amount">{amount ? money(amount) : 'Amount not set'}</strong>{entry.kind === 'bill' ? <button className={`reminder-switch ${reminderOn ? 'on' : ''}`} role="switch" aria-label={`${entry.name} reminders`} aria-checked={reminderOn} onClick={() => onToggleReminder(entry, !reminderOn)}><span /></button> : <button className="schedule-pay" onClick={() => record(item)} aria-label={`Record ${entry.name} payment`}>Pay</button>}<button className="schedule-edit" aria-label={`Edit ${entry.name}`} onClick={() => open(entry.kind, entry)}><PencilSimple size={15} /></button></div> })}</div> : <Empty title={selectedDay ? 'Nothing due on this day' : 'Nothing due this month'} body="Bills and account payment dates will appear here." />}
      <div className="schedule-footer"><Bell size={22} weight="fill" /><span>Never miss a due date.<br />A more peaceful tomorrow. <span aria-hidden="true">♡</span></span></div>
    </section>
  </div>
}
