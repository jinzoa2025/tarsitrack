import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { User } from '@supabase/supabase-js'
import { ArrowsClockwise, Check, CloudArrowUp, DotsThree, DownloadSimple, House, CalendarDots, ChartBar, Plus, Receipt, UploadSimple, List, ShoppingBag } from '@phosphor-icons/react'
import { active, accountDb, guestDb, isoDate, loadDemo, removeEntry, saveEntry, type Entry, type Kind, type TrackerDB } from './lib/data'
import { supabase, synchronize } from './lib/sync'
import { EntryForm, type FormConfig } from './EntryForm'
import { ActivityView, HomeView, PlanningView, type PlanningTab } from './Views'
import { Row, SectionHead, SproutMark } from './ui'
import './App.css'

type Page = 'home' | 'activity' | 'planning' | 'reports' | 'more'
const ReportsView = lazy(() => import('./ReportsView'))
const nav = [
  { id: 'home' as Page, label: 'Home', icon: House },
  { id: 'activity' as Page, label: 'Activity', icon: Receipt },
  { id: 'planning' as Page, label: 'Planning', icon: CalendarDots },
  { id: 'reports' as Page, label: 'Reports', icon: ChartBar },
  { id: 'more' as Page, label: 'More', icon: DotsThree },
]

function AuthPanel({ user, onSync }: { user: User | null; onSync: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)
  if (!supabase) return null
  async function authenticate(mode: 'login' | 'signup') {
    if (!supabase) return
    setWorking(true); setMessage('')
    const { error } = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setMessage(error?.message || (mode === 'signup' ? 'Check your email to confirm the account.' : 'Signed in.'))
    setWorking(false)
  }
  return user ? <div className="auth-actions"><button className="subtle-button" onClick={onSync}><ArrowsClockwise size={16} /> Sync now</button><button className="text-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div> : <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void authenticate('login') }}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><div className="auth-actions"><button className="primary-button" disabled={working}>Sign in</button><button type="button" className="subtle-button" disabled={working} onClick={() => void authenticate('signup')}>Create account</button></div>{message && <p className="form-message">{message}</p>}</form>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const userId = user?.id
  const db = useMemo<TrackerDB>(() => userId ? accountDb(userId) : guestDb, [userId])
  const [page, setPage] = useState<Page>('home')
  const [tab, setTab] = useState<PlanningTab>('paydays')
  const [form, setForm] = useState<FormConfig | null>(null)
  const [selectedCycle, setSelectedCycle] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncMessage, setSyncMessage] = useState('Saved on this device')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const syncBusy = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const entries = useLiveQuery(() => db.entries.toArray(), [db])
  const conflicts = useLiveQuery(() => db.conflicts.toArray(), [db]) || []
  const all = useMemo(() => active(entries), [entries])
  const paydays = useMemo(() => all.filter((item) => item.kind === 'payday').sort((a, b) => (b.date || '').localeCompare(a.date || '')), [all])
  const transactions = useMemo(() => all.filter((item) => item.kind === 'transaction').sort((a, b) => (b.date || '').localeCompare(a.date || '')), [all])
  const cycle = paydays.find((item) => item.id === selectedCycle) || paydays.find((item) => transactions.some((tx) => tx.paydayId === item.id && tx.transactionType === 'income')) || paydays[0]
  const pending = entries?.filter((item) => item.syncStatus === 'pending').length || 0

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => () => { if (db !== guestDb) db.close() }, [db])

  const runSync = useCallback(async () => {
    if (!userId || !supabase || syncBusy.current || !navigator.onLine) return
    syncBusy.current = true
    setSyncMessage('Syncing changes…')
    try {
      const result = await synchronize(db, userId)
      setSyncMessage(result.conflicts ? `${result.conflicts} changes need review` : 'Synced just now')
    } catch (error) {
      setSyncMessage(error instanceof Error ? `Sync paused: ${error.message}` : 'Sync paused')
    } finally { syncBusy.current = false }
  }, [db, userId])
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) void runSync() }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const timer = window.setInterval(() => { if (navigator.onLine) void runSync() }, 30000)
    const firstSync = userId ? window.setTimeout(() => void runSync(), 0) : undefined
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.clearInterval(timer); if (firstSync !== undefined) window.clearTimeout(firstSync) }
  }, [runSync, userId])

  function open(kind: Kind, entry?: Entry, preset?: Partial<Entry>) {
    const cyclePreset = !entry && (kind === 'transaction' || kind === 'plan') ? { paydayId: cycle?.id, ...preset } : preset
    setForm({ kind, entry, preset: cyclePreset })
  }
  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  async function save(values: Partial<Entry>) {
    if (!form) return
    if (form.kind === 'plan') {
      const next = { ...form.entry, ...form.preset, ...values }
      if (all.some((item) => item.kind === 'plan' && item.id !== form.entry?.id && item.paydayId === next.paydayId && item.category?.toLowerCase() === next.category?.toLowerCase())) {
        toast('A plan for that payday and category already exists')
        return
      }
    }
    setBusy(true)
    try {
      await saveEntry(db, { ...form.entry, ...form.preset, ...values, kind: form.kind, name: values.name?.trim() || 'Untitled' })
      setForm(null)
      toast('Saved on this device')
      if (user) void runSync()
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not save') }
    finally { setBusy(false) }
  }
  async function toggleBillReminder(item: Entry, enabled: boolean) {
    try {
      await saveEntry(db, { ...item, remindDays: enabled ? [7, 3, 1, 0] : [] })
      toast(enabled ? 'Reminders enabled' : 'Reminders paused')
      if (user) void runSync()
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not update reminder') }
  }
  async function deleteItem(entry: Entry) {
    if (!window.confirm(`Delete “${entry.name}”?`)) return
    await removeEntry(db, entry)
    setForm(null)
    toast('Deleted on this device')
    if (user) void runSync()
  }
  async function exportBackup() {
    const rows = await db.entries.toArray()
    const blob = new Blob([JSON.stringify({ format: 'tarsitrack-v1', exportedAt: new Date().toISOString(), entries: rows }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `tarsitrack-backup-${isoDate()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  async function importBackup(file?: File) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; entries?: Entry[] }
      if (parsed.format !== 'tarsitrack-v1' || !Array.isArray(parsed.entries)) throw new Error('This is not a TarsiTrack backup')
      const valid = parsed.entries.filter((item) => item && typeof item.id === 'string' && item.id.length === 36 && typeof item.kind === 'string' && typeof item.name === 'string')
      if (valid.length !== parsed.entries.length) throw new Error('The backup contains invalid records')
      await db.entries.bulkPut(valid.map((item) => ({ ...item, syncStatus: 'pending' as const, baseVersion: 0, updatedAt: new Date().toISOString() })))
      toast(`Imported ${valid.length} records`)
      if (user) void runSync()
    } catch (error) { toast(error instanceof Error ? error.message : 'Import failed') }
    if (fileRef.current) fileRef.current.value = ''
  }
  const title = page === 'home' ? 'Loans & Cards' : page === 'activity' ? 'Expenses' : page === 'planning' ? ({ paydays: 'Payday Details', bills: 'Bills Calendar', accounts: 'Loans & Cards', wishlist: 'Desires to Buy', savings: 'Savings Goals', rules: 'Auto Rules' } as Record<PlanningTab, string>)[tab] : page === 'reports' ? 'Reports' : 'More'
  return <div className="app-shell">
    <aside className="desktop-sidebar"><div className="brand"><span className="brand-mark"><SproutMark size={33} /></span><span><strong>Tarsi<span>Track</span></strong><small>Family finance, in focus</small></span></div><div className="sidebar-label">WORKSPACE</div><nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'side-link active' : 'side-link'} onClick={() => setPage(id)}><Icon size={21} weight={page === id ? 'fill' : 'regular'} />{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-quote">Small steps.<br /><em>Brighter tomorrows.</em></div><div className="sync-mini"><span className={online ? 'status-dot' : 'status-dot offline'} />{online ? (user ? syncMessage : 'Local mode') : 'Offline · saved locally'}</div></div></aside>
    <div className="main-column"><header className="topbar"><button className="mobile-menu" aria-label="Open more" onClick={() => setPage('more')}><List size={21} /></button><div className="topbar-title"><div className="mobile-brand"><SproutMark size={20} /> TarsiTrack</div><p className="eyebrow">YOUR FAMILY FINANCES</p><h1>{title}</h1></div><div className="top-actions"><span className="top-sync"><span className={online ? 'status-dot' : 'status-dot offline'} />{online ? (user ? syncMessage : 'On this device') : 'Offline · saved locally'}</span><button className="icon-button" aria-label="Add entry" onClick={() => open('transaction')}><Plus size={21} /></button><button className="mobile-avatar" aria-label="Open more" onClick={() => setPage('more')}><SproutMark size={21} /></button></div></header>
      <main><div className="screen-content" key={page}>
        {page === 'home' && <HomeView all={all} open={open} paydays={paydays} transactions={transactions} cycle={cycle} selectedCycle={selectedCycle} selectCycle={setSelectedCycle} go={(next, nextTab) => { setPage(next); if (nextTab) setTab(nextTab) }} loadSample={() => void loadDemo(db).then(() => toast('Sample data loaded'))} />}
        {page === 'activity' && <ActivityView all={all} open={open} transactions={transactions} cycle={cycle} />}
        {page === 'planning' && <PlanningView all={all} open={open} tab={tab} setTab={setTab} cycle={cycle} paydays={paydays} onToggleReminder={(item, enabled) => void toggleBillReminder(item, enabled)} />}
        {page === 'reports' && <Suspense fallback={<div className="panel">Loading reports…</div>}><ReportsView all={all} paydays={paydays} transactions={transactions} /></Suspense>}
        {page === 'more' && <section className="page-section"><div className="page-intro"><div><p className="eyebrow">YOUR SPACE</p><h2>Keep your data close.</h2><p>Back up your records, review sync and customize categories.</p></div></div><div className="planning-grid"><section className="panel"><SectionHead title="Explore" /><div className="action-stack"><button className="action-row" onClick={() => setPage('reports')}><ChartBar size={22} /> Reports</button><button className="action-row" onClick={() => { setPage('planning'); setTab('wishlist') }}><ShoppingBag size={22} /> Desires to Buy</button></div></section><section className="panel"><SectionHead title="Data & backup" /><p className="muted">Your normal entries save to this device immediately. Export a JSON backup whenever you want a separate copy.</p><div className="action-stack"><button className="action-row" onClick={exportBackup}><DownloadSimple size={22} /> Export backup</button><button className="action-row" onClick={() => fileRef.current?.click()}><UploadSimple size={22} /> Import backup</button><input hidden ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} /></div></section><section className="panel"><SectionHead title="Cloud sync" /><p className="muted">{supabase ? user ? `Signed in as ${user.email}. This account has a separate device database.` : 'Sign in to sync an account across your devices. Guest data stays separate.' : 'Cloud sync is available after a Supabase project is configured. Local tracking works now.'}</p><div className="sync-card"><CloudArrowUp size={24} /><div><strong>{online ? syncMessage : 'Offline · changes saved here'}</strong><small>{pending} pending changes · {conflicts.length} conflicts</small></div></div>{supabase && <AuthPanel user={user} onSync={() => void runSync()} />}{conflicts.map((conflict) => <div className="conflict-card" key={conflict.id}><strong>Review: {conflict.local.name}</strong><p>Device and cloud both changed this record.</p><div><button onClick={async () => { await db.entries.put({ ...conflict.local, baseVersion: conflict.remote.baseVersion, syncStatus: 'pending' }); await db.conflicts.delete(conflict.id); void runSync() }}>Use device</button><button onClick={async () => { await db.entries.put(conflict.remote); await db.conflicts.delete(conflict.id) }}>Use cloud</button></div></div>)}</section><section className="panel"><SectionHead title="Categories" action="Add category" onAction={() => open('category')} /><div className="category-cloud">{Array.from(new Set(['Food', 'Family', 'Utilities', 'Transport', 'Health', 'Shopping', 'Loans', 'Cards', ...all.filter((item) => item.kind === 'category').map((item) => item.name)])).map((name) => <span key={name}>{name}</span>)}</div>{all.filter((item) => item.kind === 'category').map((item) => <Row key={item.id} item={item} onClick={() => open('category', item)} />)}</section></div></section>}
      </div></main></div>
    <nav className="bottom-nav" aria-label="Mobile navigation"><button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}><House size={21} weight={page === 'home' ? 'fill' : 'regular'} /><span>Home</span></button><button className={page === 'activity' ? 'active' : ''} onClick={() => setPage('activity')}><Receipt size={21} weight={page === 'activity' ? 'fill' : 'regular'} /><span>Expenses</span></button><button className="mobile-add" aria-label="Add entry" onClick={() => open('transaction')}><Plus size={28} /></button><button className={page === 'planning' && tab === 'bills' ? 'active' : ''} onClick={() => { setPage('planning'); setTab('bills') }}><CalendarDots size={21} weight={page === 'planning' && tab === 'bills' ? 'fill' : 'regular'} /><span>Bills</span></button><button className={page === 'more' || page === 'reports' || (page === 'planning' && tab !== 'bills') ? 'active' : ''} onClick={() => setPage('more')}><DotsThree size={21} weight={page === 'more' || page === 'reports' || (page === 'planning' && tab !== 'bills') ? 'fill' : 'regular'} /><span>More</span></button></nav>
    {form && <EntryForm key={form.entry?.id || `${form.kind}-${form.preset?.accountId || ''}`} config={form} all={all} busy={busy} onClose={() => setForm(null)} onSave={save} onDelete={form.entry ? () => void deleteItem(form.entry!) : undefined} />}
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
  </div>
}
