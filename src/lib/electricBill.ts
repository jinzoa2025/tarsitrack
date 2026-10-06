import type { ElectricBillInput, Entry } from './data'

export const electricBillName = '__tracker_electric_bill__'

export function isElectricBillEntry(entry: Entry): entry is Entry & { electricBill: ElectricBillInput } {
  return entry.kind === 'category' && entry.name === electricBillName && !!entry.electricBill
}

export function calculateElectricBill(input: ElectricBillInput) {
  const readings = [input.totalBill, input.mainPrevious, input.mainLatest, input.subPrevious, input.subLatest]
  if (readings.some((value) => !Number.isFinite(value) || value < 0)) return { error: 'Enter valid, non-negative amounts and readings.' } as const
  if (input.mainLatest < input.mainPrevious || input.subLatest < input.subPrevious) return { error: 'Latest readings cannot be below previous readings.' } as const
  const totalKwh = input.mainLatest - input.mainPrevious
  const otherKwh = input.subLatest - input.subPrevious
  if (totalKwh <= 0) return { error: 'Main meter usage must be greater than zero.' } as const
  if (otherKwh > totalKwh) return { error: 'The other house cannot use more than the main meter total.' } as const
  const billCents = Math.round(input.totalBill * 100)
  const otherCents = Math.round(billCents * otherKwh / totalKwh)
  return {
    totalKwh,
    otherKwh,
    ourKwh: totalKwh - otherKwh,
    rate: input.totalBill / totalKwh,
    otherBill: otherCents / 100,
    ourBill: (billCents - otherCents) / 100,
  } as const
}
