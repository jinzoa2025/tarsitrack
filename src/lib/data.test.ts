import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { accountBalance, cycleTotals, goalSaved, removeEntry, saveEntry, TrackerDB, type Entry } from './data'

const base = { updatedAt: '2026-10-02T00:00:00.000Z', syncStatus: 'pending' as const, baseVersion: 0, deviceId: 'test-device' }
const row = (id: string, kind: Entry['kind'], name: string, rest: Partial<Entry> = {}): Entry => ({ ...base, id, kind, name, ...rest })

describe('payday accounting', () => {
  const payday = row('payday', 'payday', 'Oct 5', { date: '2026-10-05' })
  const income = row('income', 'transaction', 'Salary', { paydayId: 'payday', transactionType: 'income', amount: 36000 })
  const market = row('market', 'transaction', 'Market', { paydayId: 'payday', transactionType: 'expense', amount: 6000, category: 'Food' })
  const titheRule = row('rule', 'rule', 'Tithes', { ruleMode: 'income_percent', ruleValue: 10 })

  it('keeps planned expenses out of actual spending', () => {
    const plan = row('plan', 'plan', 'Food budget', { paydayId: 'payday', budget: 8000, category: 'Food' })
    expect(cycleTotals([payday, income, market, titheRule, plan], payday)).toMatchObject({ income: 36000, expenses: 6000, allocated: 3600, remaining: 26400 })
  })

  it('does not reserve a rule twice after its payment is recorded', () => {
    const tithe = row('tithe', 'transaction', 'Tithes', { paydayId: 'payday', transactionType: 'expense', amount: 3600, category: 'Tithes' })
    expect(cycleTotals([payday, income, market, titheRule, tithe], payday)).toMatchObject({ expenses: 9600, allocated: 0, remaining: 26400 })
  })

  it('keeps remaining-percentage targets stable when an earlier rule is paid', () => {
    const second = row('savings-rule', 'rule', 'Savings', { ruleMode: 'remaining_percent', ruleValue: 10, createdAt: '2026-10-02T01:00:00.000Z' })
    const first = { ...titheRule, createdAt: '2026-10-02T00:00:00.000Z' }
    const tithe = row('tithe', 'transaction', 'Tithes', { paydayId: 'payday', transactionType: 'expense', amount: 3600, category: 'Tithes' })
    const before = cycleTotals([payday, income, first, second], payday)
    const after = cycleTotals([payday, income, first, second, tithe], payday)
    expect(before.allocations[1].calculated).toBe(3240)
    expect(after.allocations[1].calculated).toBe(3240)
    expect(after.remaining).toBe(before.remaining)
  })

  it('counts goal contributions as transfers, not expenses', () => {
    const deposit = row('deposit', 'transaction', 'Emergency deposit', { paydayId: 'payday', transactionType: 'goal_deposit', amount: 2000, accountId: 'goal' })
    expect(cycleTotals([payday, income, market, titheRule, deposit], payday)).toMatchObject({ expenses: 6000, transfers: 2000, remaining: 24400 })
  })
})

describe('linked accounts', () => {
  it('updates loan and card balances from one payment entry', () => {
    const loan = row('loan', 'loan', 'Bank loan', { amount: 120000 })
    const card = row('card', 'card', 'Credit card', { amount: 24500 })
    const payment = row('payment', 'transaction', 'Loan payment', { accountId: 'loan', transactionType: 'loan_payment', amount: 5000 })
    const charge = row('charge', 'transaction', 'Card charge', { accountId: 'card', transactionType: 'expense', amount: 2000 })
    const cardPayment = row('card-payment', 'transaction', 'Card payment', { accountId: 'card', transactionType: 'card_payment', amount: 1500 })
    expect(accountBalance([loan, card, payment, charge, cardPayment], loan)).toBe(115000)
    expect(accountBalance([loan, card, payment, charge, cardPayment], card)).toBe(25000)
  })

  it('adds contributions to a goal without changing its starting amount', () => {
    const goal = row('goal', 'goal', 'Emergency fund', { saved: 42000, target: 100000 })
    const deposit = row('deposit', 'transaction', 'Deposit', { accountId: 'goal', transactionType: 'goal_deposit', amount: 3000 })
    expect(goalSaved([goal, deposit], goal)).toBe(45000)
  })
})

describe('offline records', () => {
  it('saves immediately and retains a deletion tombstone', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) })
    const db = new TrackerDB(`test-${crypto.randomUUID()}`)
    const created = await saveEntry(db, { kind: 'bill', name: 'Electricity', amount: 1000 })
    expect((await db.entries.get(created.id))?.syncStatus).toBe('pending')
    await removeEntry(db, created)
    expect((await db.entries.get(created.id))?.deletedAt).toBeTruthy()
    await db.delete()
    vi.unstubAllGlobals()
  })
})
