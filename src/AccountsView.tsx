import { useState } from 'react'
import { ArrowLeft, CalendarDots, CaretRight, Coins, CreditCard, Plus, ShoppingCart, Wallet } from '@phosphor-icons/react'
import { accountBalance, cycleTotals, goalSaved, money, shortDate, type Entry, type Kind } from './lib/data'
import { Empty, IconBadge, Metric, Progress, Row, SectionHead, SproutMark } from './ui'

type OpenForm = (kind: Kind, entry?: Entry, preset?: Partial<Entry>) => void

function nextDueDate(today: Date, day?: number) {
  if (!day) return null
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), Math.min(day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()))
  return thisMonth < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    ? new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()))
    : thisMonth
}

export default function AccountsView({ all, open, cycle, onWishlist }: { all: Entry[]; open: OpenForm; cycle?: Entry; onWishlist: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [today] = useState(() => new Date())
  const accounts = all.filter((item) => item.kind === 'loan' || item.kind === 'card')
  const selected = accounts.find((item) => item.id === selectedId)
  const loans = accounts.filter((item) => item.kind === 'loan')
  const cards = accounts.filter((item) => item.kind === 'card')
  const balance = selected ? accountBalance(all, selected) : 0
  const original = selected ? selected.target || selected.amount || 0 : 0
  const history = selected ? all.filter((item) => item.kind === 'transaction' && item.accountId === selected.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')) : []
  const wishItems = all.filter((item) => item.kind === 'wish')
  const wishSaved = wishItems.reduce((sum, item) => sum + goalSaved(all, item), 0)
  const wishTarget = wishItems.reduce((sum, item) => sum + (item.target || 0), 0)
  const dueSoon = accounts.filter((item) => { const due = nextDueDate(today, item.dueDay); return due && (due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000 <= 7 })
  const recordPayment = (item: Entry) => open('transaction', undefined, { name: `${item.name} payment`, transactionType: item.kind === 'loan' ? 'loan_payment' : 'card_payment', amount: item.budget, accountId: item.id, paydayId: cycle?.id, category: item.kind === 'loan' ? 'Loans' : 'Cards' })

  if (selected) return <div className="account-detail-view">
    <button className="back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Loans & cards</button>
    <section className="panel account-detail-panel">
      <div className="account-detail-heading"><IconBadge kind={selected.kind} /><div><h2>{selected.name}</h2><small>{selected.kind === 'loan' ? 'Loan account' : 'Card / PayLater account'}</small></div><button className="text-button" onClick={() => open(selected.kind, selected)}>Edit</button></div>
      <div className="account-detail-figures">
        <div><span>{selected.kind === 'loan' ? 'Original loan amount' : 'Credit limit'}</span><strong>{money(selected.kind === 'loan' ? original : selected.limit)}</strong></div>
        <div><span>Current balance</span><strong>{money(balance)}</strong></div>
        {selected.kind === 'loan' && <div><span>Amount paid</span><strong>{money(Math.max(0, original - balance))}</strong></div>}
        <div><span>Monthly due</span><strong>{selected.budget ? money(selected.budget) : 'Not set'}</strong></div>
        {selected.kind === 'loan' && <div><span>Interest rate</span><strong>{selected.rate === undefined ? 'Not set' : `${selected.rate}% p.a.`}</strong></div>}
        <div><span>Next due date</span><strong>{nextDueDate(today, selected.dueDay)?.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Not set'}</strong></div>
      </div>
      <Progress current={selected.kind === 'loan' ? Math.max(0, original - balance) : balance} target={selected.kind === 'loan' ? original : selected.limit || 0} />
      <p className="account-progress-caption">{selected.kind === 'loan' ? 'of original balance paid' : 'of available credit used'}</p>
      <button className="primary-button account-pay-button" onClick={() => recordPayment(selected)}><Plus size={17} /> Record payment</button>
    </section>
    <section className="panel payment-panel"><SectionHead title="Payment history" />{history.length ? history.map((item) => <Row key={item.id} item={item} detail={shortDate(item.date)} aside={money(item.amount)} onClick={() => open('transaction', item)} />) : <Empty title="No payments recorded" body="Record a payment to see it here." />}</section>
  </div>

  return <div className="accounts-view">
    <div className="accounts-hero"><div><strong>Manage today.<br /><em>Freedom tomorrow.</em></strong><p>Track your loans, cards, bills, and dreams in one place.</p></div><SproutMark size={70} className="hero-sprout" /></div>
    <div className="account-metrics"><Metric label="Loans balance" value={money(loans.reduce((sum, item) => sum + accountBalance(all, item), 0))} tone="coral" icon={Coins} /><Metric label="Cards balance" value={money(cards.reduce((sum, item) => sum + accountBalance(all, item), 0))} tone="blue" icon={CreditCard} /><Metric label="Due this week" value={money(dueSoon.reduce((sum, item) => sum + (item.budget || 0), 0))} tone="amber" icon={CalendarDots} /><Metric label="Available budget" value={money(cycle ? cycleTotals(all, cycle).remaining : 0)} tone="teal" icon={Wallet} /></div>
    <button className="wishlist-strip" onClick={onWishlist}><ShoppingCart size={34} weight="duotone" /><span><strong>Wishlist savings</strong><small>{money(wishSaved)} of {money(wishTarget)}</small><Progress current={wishSaved} target={wishTarget} /></span><CaretRight size={18} /></button>
    <section className="panel account-list-panel"><SectionHead title="My loans & cards" action="Add loan" onAction={() => open('loan')} />{accounts.length ? accounts.map((item) => { const current = accountBalance(all, item); const source = item.kind === 'loan' ? item.target || item.amount || 0 : item.limit || 0; return <button className="account-list-row" key={item.id} onClick={() => setSelectedId(item.id)}><IconBadge kind={item.kind} /><span className="account-list-copy"><strong>{item.name}</strong><small>Outstanding: {money(current)}</small><Progress current={item.kind === 'loan' ? Math.max(0, source - current) : current} target={source} /></span><CaretRight size={18} /></button> }) : <Empty title="No accounts yet" body="Add a loan or card to track balances and payments." />}<button className="text-button add-card-link" onClick={() => open('card')}>Add card <Plus size={14} /></button></section>
  </div>
}
