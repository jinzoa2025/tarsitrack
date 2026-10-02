import { expect, test } from 'vitest'
import { scheduledForMonth } from './schedule'
import type { Entry } from './data'

function item(input: Partial<Entry> & Pick<Entry, 'id' | 'kind' | 'name'>): Entry {
  return { syncStatus: 'pending', baseVersion: 0, deviceId: 'test', updatedAt: '2026-10-02', ...input }
}

test('shows recurring bills and account payments in the viewed month', () => {
  const entries = [
    item({ id: 'bill', kind: 'bill', name: 'Electricity', amount: 1000, dueDay: 8, recurrence: 'monthly' }),
    item({ id: 'loan', kind: 'loan', name: 'Metrobank loan', budget: 5000, dueDay: 15 }),
    item({ id: 'card', kind: 'card', name: 'BPI card', budget: 1500, dueDay: 31 }),
    item({ id: 'tx', kind: 'transaction', name: 'Payment', amount: 5000 }),
  ]
  expect(scheduledForMonth(entries, new Date(2026, 9, 1)).map(({ entry, day, amount, tone }) => [entry.id, day, amount, tone])).toEqual([
    ['bill', 8, 1000, 'utility'],
    ['loan', 15, 5000, 'loan'],
    ['card', 31, 1500, 'card'],
  ])
})

test('clamps monthly due days and excludes one-time bills from other months', () => {
  const entries = [
    item({ id: 'monthly', kind: 'bill', name: 'Rent', amount: 2000, dueDay: 31, recurrence: 'monthly' }),
    item({ id: 'one-time', kind: 'bill', name: 'Repair', amount: 600, dueDate: '2026-03-04', recurrence: 'once' }),
  ]
  expect(scheduledForMonth(entries, new Date(2026, 1, 1)).map(({ entry, day }) => [entry.id, day])).toEqual([['monthly', 28]])
  expect(scheduledForMonth(entries, new Date(2026, 2, 1)).map(({ entry, day }) => [entry.id, day])).toEqual([['one-time', 4], ['monthly', 31]])
})
