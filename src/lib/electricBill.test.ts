import { describe, expect, it } from 'vitest'
import { calculateElectricBill } from './electricBill'

describe('electric bill split', () => {
  it('allocates the supplied August and September bills to the cent', () => {
    expect(calculateElectricBill({ month: '2026-08', totalBill: 6906.5, mainPrevious: 8910, mainLatest: 9451, subPrevious: 1480, subLatest: 1723 })).toMatchObject({ totalKwh: 541, otherKwh: 243, ourKwh: 298, otherBill: 3102.18, ourBill: 3804.32 })
    expect(calculateElectricBill({ month: '2026-09', totalBill: 7417.25, mainPrevious: 9451, mainLatest: 10066, subPrevious: 1723, subLatest: 1956 })).toMatchObject({ totalKwh: 615, otherKwh: 233, ourKwh: 382, otherBill: 2810.11, ourBill: 4607.14 })
  })

  it('rejects invalid and incomplete meter splits', () => {
    expect(calculateElectricBill({ month: '2026-10', totalBill: 100, mainPrevious: 10, mainLatest: 10, subPrevious: 0, subLatest: 0 })).toHaveProperty('error')
    expect(calculateElectricBill({ month: '2026-10', totalBill: 100, mainPrevious: 10, mainLatest: 20, subPrevious: 0, subLatest: 11 })).toHaveProperty('error')
    expect(calculateElectricBill({ month: '2026-10', totalBill: 100, mainPrevious: 20, mainLatest: 10, subPrevious: 0, subLatest: 0 })).toHaveProperty('error')
  })
})
