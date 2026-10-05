import Dexie, { type Table } from 'dexie'

export type Kind = 'payday' | 'transaction' | 'plan' | 'rule' | 'loan' | 'card' | 'bill' | 'wish' | 'goal' | 'category'
export type TransactionType = 'income' | 'expense' | 'loan_payment' | 'card_payment' | 'goal_deposit' | 'wish_contribution' | 'transfer' | 'adjustment'
export type RuleMode = 'income_percent' | 'remaining_percent' | 'fixed' | 'manual'
export interface SheetRow { id: string; name: string; amount: number }

export interface Entry {
  id: string
  kind: Kind
  name: string
  amount?: number
  date?: string
  paydayId?: string
  accountId?: string
  category?: string
  transactionType?: TransactionType
  target?: number
  saved?: number
  priority?: 'Need' | 'Want' | 'Someday'
  artwork?: 'double-deck'
  targetDate?: string
  dueDay?: number
  dueDate?: string
  recurrence?: 'monthly' | 'once'
  remindDays?: number[]
  ruleMode?: RuleMode
  ruleValue?: number
  budget?: number
  limit?: number
  rate?: number
  sheetIncome?: number
  sheetTitheRate?: number
  sheetRows?: SheetRow[]
  sheetTemplate?: boolean
  notes?: string
  createdAt?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: 'pending' | 'synced'
  baseVersion: number
  deviceId: string
}

export interface Conflict {
  id: string
  recordId: string
  local: Entry
  remote: Entry
  createdAt: string
}

export class TrackerDB extends Dexie {
  entries!: Table<Entry, string>
  conflicts!: Table<Conflict, string>

  constructor(scope: string) {
    super(`tarsitrack-${scope}`)
    this.version(1).stores({
      entries: 'id, kind, date, paydayId, accountId, updatedAt, syncStatus, deletedAt',
      conflicts: 'id, recordId, createdAt',
    })
  }
}

export const guestDb = new TrackerDB('guest')
export const accountDb = (userId: string) => new TrackerDB(`account-${userId}`)

const deviceKey = 'tarsitrack-device-id'
export function deviceId() {
  let id = localStorage.getItem(deviceKey)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(deviceKey, id)
  }
  return id
}

export async function saveEntry(db: TrackerDB, input: Partial<Entry> & Pick<Entry, 'kind' | 'name'>) {
  const existing = input.id ? await db.entries.get(input.id) : undefined
  const now = new Date().toISOString()
  const entry: Entry = {
    ...existing,
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
    syncStatus: 'pending',
    baseVersion: existing?.baseVersion ?? 0,
    deviceId: deviceId(),
  }
  await db.entries.put(entry)
  return entry
}

export async function removeEntry(db: TrackerDB, entry: Entry) {
  await db.entries.put({ ...entry, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), syncStatus: 'pending' })
}

export function active(entries: Entry[] | undefined, kind?: Kind) {
  return (entries ?? []).filter((entry) => !entry.deletedAt && (!kind || entry.kind === kind))
}

