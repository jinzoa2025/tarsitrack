import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { cycleTotals, saveEntry, TrackerDB, type Entry } from './data'
import { additionalExpense, copyRows, defaultRows, monthSummary, sheetTemplate, sheetTotals, sheetsForPeriod, summarizeSheets, templateName } from './paydaySheet'

const base = { updatedAt: '2026-10-05T00:00:00.000Z', syncStatus: 'pending' as const, baseVersion: 0, deviceId: 'test' }
const august: Entry = { ...base, id: 'august', kind: 'payday', name: 'Aug 5', date: '2026-08-05', sheetIncome: 36000, sheetTitheRate: 10, sheetRows: defaultRows }
const october: Entry = { ...base, id: 'october', kind: 'payday', name: 'Oct 5', date: '2026-10-05', sheetIncome: 100000, sheetTitheRate: 10, sheetRows: defaultRows.map((row, index) => ({ ...row, amount: [13361.93, 2000, 1232.76, 6000, 2000, 2500, 1500][index] })) }

describe('simple payday sheets', () => {
  it('matches both Excel examples to the cent', () => {
    expect(sheetTotals(august)).toMatchObject({ income: 36000, tithes: 3600, rows: 25500, moneyAfterTithes: 32400, remaining: 6900 })
    expect(sheetTotals(october)).toMatchObject({ income: 100000, tithes: 10000, rows: 28594.69, moneyAfterTithes: 90000, remaining: 61405.31 })
  })

  it('supports payday, monthly, and yearly totals without counting allocations as paid transactions', () => {
    const sheets = [august, october]
    expect(summarizeSheets(sheetsForPeriod(sheets, 'payday', october.id)).remaining).toBe(61405.31)
    expect(summarizeSheets(sheetsForPeriod(sheets, 'month', '2026-08')).remaining).toBe(6900)
    expect(summarizeSheets(sheetsForPeriod(sheets, 'year', '2026'))).toMatchObject({ income: 136000, tithes: 13600, rows: 54094.69, remaining: 68305.31 })
    expect(cycleTotals([august], august).expenses).toBe(0)
  })

  it('leaves remaining blank until income is entered and honors a changed rate', () => {
    expect(sheetTotals({ sheetRows: defaultRows, sheetTitheRate: 10 }).remaining).toBeUndefined()
    expect(sheetTotals({ sheetIncome: 1000, sheetTitheRate: 5, sheetRows: [{ id: 'one', name: 'Market', amount: 100 }] }).remaining).toBe(850)
  })

  it('totals every payday and extra expense in the chosen month, excluding other months and deleted sheets', () => {
    const extra = additionalExpense(' School supplies ', 1250.5)
    const second = { ...october, id: 'oct-20', date: '2026-10-20', sheetRows: [...copyRows(defaultRows), extra], sheetIncome: 36000 }
    const deleted = { ...october, id: 'deleted', deletedAt: '2026-10-05' }
    const result = monthSummary([august, october, second, deleted], '2026-10')
    expect(result).toMatchObject({ income: 136000, tithes: 13600, rows: 55345.19, remaining: 67054.81, drafts: 0 })
    expect(result.sheets.map((sheet) => sheet.id)).toEqual(['october', 'oct-20'])
    expect(result.byName).toContainEqual(['School supplies', 1250.5])
    expect(result.byName).toContainEqual(['Market', 12000])
    expect(monthSummary([], '2026-10')).toMatchObject({ rows: 0, remaining: 0 })
  })

  it('includes draft rows but waits for income before claiming a monthly remaining balance', () => {
    const draft = { ...october, id: 'draft', sheetIncome: undefined }
    expect(monthSummary([draft], '2026-10')).toMatchObject({ rows: 28594.69, remaining: undefined, drafts: 1 })
    expect(() => additionalExpense('', 100)).toThrow()
    for (const amount of [0, -1, NaN, Infinity]) expect(() => additionalExpense('Extra', amount)).toThrow()
  })

  it('keeps a customized template and sheet after reopening the offline database', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) })
    const scope = `payday-test-${crypto.randomUUID()}`
    const db = new TrackerDB(scope)
    await saveEntry(db, { kind: 'category', name: templateName, sheetTemplate: true, sheetTitheRate: 7.5, sheetRows: [{ id: 'market', name: 'Market', amount: 6500 }] })
    const saved = await saveEntry(db, { kind: 'payday', name: 'Oct 5 payday', date: '2026-10-05', sheetIncome: 100000, sheetTitheRate: 7.5, sheetRows: [{ id: 'market-copy', name: 'Market', amount: 6500 }] })
    const extra = additionalExpense('Medicine', 750)
    await saveEntry(db, { ...saved, sheetRows: [...saved.sheetRows!, extra] })
    db.close()
    const reopened = new TrackerDB(scope)
    expect((await reopened.entries.get(saved.id))?.sheetRows?.[0].amount).toBe(6500)
    expect((await reopened.entries.get(saved.id))?.sheetRows?.[1]).toMatchObject({ name: 'Medicine', amount: 750, additional: true })
    const nextTemplate = sheetTemplate(await reopened.entries.toArray())
    expect(copyRows(nextTemplate.rows)).toHaveLength(1)
    expect(nextTemplate.rows.some((row) => row.name === 'Medicine')).toBe(false)
    expect((await reopened.entries.where('kind').equals('category').first())?.sheetTitheRate).toBe(7.5)
    await reopened.delete()
    vi.unstubAllGlobals()
  })
})
