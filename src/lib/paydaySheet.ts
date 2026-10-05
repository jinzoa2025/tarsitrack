import type { Entry, SheetRow } from './data'

export const templateName = '__tracker_payday_template__'
export const defaultRows: SheetRow[] = [
  ['Metrobank (N)', 12000], ['Paluwagan', 2000], ['Shopee', 1000],
  ['Market', 6000], ['Miscellaneous', 2000], ['Electricity', 1000], ['Gas', 1500],
].map(([name, amount], index) => ({ id: `default-${index}`, name: String(name), amount: Number(amount) }))

export function isTemplate(entry: Entry) { return entry.kind === 'category' && entry.sheetTemplate === true }
export function isSheet(entry: Entry) { return entry.kind === 'payday' && Array.isArray(entry.sheetRows) }
export function sheetTemplate(entries: Entry[]) {
  const entry = entries.filter(isTemplate).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  return { entry, rate: entry?.sheetTitheRate ?? 10, rows: entry?.sheetRows ?? defaultRows }
}
export function copyRows(rows: SheetRow[]) {
  return rows.map((row) => ({ ...row, id: crypto.randomUUID() }))
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export function sheetTotals(sheet: Pick<Entry, 'sheetIncome' | 'sheetTitheRate' | 'sheetRows'>) {
  const income = sheet.sheetIncome
  const rate = sheet.sheetTitheRate ?? 10
  const tithes = income === undefined ? undefined : cents(income * rate / 100)
  const rows = cents((sheet.sheetRows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0))
  const moneyAfterTithes = income === undefined ? undefined : cents(income - (tithes || 0))
  const remaining = moneyAfterTithes === undefined ? undefined : cents(moneyAfterTithes - rows)
  return { income, rate, tithes, rows, moneyAfterTithes, remaining }
}

export type ReportPeriod = 'payday' | 'month' | 'year'
export function sheetsForPeriod(sheets: Entry[], period: ReportPeriod, key: string) {
  return sheets.filter((sheet) => isSheet(sheet) && sheet.sheetIncome !== undefined && (period === 'payday' ? sheet.id === key : period === 'month' ? sheet.date?.slice(0, 7) === key : sheet.date?.slice(0, 4) === key))
}
export function summarizeSheets(sheets: Entry[]) {
  const byName = new Map<string, number>()
  const result = sheets.reduce((sum, sheet) => {
    const total = sheetTotals(sheet)
    for (const row of sheet.sheetRows || []) byName.set(row.name, cents((byName.get(row.name) || 0) + row.amount))
    return { income: cents(sum.income + (total.income || 0)), tithes: cents(sum.tithes + (total.tithes || 0)), rows: cents(sum.rows + total.rows) }
  }, { income: 0, tithes: 0, rows: 0 })
  return { ...result, remaining: cents(result.income - result.tithes - result.rows), byName: [...byName].sort((a, b) => b[1] - a[1]) }
}
