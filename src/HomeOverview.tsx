import { CalendarDots, Heart, Plus } from '@phosphor-icons/react'
import AccountsView from './AccountsView'
import { cycleTotals, money, shortDate, type Entry, type Kind } from './lib/data'
import { DueList, Empty, Row, SectionHead } from './ui'

type PlanningTab = 'paydays' | 'bills' | 'accounts' | 'wishlist' | 'savings' | 'rules'
type OpenForm = (kind: Kind, entry?: Entry, preset?: Partial<Entry>) => void

export default function HomeView({ all, open, go, cycle, paydays, transactions, selectedCycle, selectCycle, loadSample }: {
  all: Entry[]
  open: OpenForm
  go: (page: 'activity' | 'planning', tab?: PlanningTab) => void
  cycle?: Entry
  paydays: Entry[]
  transactions: Entry[]
  selectedCycle: string
  selectCycle: (id: string) => void
  loadSample: () => void
}) {
  const totals = cycle ? cycleTotals(all, cycle) : null
  const bills = all.filter((item) => item.kind === 'bill')
  const featuredPaydays = cycle ? [cycle, ...paydays.filter((item) => item.id !== cycle.id)].slice(0, 2) : paydays.slice(0, 2)

  return <div className="home-overview">
    <AccountsView all={all} open={open} cycle={cycle} onWishlist={() => go('planning', 'wishlist')} />
    <div className="overview-note"><Heart size={19} weight="duotone" /><span>Every payment brings you closer to the life you want.</span></div>

    {paydays.length ? <section className="panel overview-paydays">
      <SectionHead title="Payday cycles" action="See all" onAction={() => go('planning', 'paydays')} />
      <div className="overview-payday-focus">
        <div><span>AVAILABLE THIS PAYDAY</span><strong>{money(totals?.remaining)}</strong><small>After allocations, expenses and transfers</small></div>
        <select aria-label="Choose payday" value={selectedCycle || cycle?.id} onChange={(event) => selectCycle(event.target.value)}>{paydays.map((item) => <option key={item.id} value={item.id}>{shortDate(item.date)}</option>)}</select>
      </div>
      <div className="overview-payday-lines"><div><span>Income</span><strong>{money(totals?.income)}</strong></div><div><span>Automatic allocations</span><strong>{money(totals?.allocated)}</strong></div><div><span>Total expenses</span><strong>{money(totals?.expenses)}</strong></div></div>
      <div className="overview-cycle-list">{featuredPaydays.map((item) => { const sum = cycleTotals(all, item); return <button key={item.id} className={cycle?.id === item.id ? 'overview-cycle active' : 'overview-cycle'} onClick={() => selectCycle(item.id)}><CalendarDots size={19} /><span><strong>{shortDate(item.date)}</strong><small>{sum.income ? 'Completed' : 'Upcoming'}</small></span><b>{money(sum.remaining)}</b></button> })}</div>
      <button className="primary-button overview-add-entry" onClick={() => open('transaction', undefined, { paydayId: cycle?.id })}><Plus size={16} /> Add entry</button>
    </section> : <Empty title="Start with your first payday" body="Add a payday, then record income and spending. Your overview will update automatically." action="Add payday" onAction={() => open('payday')} />}

    <div className="dashboard-grid overview-lower"><section className="panel"><SectionHead title="Upcoming bills" action="See calendar" onAction={() => go('planning', 'bills')} /><DueList all={all} onPay={(bill) => open('transaction', undefined, { name: bill.name, amount: bill.amount, category: bill.category, transactionType: 'expense', paydayId: cycle?.id, accountId: bill.id })} />{!bills.length && <button className="subtle-button" onClick={() => open('bill')}><Plus size={16} /> Add a bill</button>}</section><section className="panel"><SectionHead title="Recent activity" action="View all" onAction={() => go('activity')} />{transactions.length ? transactions.slice(0, 5).map((item) => <Row key={item.id} item={item} aside={`${item.transactionType === 'income' ? '+' : '−'}${money(item.amount)}`} onClick={() => open('transaction', item)} />) : <Empty title="No activity yet" body="Your latest entries will appear here." />}</section></div>
    {!all.length && <button className="demo-button" onClick={loadSample}>Load sample data to explore</button>}
  </div>
}
