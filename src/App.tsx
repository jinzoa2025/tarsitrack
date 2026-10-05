import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, ArrowsClockwise, Bank, CalendarDots, ChartBar, Check, ClockCounterClockwise, CloudArrowUp, DotsThree, DownloadSimple, GearSix, List, LockKey, Receipt, ShieldCheck, ShoppingBag, Target, UploadSimple } from '@phosphor-icons/react'
import { active, accountDb, guestDb, isoDate, loadDemo, removeEntry, saveEntry, type Entry, type Kind, type TrackerDB } from './lib/data'
import { copyRows, isSheet, isTemplate, sheetTemplate, templateName } from './lib/paydaySheet'
import type { ScheduleItem } from './lib/schedule'
import { supabase, synchronize } from './lib/sync'
import { EntryForm, type FormConfig } from './EntryForm'
import { ActivityView, HomeView, PlanningView, type PlanningTab } from './Views'
import { BillsPage, HistoryPage, PaydayPage, ReportsPage, TemplatePage, TrackerMark } from './SimpleTracker'
import { Row, SectionHead } from './ui'
import './App.css'
import './TrackerSimple.css'

type Page = 'home' | 'history' | 'bills' | 'reports' | 'template' | 'more' | 'activity' | 'planning' | 'legacyHome' | 'legacyReports'
const DetailedReports = lazy(() => import('./ReportsView'))
const nav = [
  { id: 'home' as Page, label: 'Payday', icon: Receipt },
  { id: 'history' as Page, label: 'History', icon: ClockCounterClockwise },
  { id: 'bills' as Page, label: 'Bills', icon: CalendarDots },
  { id: 'more' as Page, label: 'More', icon: DotsThree },
]

