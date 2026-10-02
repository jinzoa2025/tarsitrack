import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bank, Bell, CalendarDots, CreditCard, Drop, House, Leaf, Lightning, PencilSimple, ShoppingBag, Target, Wallet, WifiHigh, ArrowsClockwise } from '@phosphor-icons/react'
import { useState } from 'react'
import { money, shortDate, type Entry, type Kind, type TransactionType } from './lib/data'

export function IconBadge({ kind }: { kind: Kind | TransactionType }) {
  const Icon = kind === 'income' ? ArrowDownLeft : kind === 'wish' || kind === 'wish_contribution' ? ShoppingBag
    : kind === 'loan' || kind === 'loan_payment' ? Bank : kind === 'card' || kind === 'card_payment' ? CreditCard
    : kind === 'goal' || kind === 'goal_deposit' ? Target : kind === 'bill' ? Bell : kind === 'payday' ? CalendarDots
    : kind === 'rule' ? ArrowsClockwise : kind === 'expense' || kind === 'plan' ? ArrowUpRight : Wallet
  return <span className={`icon-badge ${kind}`}><Icon size={23} weight={['loan', 'card', 'bill', 'wish', 'goal', 'payday'].includes(kind) ? 'fill' : 'duotone'} /></span>
}

export function SproutMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M30 56c3-13 4-29 2-42M31 39c-6-9-12-13-19-16M32 34c7-9 13-14 22-17" stroke="#77F7EE" strokeWidth="2.7" strokeLinecap="round" /><path d="M30 31C17 30 10 21 10 9c13 1 22 10 20 22Z" fill="#63EFFF" /><path d="M33 31c1-13 9-20 22-22-1 13-8 21-22 22Z" fill="#34C7FF" /><path d="M29 43C19 38 9 43 5 55c13 2 22-2 24-12Z" fill="#83F8E9" /><path d="M33 44c6-8 14-11 23-7-3 11-11 17-23 17V44Z" fill="#23BAFF" /></svg>
}

export function BillSymbol({ name }: { name: string }) {
  const variant = /electric/i.test(name) ? 'electric' : /water/i.test(name) ? 'water'
    : /internet|wifi/i.test(name) ? 'internet' : /rent|home|house/i.test(name) ? 'home' : 'other'
  const Icon = variant === 'electric' ? Lightning : variant === 'water' ? Drop
    : variant === 'internet' ? WifiHigh : variant === 'home' ? House : Bell
  return <span className={`bill-symbol ${variant}`}><Icon size={24} weight={variant === 'internet' ? 'bold' : 'fill'} /></span>
}

export function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return <div className="empty"><Leaf size={34} weight="duotone" /><strong>{title}</strong><p>{body}</p>{action && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={15} /></button>}</div>
}

export function Metric({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: typeof Wallet }) {
  const Icon = icon
  return <div className={`metric ${tone}`}><span className="metric-icon"><Icon size={21} weight="duotone" /></span><span className="metric-copy"><small>{label}</small><strong>{value}</strong></span></div>
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-head"><h2>{title}</h2>{action && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>
}

export function Row({ item, aside, detail, onClick }: { item: Entry; aside?: string; detail?: string; onClick?: () => void }) {
  return <button className="data-row" onClick={onClick}><IconBadge kind={item.kind === 'transaction' ? (item.transactionType || 'expense') : item.kind} /><span className="row-main"><strong>{item.name}</strong><small>{detail || (item.date ? shortDate(item.date) : item.category || '')}</small></span><span className="row-end">{aside && <strong>{aside}</strong>}<PencilSimple size={15} /></span></button>
}

export function Progress({ current, target }: { current: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0
  return <div className="progress-wrap"><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><small>{percent}%</small></div>
}

export function DueList({ all, onPay, onEdit }: { all: Entry[]; onPay: (bill: Entry) => void; onEdit?: (bill: Entry) => void }) {
  const [today] = useState(() => new Date())
  const bills = all.filter((item) => item.kind === 'bill').map((bill) => {
    let due = bill.recurrence === 'once' && bill.dueDate ? new Date(`${bill.dueDate}T12:00:00`) : new Date(today.getFullYear(), today.getMonth(), Math.min(bill.dueDay || 1, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()), 12)
    const paidThisMonth = all.some((item) => item.kind === 'transaction' && item.accountId === bill.id && item.date?.slice(0, 7) === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
    if (bill.recurrence !== 'once' && due < today && paidThisMonth) due = new Date(today.getFullYear(), today.getMonth() + 1, bill.dueDay || 1, 12)
    return { bill, due, paidThisMonth }
  }).sort((a, b) => a.due.getTime() - b.due.getTime())
  if (!bills.length) return <Empty title="No bills scheduled" body="Add a recurring bill to keep its due date in view." />
  return <div className="due-list">{bills.slice(0, 6).map(({ bill, due, paidThisMonth }) => { const days = Math.ceil((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000); const remind = !paidThisMonth && (bill.remindDays || [7, 3, 1, 0]).includes(days); return <div className="due-row" key={bill.id}><BillSymbol name={bill.name} /><div><strong>{bill.name}</strong><small>{due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}{paidThisMonth ? ' · paid this month' : remind ? ` · ${days === 0 ? 'Due today' : `${days} days left`}` : ''}</small></div><strong>{money(bill.amount)}</strong><button aria-label={`Record ${bill.name} payment`} onClick={() => onPay(bill)}>Pay</button>{onEdit && <button aria-label={`Edit ${bill.name}`} onClick={() => onEdit(bill)}><PencilSimple size={16} /></button>}</div> })}</div>
}