export function money(amount = 0) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function shortDate(date?: string) {
  if (!date) return 'No date'
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function cycleTotals(entries: Entry[], payday: Entry) {
  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const transactions = entries.filter((item) => item.kind === 'transaction' && item.paydayId === payday.id)
  const income = transactions.filter((item) => item.transactionType === 'income').reduce((sum, item) => sum + (item.amount || 0), 0)
  const expenses = transactions.filter((item) => ['expense', 'loan_payment', 'card_payment'].includes(item.transactionType || '')).reduce((sum, item) => sum + (item.amount || 0), 0)
  const transfers = transactions.filter((item) => ['goal_deposit', 'wish_contribution', 'transfer'].includes(item.transactionType || '')).reduce((sum, item) => sum + (item.amount || 0), 0)
  const rules = entries.filter((item) => item.kind === 'rule').sort((a, b) => (a.createdAt || a.updatedAt).localeCompare(b.createdAt || b.updatedAt) || a.id.localeCompare(b.id))
  let ruleBasis = income
  let allocated = 0
  const allocations = rules.map((rule) => {
    const value = cents(rule.ruleMode === 'income_percent' ? income * (rule.ruleValue || 0) / 100
      : rule.ruleMode === 'remaining_percent' ? ruleBasis * (rule.ruleValue || 0) / 100
      : rule.ruleMode === 'fixed' ? (rule.ruleValue || 0) : 0)
    ruleBasis -= value
    const fulfilled = transactions.filter((item) => ['expense', 'loan_payment', 'card_payment', 'goal_deposit', 'wish_contribution'].includes(item.transactionType || '') && (item.category || item.name).toLowerCase() === rule.name.toLowerCase()).reduce((sum, item) => sum + (item.amount || 0), 0)
    const reserved = cents(Math.max(0, value - fulfilled))
    allocated = cents(allocated + reserved)
    return { ...rule, calculated: value, reserved }
  })
  const available = cents(income - allocated)
  return { income: cents(income), expenses: cents(expenses), transfers: cents(transfers), allocated, available, remaining: cents(available - expenses - transfers), allocations }
}

export function accountBalance(entries: Entry[], account: Entry) {
  const linked = entries.filter((item) => item.kind === 'transaction' && item.accountId === account.id)
  const paid = linked.filter((item) => ['loan_payment', 'card_payment'].includes(item.transactionType || '')).reduce((sum, item) => sum + (item.amount || 0), 0)
  const charges = account.kind === 'card' ? linked.filter((item) => item.transactionType === 'expense').reduce((sum, item) => sum + (item.amount || 0), 0) : 0
  return Math.max(0, (account.amount || 0) + charges - paid)
}

export function goalSaved(entries: Entry[], goal: Entry) {
  const type = goal.kind === 'wish' ? 'wish_contribution' : 'goal_deposit'
  return (goal.saved || 0) + entries.filter((item) => item.kind === 'transaction' && item.accountId === goal.id && item.transactionType === type).reduce((sum, item) => sum + (item.amount || 0), 0)
}

export async function loadDemo(db: TrackerDB) {
  if ((await db.entries.count()) > 0) return
  const p1 = crypto.randomUUID()
  const p2 = crypto.randomUUID()
  const loan = crypto.randomUUID()
  const wish = crypto.randomUUID()
  const stamp = new Date().toISOString()
  const base = { createdAt: stamp, updatedAt: stamp, syncStatus: 'pending' as const, baseVersion: 0, deviceId: deviceId() }
  const rows: Entry[] = [
    { ...base, id: p1, kind: 'payday', name: 'August 5 payday', date: '2026-08-05' },
    { ...base, id: p2, kind: 'payday', name: 'August 20 payday', date: '2026-08-20' },
    { ...base, id: crypto.randomUUID(), kind: 'rule', name: 'Tithes', ruleMode: 'income_percent', ruleValue: 10 },
    { ...base, id: crypto.randomUUID(), kind: 'transaction', name: 'Salary', transactionType: 'income', amount: 36000, date: '2026-08-05', paydayId: p1, category: 'Income' },
    { ...base, id: crypto.randomUUID(), kind: 'transaction', name: 'Market', transactionType: 'expense', amount: 6000, date: '2026-08-05', paydayId: p1, category: 'Food' },
    { ...base, id: crypto.randomUUID(), kind: 'transaction', name: 'Paluwagan', transactionType: 'expense', amount: 2000, date: '2026-08-05', paydayId: p1, category: 'Family' },
    { ...base, id: crypto.randomUUID(), kind: 'transaction', name: 'Utilities', transactionType: 'expense', amount: 2500, date: '2026-08-05', paydayId: p1, category: 'Utilities' },
    { ...base, id: crypto.randomUUID(), kind: 'plan', name: 'Market budget', budget: 6500, category: 'Food', paydayId: p1 },
    { ...base, id: loan, kind: 'loan', name: 'Metrobank loan', amount: 120000, target: 200000, budget: 5000, dueDay: 15, rate: 8.5 },
    { ...base, id: crypto.randomUUID(), kind: 'transaction', name: 'Metrobank payment', transactionType: 'loan_payment', amount: 5000, date: '2026-08-05', paydayId: p1, accountId: loan, category: 'Loans' },
    { ...base, id: crypto.randomUUID(), kind: 'card', name: 'BPI credit card', amount: 24500, limit: 100000, budget: 1500, dueDay: 25 },
    { ...base, id: crypto.randomUUID(), kind: 'bill', name: 'Electricity', amount: 1000, dueDay: 8, recurrence: 'monthly', category: 'Utilities' },
    { ...base, id: crypto.randomUUID(), kind: 'bill', name: 'Internet', amount: 1200, dueDay: 12, recurrence: 'monthly', category: 'Utilities' },
    { ...base, id: wish, kind: 'wish', name: 'Double deck', target: 15000, saved: 3000, priority: 'Need', targetDate: '2026-12-31', artwork: 'double-deck' },
    { ...base, id: crypto.randomUUID(), kind: 'goal', name: 'Emergency fund', target: 100000, saved: 42000, targetDate: '2027-12-31' },
  ]
  await db.entries.bulkAdd(rows)
}