async function downloadBackup(source: TrackerDB, guest = false) {
  const rows = await source.entries.toArray()
  const blob = new Blob([JSON.stringify({ format: 'tarsitrack-v1', exportedAt: new Date().toISOString(), entries: rows }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `tracker-${guest ? 'earlier-guest-' : ''}backup-${isoDate()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function AuthPanel({ onSync }: { onSync: () => void }) {
  const guestCount = useLiveQuery(() => guestDb.entries.count(), []) || 0
  return <><div className="auth-actions"><button className="subtle-button" onClick={onSync}><ArrowsClockwise size={16} /> Sync now</button><button className="text-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>{guestCount > 0 && <div className="guest-backup"><p>{guestCount} earlier guest records are still on this device. Export them, then use Import backup to copy them into your account.</p><button className="subtle-button" onClick={() => void downloadBackup(guestDb, true)}><DownloadSimple size={16} /> Export earlier records</button></div>}</>
}

function AuthGate({ loading }: { loading: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setWorking(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage(error.message)
      else setPassword('')
    } catch { setMessage('Could not reach sign-in. Check your connection and try again.') }
    finally { setWorking(false) }
  }
  return <div className="auth-screen"><div className="auth-glow" aria-hidden="true" /><div className="auth-layout">
    <section className="auth-story" aria-label="Tracker"><div className="auth-brand"><span className="auth-brand-mark"><TrackerMark size={45} /></span><span><strong>Tracker</strong><small>Family finance, made clearer</small></span></div><div className="auth-story-copy"><p className="eyebrow">YOUR FAMILY FINANCES</p><h1>Every payday,<br /><em>in its place.</em></h1><p>Simple sheets for today. A clear view of the months ahead.</p></div><div className="auth-story-foot"><ShieldCheck size={20} /> Your records stay with your account and this device.</div></section>
    <section className="auth-card"><div className="auth-lock"><LockKey size={25} weight="duotone" /></div><p className="eyebrow">PRIVATE WORKSPACE</p><h2>Welcome back</h2><p className="auth-description">Sign in to open your family finance tracker.</p>{loading ? <p className="auth-state" role="status">Checking your session…</p> : !supabase ? <p className="auth-state" role="alert">Sign-in is unavailable until the Supabase project is configured.</p> : <form className="auth-gate-form" onSubmit={(event) => void signIn(event)}><label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="auth-submit" disabled={working}>{working ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button>{message && <p className="auth-error" role="alert">{message}</p>}</form>}<div className="auth-card-foot"><span className="status-dot" /> Offline access remains available on a device with an active session.</div></section>
  </div></div>
}

export default function App() {
  const [session, setSession] = useState<{ ready: boolean; user: User | null }>(() => ({ ready: !supabase, user: null }))
  useEffect(() => {
    if (!supabase) return
    let mounted = true
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession({ ready: true, user: next?.user || null }) })
    void supabase.auth.getSession().then(({ data }) => { if (mounted) setSession((current) => current.ready ? current : { ready: true, user: data.session?.user || null }) }).catch(() => { if (mounted) setSession((current) => current.ready ? current : { ready: true, user: null }) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])
  if (!session.ready || !session.user) return <AuthGate loading={!session.ready} />
  return <Workspace key={session.user.id} user={session.user} />
}

function Workspace({ user }: { user: User }) {
  const db = useMemo<TrackerDB>(() => accountDb(user.id), [user.id])
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
  const simpleSheets = useMemo(() => paydays.filter(isSheet), [paydays])
  const transactions = useMemo(() => all.filter((item) => item.kind === 'transaction').sort((a, b) => (b.date || '').localeCompare(a.date || '')), [all])
  const cycle = paydays.find((item) => item.id === selectedCycle) || paydays.find((item) => transactions.some((tx) => tx.paydayId === item.id && tx.transactionType === 'income')) || paydays[0]
  const simpleSheet = simpleSheets.find((item) => item.id === selectedCycle) || simpleSheets[0]
  const pending = entries?.filter((item) => item.syncStatus === 'pending').length || 0
  useEffect(() => () => db.close(), [db])

  const runSync = useCallback(async () => {
    if (!supabase || syncBusy.current || !navigator.onLine) return
    syncBusy.current = true
    setSyncMessage('Syncing changes…')
    try { const result = await synchronize(db, user.id); setSyncMessage(result.conflicts ? `${result.conflicts} changes need review` : 'Synced just now') }
    catch (error) { setSyncMessage(error instanceof Error ? `Sync paused: ${error.message}` : 'Sync paused') }
    finally { syncBusy.current = false }
  }, [db, user.id])
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) void runSync() }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const timer = window.setInterval(() => { if (navigator.onLine) void runSync() }, 30000)
    const firstSync = window.setTimeout(() => void runSync(), 0)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.clearInterval(timer); window.clearTimeout(firstSync) }
  }, [runSync])

  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  function open(kind: Kind, entry?: Entry, preset?: Partial<Entry>) {
    const cyclePreset = !entry && (kind === 'transaction' || kind === 'plan') ? { paydayId: cycle?.id, ...preset } : preset
    setForm({ kind, entry, preset: cyclePreset })
  }
  async function newSheet() {
    try {
      const template = sheetTemplate(all)
      const date = isoDate()
      const created = await saveEntry(db, { kind: 'payday', name: `${date} payday`, date, sheetTitheRate: template.rate, sheetRows: copyRows(template.rows) })
      setSelectedCycle(created.id); setPage('home'); toast('Payday sheet created'); void runSync()
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not create payday') }
  }
  async function saveSheet(sheet: Entry, values: Partial<Entry>) {
    try { await saveEntry(db, { ...sheet, ...values, kind: 'payday', name: `${values.date || sheet.date || 'New'} payday` }); toast('Payday saved'); void runSync() }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save payday'); throw error }
  }
  async function saveTemplate(values: Partial<Entry>, existing?: Entry) {
    try { const template = existing || (await db.entries.where('kind').equals('category').filter(isTemplate).first()); await saveEntry(db, { ...template, ...values, kind: 'category', name: templateName, sheetTemplate: true }); toast('Template saved'); void runSync() }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save template'); throw error }
  }
  function recordScheduled(item: ScheduleItem) {
    const { entry, amount } = item
    open('transaction', undefined, { name: entry.kind === 'bill' ? entry.name : `${entry.name} payment`, amount, date: isoDate(), category: entry.kind === 'loan' ? 'Loans' : entry.kind === 'card' ? 'Cards' : entry.category, transactionType: entry.kind === 'loan' ? 'loan_payment' : entry.kind === 'card' ? 'card_payment' : 'expense', accountId: entry.id, paydayId: cycle?.id })
  }
  async function save(values: Partial<Entry>) {
    if (!form) return
    if (form.kind === 'plan') {
      const next = { ...form.entry, ...form.preset, ...values }
      if (all.some((item) => item.kind === 'plan' && item.id !== form.entry?.id && item.paydayId === next.paydayId && item.category?.toLowerCase() === next.category?.toLowerCase())) { toast('A plan for that payday and category already exists'); return }
    }
    setBusy(true)
    try { await saveEntry(db, { ...form.entry, ...form.preset, ...values, kind: form.kind, name: values.name?.trim() || 'Untitled' }); setForm(null); toast('Saved on this device'); void runSync() }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save') }
    finally { setBusy(false) }
  }
  async function toggleBillReminder(item: Entry, enabled: boolean) {
    try { await saveEntry(db, { ...item, remindDays: enabled ? [7, 3, 1, 0] : [] }); toast(enabled ? 'Reminders enabled' : 'Reminders paused'); void runSync() }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not update reminder') }
  }
  async function deleteItem(entry: Entry) {
    if (!window.confirm(`Delete “${entry.name}”?`)) return
    await removeEntry(db, entry); setForm(null); toast('Deleted on this device'); void runSync()
  }
  async function importBackup(file?: File) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; entries?: Entry[] }
      if (parsed.format !== 'tarsitrack-v1' || !Array.isArray(parsed.entries)) throw new Error('This is not a Tracker backup')
      const valid = parsed.entries.filter((item) => item && typeof item.id === 'string' && item.id.length === 36 && typeof item.kind === 'string' && typeof item.name === 'string')
      if (valid.length !== parsed.entries.length) throw new Error('The backup contains invalid records')
      await db.entries.bulkPut(valid.map((item) => ({ ...item, syncStatus: 'pending' as const, baseVersion: 0, updatedAt: new Date().toISOString() })))
      toast(`Imported ${valid.length} records`); void runSync()
    } catch (error) { toast(error instanceof Error ? error.message : 'Import failed') }
    if (fileRef.current) fileRef.current.value = ''
  }

  const title = page === 'home' ? 'Payday' : page === 'history' ? 'History' : page === 'bills' ? 'Bills' : page === 'reports' || page === 'legacyReports' ? 'Reports' : page === 'template' ? 'Template' : page === 'activity' ? 'Detailed expenses' : page === 'legacyHome' ? 'Loans & cards' : page === 'planning' ? ({ paydays: 'Payday details', bills: 'Bills calendar', accounts: 'Loans & cards', wishlist: 'Wishlist', savings: 'Savings goals', rules: 'Auto rules' } as Record<PlanningTab, string>)[tab] : 'More'
  const currentNav = ['home', 'history', 'bills'].includes(page) ? page : 'more'
  const visibleCategories = all.filter((item) => item.kind === 'category' && !isTemplate(item))
  return <div className="app-shell tracker-shell">
    <aside className="desktop-sidebar"><div className="brand"><TrackerMark size={43} /><span><strong>Tracker</strong><small>Family finance, made clearer</small></span></div><div className="sidebar-label">Your space</div><nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={currentNav === id ? 'side-link active' : 'side-link'} onClick={() => setPage(id)}><Icon size={21} weight={currentNav === id ? 'fill' : 'regular'} />{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-quote">Every payday,<br /><em>in its place.</em></div><div className="sync-mini"><span className={online ? 'status-dot' : 'status-dot offline'} />{online ? syncMessage : 'Offline · saved locally'}</div></div></aside>
    <div className="main-column"><header className="topbar"><button className="mobile-menu" aria-label="Open more" onClick={() => setPage('more')}><List size={21} /></button><div className="topbar-title"><div className="mobile-brand"><TrackerMark size={22} /> Tracker</div><p className="eyebrow">FAMILY FINANCES</p><h1>{title}</h1></div><span className="top-sync"><span className={online ? 'status-dot' : 'status-dot offline'} />{online ? syncMessage : 'Offline · saved locally'}</span></header>
      <main><div className="screen-content" key={page}>
        {page === 'home' && <PaydayPage sheet={simpleSheet} all={all} onNew={() => void newSheet()} onSave={saveSheet} onSelect={setSelectedCycle} onHistory={() => setPage('history')} onTemplate={() => setPage('template')} />}
        {page === 'history' && <HistoryPage sheets={simpleSheets} onOpen={(id) => { setSelectedCycle(id); setPage('home') }} onNew={() => void newSheet()} />}
        {page === 'bills' && <BillsPage all={all} onAdd={() => open('bill')} onEdit={(entry) => open(entry.kind, entry)} onPay={recordScheduled} />}
        {page === 'reports' && <ReportsPage sheets={simpleSheets} />}
        {page === 'template' && <TemplatePage all={all} onSave={saveTemplate} onBack={() => setPage('more')} />}
        {page === 'legacyHome' && <HomeView all={all} open={open} paydays={paydays} transactions={transactions} cycle={cycle} selectedCycle={selectedCycle} selectCycle={setSelectedCycle} go={(next, nextTab) => { setPage(next); if (nextTab) setTab(nextTab) }} loadSample={() => void loadDemo(db).then(() => toast('Sample data loaded'))} />}
        {page === 'activity' && <ActivityView all={all} open={open} transactions={transactions} cycle={cycle} />}
        {page === 'planning' && <PlanningView all={all} open={open} tab={tab} setTab={setTab} cycle={cycle} paydays={paydays} onToggleReminder={(item, enabled) => void toggleBillReminder(item, enabled)} />}
        {page === 'legacyReports' && <Suspense fallback={<div className="panel">Loading reports…</div>}><DetailedReports all={all} paydays={paydays} transactions={transactions} /></Suspense>}
        {page === 'more' && <section className="simple-page simple-more"><div className="simple-page-heading"><div><h2>More</h2><p>Useful tools, kept out of the daily path.</p></div></div><div className="simple-more-banner"><strong>Only what you need, when you need it.</strong><p>Your payday sheet stays first. The detailed tools are here.</p></div><h3>Payday setup</h3><div className="simple-more-menu"><button onClick={() => setPage('template')}><GearSix size={20} /> Payday template <ArrowRight size={16} /></button><button onClick={() => setPage('reports')}><ChartBar size={20} /> Reports by payday, month or year <ArrowRight size={16} /></button></div><h3>Detailed tools</h3><div className="simple-more-menu"><button onClick={() => setPage('legacyHome')}><Bank size={20} /> Loans & cards <ArrowRight size={16} /></button><button onClick={() => setPage('activity')}><Receipt size={20} /> Paid expenses & income <ArrowRight size={16} /></button><button onClick={() => { setPage('planning'); setTab('wishlist') }}><ShoppingBag size={20} /> Wishlist <ArrowRight size={16} /></button><button onClick={() => { setPage('planning'); setTab('savings') }}><Target size={20} /> Savings goals <ArrowRight size={16} /></button><button onClick={() => { setPage('planning'); setTab('rules') }}><ArrowsClockwise size={20} /> Auto rules <ArrowRight size={16} /></button><button onClick={() => setPage('legacyReports')}><ChartBar size={20} /> Detailed transaction reports <ArrowRight size={16} /></button></div><h3>Account & data</h3><div className="simple-support-grid"><section className="panel"><SectionHead title="Backup" /><p className="muted">Download a copy of your records or import an earlier backup.</p><div className="action-stack"><button className="action-row" onClick={() => void downloadBackup(db)}><DownloadSimple size={20} /> Export backup</button><button className="action-row" onClick={() => fileRef.current?.click()}><UploadSimple size={20} /> Import backup</button><input hidden ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} /></div></section><section className="panel"><SectionHead title="Cloud sync" /><p className="muted">Signed in as {user.email}.</p><div className="sync-card"><CloudArrowUp size={22} /><div><strong>{online ? syncMessage : 'Offline · changes saved here'}</strong><small>{pending} pending · {conflicts.length} conflicts</small></div></div><AuthPanel onSync={() => void runSync()} />{conflicts.map((conflict) => <div className="conflict-card" key={conflict.id}><strong>Review: {conflict.local.name}</strong><p>Device and cloud both changed this record.</p><div><button onClick={async () => { await db.entries.put({ ...conflict.local, baseVersion: conflict.remote.baseVersion, syncStatus: 'pending' }); await db.conflicts.delete(conflict.id); void runSync() }}>Use device</button><button onClick={async () => { await db.entries.put(conflict.remote); await db.conflicts.delete(conflict.id) }}>Use cloud</button></div></div>)}</section><section className="panel"><SectionHead title="Categories" action="Add category" onAction={() => open('category')} /><div className="category-cloud">{Array.from(new Set(['Food', 'Family', 'Utilities', 'Transport', 'Health', 'Shopping', 'Loans', 'Cards', ...visibleCategories.map((item) => item.name)])).map((name) => <span key={name}>{name}</span>)}</div>{visibleCategories.map((item) => <Row key={item.id} item={item} onClick={() => open('category', item)} />)}</section></div></section>}
      </div></main></div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={currentNav === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={21} weight={currentNav === id ? 'fill' : 'regular'} /><span>{label}</span></button>)}</nav>
    {form && <EntryForm key={form.entry?.id || `${form.kind}-${form.preset?.accountId || ''}`} config={form} all={all.filter((entry) => !isTemplate(entry))} busy={busy} onClose={() => setForm(null)} onSave={save} onDelete={form.entry ? () => void deleteItem(form.entry!) : undefined} />}
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
  </div>
}
