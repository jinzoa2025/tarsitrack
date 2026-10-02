import type { Entry } from './data'

export type ScheduleTone = 'utility' | 'card' | 'loan' | 'other'
export type ScheduleItem = { entry: Entry; day: number; amount: number; tone: ScheduleTone }

export function scheduledForMonth(entries: Entry[], month: Date): ScheduleItem[] {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  return entries.flatMap((entry): ScheduleItem[] => {
    if (entry.kind !== 'bill' && entry.kind !== 'loan' && entry.kind !== 'card') return []
    let day: number
    if (entry.kind === 'bill' && entry.recurrence === 'once') {
      if (!entry.dueDate?.startsWith(`${monthKey}-`)) return []
      day = Number(entry.dueDate.slice(8, 10))
    } else {
      if (!entry.dueDay) return []
      day = Math.min(entry.dueDay, lastDay)
    }
    if (!Number.isInteger(day) || day < 1 || day > lastDay) return []
    const tone: ScheduleTone = entry.kind === 'card' ? 'card' : entry.kind === 'loan' ? 'loan'
      : /electric|water|internet|wifi|gas|utility/i.test(`${entry.name} ${entry.category || ''}`) ? 'utility' : 'other'
    return [{ entry, day, amount: entry.kind === 'bill' ? entry.amount || 0 : entry.budget || 0, tone }]
  }).sort((a, b) => a.day - b.day || a.entry.name.localeCompare(b.entry.name))
}
