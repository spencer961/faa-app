import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { supabase } from '../lib/supabase.js'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { aggregate, METRICS, fmtVal } from '../lib/metrics.js'
import { health } from '../lib/successMap.js'
import { DEFAULT_TIERS, TIER_PALETTE, getClientTiers as getTiers } from '../lib/tiers.js'

// Command center — migrated from dashboard.html (Pass 1: client directory,
// quick-launch links/files, and client info detail view).
// Links are stored in the app_state record (same as the original).
// Deferred to later passes: mission-control cards + view toggles (Pass 2),
// client-info editing, billing/payments entry, notifications, and the
// magic-link admin gate (real login comes with the auth step).

const STATE_ID = 'gmj_main'
const CAT_PALETTE = [
  { bg: '#E6F1FB', border: '#1a7fd4', txt: '#0C447C' },
  { bg: '#FAEEDA', border: '#e07b0a', txt: '#633806' },
  { bg: '#E1F5EE', border: '#18a866', txt: '#085041' },
  { bg: '#FDEEF6', border: '#f0359a', txt: '#8C1A5A' },
  { bg: '#F0EDFB', border: '#9B7FE8', txt: '#5A3DAA' },
  { bg: '#EAF3DE', border: '#4a9e12', txt: '#274F0A' },
  { bg: '#F1EFE8', border: '#6b6966', txt: '#444441' },
]
const catColor = (cat) => { let h = 0; for (const ch of String(cat || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CAT_PALETTE[h % CAT_PALETTE.length] }
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
// Short name for the compact filter: a custom info.abbr if set, else the
// acronym of the client's name.
const abbrOf = (c) => {
  if (c?.info?.abbr && c.info.abbr.trim()) return c.info.abbr.trim()
  const words = String(c?.name || '').split(/\s+/).filter(Boolean)
  if (words.length <= 1) return (words[0] || '').slice(0, 6).toUpperCase()
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 6)
}
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const websiteUrl = (v) => { const s = String(v || '').trim(); if (!s) return ''; return /^https?:\/\//i.test(s) ? s : 'https://' + s }
const staffList = (info) => { let s = info?.staff; if (!s) return []; try { if (typeof s === 'string') s = JSON.parse(s) } catch { return [String(info.staff)] } return Array.isArray(s) ? s : [s] }

// Practices/locations live at info.practices. Some older records nest the
// text fields (doctor, staff, notes…) one level deeper at info.info — read
// both so nothing shows blank.
const getPractices = (c) => (Array.isArray(c?.info?.practices) ? c.info.practices.filter(Boolean) : [])
// Flat value wins (edits are written flat at info.x); legacy nested
// info.info.x is the fallback so old data still shows until it's re-saved.
const infoField = (c, k) => (c?.info?.[k] ?? c?.info?.info?.[k] ?? '')
const parseStaff = (c) => {
  let s = c?.info?.staff ?? c?.info?.info?.staff
  if (!s) return []
  try { if (typeof s === 'string') s = JSON.parse(s) } catch { return [] }
  return Array.isArray(s) ? s.map((x) => (typeof x === 'object' ? { name: x.name || '', title: x.title || x.role || '', phone: x.phone || '', email: x.email || '' } : { name: String(x), title: '', phone: '', email: '' })) : []
}
const PRACTICE_PALETTE = [
  { bg: '#E6F1FB', txt: '#0C447C' }, { bg: '#FAEEDA', txt: '#633806' }, { bg: '#E1F5EE', txt: '#085041' },
  { bg: '#FDEEF6', txt: '#8C1A5A' }, { bg: '#F0EDFB', txt: '#5A3DAA' }, { bg: '#EAF3DE', txt: '#274F0A' },
]
const practiceColor = (name) => { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PRACTICE_PALETTE[h % PRACTICE_PALETTE.length] }
// Location tabs exclude a practice that just repeats the client's own name —
// "All" already covers it (e.g. "4M Dental Implant Center").
const tabPractices = (c) => getPractices(c).filter((p) => p !== c.name)

// Billing status for the accounting panel.
const billingStatus = (billing, lastPay) => {
  const day = billing?.billingDay ? parseInt(billing.billingDay) : null
  if (!day) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(today.getFullYear(), today.getMonth(), day)
  const lastPayDate = lastPay?.date ? new Date(lastPay.date + 'T12:00:00') : null
  if (lastPayDate && lastPayDate >= due) return { label: '✓ Paid this cycle', color: '#3B6D11' }
  if (today > due) { const d = Math.floor((today - due) / 86400000); return { label: `⚠ ${d} day${d !== 1 ? 's' : ''} past due`, color: '#A32D2D' } }
  const d = Math.floor((due - today) / 86400000); return { label: `Due in ${d} day${d !== 1 ? 's' : ''}`, color: MUTED }
}


const INFO_FIELDS = [
  ['doctor', 'Doctor / primary contact'], ['timezone', 'Time zone'], ['website', 'Website'],
  ['numLocations', 'No. of locations'], ['locations', 'Practice location names'],
]

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [links, setLinks] = useState([])
  const [appData, setAppData] = useState({})
  const [filter, setFilter] = useState('all')
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [compactFilter, setCompactFilter] = useState(() => { try { const v = localStorage.getItem('faa_dash_compact'); return v === null ? true : v === '1' } catch { return true } })
  const [editMode, setEditMode] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [linkModal, setLinkModal] = useState(null) // {id?, clientId}
  const [toast, setToast] = useState('')
  const [tasks, setTasks] = useState([])
  const [cardPractice, setCardPractice] = useState({}) // {clientId: activePracticeName}
  const [accModal, setAccModal] = useState(null) // {type:'record'|'history'|'billing', clientId}
  const [clientMode, setClientMode] = useState(() => { try { const v = localStorage.getItem('faa_client_mode'); return v ? parseInt(v) : null } catch { return null } })
  const [selectModal, setSelectModal] = useState(false)
  const [endModal, setEndModal] = useState(false)
  const [addClientModal, setAddClientModal] = useState(false)
  const [metricsByClient, setMetricsByClient] = useState({})
  const [snaps] = useState(() => { try { return JSON.parse(localStorage.getItem('faa_success_snapshots')) || {} } catch { return {} } })
  const [toggles, setToggles] = useState(() => { try { return { todos: true, progress: true, metrics: true, accounting: false, ...(JSON.parse(localStorage.getItem('faa_dash_toggles') || '{}')) } } catch { return { todos: true, progress: true, metrics: true, accounting: false } } })
  const navigate = useNavigate()
  const toggleLayer = (k) => setToggles((t) => { const n = { ...t, [k]: !t[k] }; try { localStorage.setItem('faa_dash_toggles', JSON.stringify(n)) } catch { /* ignore */ } return n })

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('*').order('id')
      if (Array.isArray(cs)) setClients(cs.map((r) => ({ ...r, info: r.info || {} })))
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      if (st?.data) { setAppData(st.data); if (Array.isArray(st.data.links)) setLinks(st.data.links); if (Array.isArray(st.data.tiers) && st.data.tiers.length) setTiers(st.data.tiers) }
      const { data: ts } = await supabase.from('tasks').select('client_id,status')
      if (Array.isArray(ts)) setTasks(ts)
      const { data: mrows } = await supabase.from('metrics_tracker').select('client_id,period,date_key,data')
      if (Array.isArray(mrows)) {
        const by = {}
        mrows.filter((r) => r.period === 'daily').forEach((r) => { by[r.client_id] = by[r.client_id] || {}; by[r.client_id][r.date_key] = r.data || {} })
        setMetricsByClient(by)
      }
    })()
  }, [])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const toggleCompact = () => setCompactFilter((v) => { const n = !v; try { localStorage.setItem('faa_dash_compact', n ? '1' : '0') } catch { /* ignore */ } return n })
  const enterClientMode = (id) => { setClientMode(id); try { localStorage.setItem('faa_client_mode', String(id)) } catch { /* ignore */ } setSelectModal(false); setDetailId(null); setEditMode(false) }
  const exitClientMode = () => { setClientMode(null); try { localStorage.removeItem('faa_client_mode') } catch { /* ignore */ } setEndModal(false) }

  async function persistLinks(next) {
    setLinks(next)
    const data = { ...appData, links: next }
    setAppData(data)
    await supabase.from('app_state').upsert({ id: STATE_ID, data, updated_at: new Date().toISOString() })
  }
  async function saveLink(form) {
    if (!form.label.trim()) return
    const practice = form.practice || null
    let next
    if (form.id) next = links.map((l) => (l.id === form.id ? { ...l, label: form.label.trim(), category: form.category.trim() || 'General', url: form.url.trim(), clientId: form.clientId, practice } : l))
    else { const id = links.reduce((m, l) => Math.max(m, l.id || 0), 0) + 1; next = [...links, { id, clientId: form.clientId, label: form.label.trim(), category: form.category.trim() || 'General', url: form.url.trim(), practice }] }
    await persistLinks(next); setLinkModal(null); showToast(form.id ? 'Link updated ✓' : 'Link added ✓')
  }
  async function deleteLink(id) { await persistLinks(links.filter((l) => l.id !== id)); setLinkModal(null); showToast('Link deleted') }

  // First write to the clients table: update just the practices list,
  // preserving everything else already in the client's info record.
  async function savePractices(clientId, list) {
    const c = clients.find((x) => x.id === clientId)
    if (!c) return
    const info = { ...(c.info || {}), practices: list }
    setClients((cs) => cs.map((x) => (x.id === clientId ? { ...x, info } : x)))
    // drop tags that point at a now-removed practice
    const valid = new Set(list)
    const cleaned = links.map((l) => (l.clientId === clientId && l.practice && !valid.has(l.practice) ? { ...l, practice: null } : l))
    if (cleaned.some((l, i) => l !== links[i])) await persistLinks(cleaned)
    await supabase.from('clients').update({ info, updated_at: new Date().toISOString() }).eq('id', clientId)
    showToast('Practices updated ✓')
  }

  // Merge a patch into a client's info record (used by accounting).
  async function patchInfo(clientId, patch) {
    const c = clients.find((x) => x.id === clientId)
    if (!c) return
    const info = { ...(c.info || {}), ...patch }
    setClients((cs) => cs.map((x) => (x.id === clientId ? { ...x, info } : x)))
    await supabase.from('clients').update({ info, updated_at: new Date().toISOString() }).eq('id', clientId)
    showToast('Saved ✓')
  }
  const savePayment = (clientId, payment) => { const c = clients.find((x) => x.id === clientId); patchInfo(clientId, { payments: [...(c?.info?.payments || []), payment] }) }
  const deletePayment = (clientId, p) => { const c = clients.find((x) => x.id === clientId); patchInfo(clientId, { payments: (c?.info?.payments || []).filter((x) => !(x.recorded === p.recorded && x.date === p.date && x.amount === p.amount)) }) }
  const saveBilling = (clientId, billing) => patchInfo(clientId, { billing })

  async function addClient(form) {
    if (!form.name.trim()) return
    const { data } = await supabase.from('clients').insert({ name: form.name.trim(), doctor: form.doctor.trim() || null, email: form.email.trim() || null, status: 'active', info: {} }).select()
    if (data?.[0]) setClients((cs) => [...cs, { ...data[0], info: data[0].info || {} }])
    setAddClientModal(false)
    showToast('Client added ✓')
  }
  async function saveClient(id, fields) {
    const c = clients.find((x) => x.id === id); if (!c) return
    const info = { ...(c.info || {}), ...fields.info }
    const patch = { name: fields.name, doctor: fields.doctor || null, email: fields.email || null, info }
    setClients((cs) => cs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    await supabase.from('clients').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    showToast('Client saved ✓')
  }
  async function deleteClient(id) {
    await supabase.from('clients').delete().eq('id', id)
    setClients((cs) => cs.filter((x) => x.id !== id))
    setDetailId(null)
    showToast('Client deleted')
  }

  async function persistTiers(next) {
    setTiers(next)
    const data = { ...appData, tiers: next }
    setAppData(data)
    await supabase.from('app_state').upsert({ id: STATE_ID, data, updated_at: new Date().toISOString() })
  }
  const addTier = (name) => {
    const nm = (name || '').trim(); if (!nm) return
    const id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('tier' + tiers.length)
    if (tiers.some((t) => t.id === id)) { showToast('That tier already exists'); return }
    persistTiers([...tiers, { id, name: nm, color: TIER_PALETTE[tiers.length % TIER_PALETTE.length] }])
  }
  const toggleClientTier = (clientId, tierId) => {
    const c = clients.find((x) => x.id === clientId); if (!c) return
    const cur = getTiers(c)
    patchInfo(clientId, { tiers: cur.includes(tierId) ? cur.filter((x) => x !== tierId) : [...cur, tierId] })
  }

  const M = (id) => METRICS.find((m) => m.id === id)
  const openTasks = (cid) => tasks.filter((t) => t.client_id === cid && t.status !== 'done').length
  const clientHealth = (cid) => { const s = snaps[cid] || []; if (!s.length) return null; const latest = [...s].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-1)[0]; return health(latest.scores) }
  const clientWeekly = (cid) => { const daily = metricsByClient[cid] || {}; const keys = Object.keys(daily).sort().slice(-7); if (!keys.length) return null; const agg = aggregate(keys.map((k) => daily[k])); return { leads: agg.leads || 0, closed: agg.total_closed_tx || 0, revenue: agg.total_revenue || 0 } }

  const detail = detailId != null ? clients.find((c) => c.id === detailId) : null
  if (detail) return <Detail client={detail} links={links.filter((l) => l.clientId === detail.id)} onBack={() => setDetailId(null)} clients={clients} onSaveLink={saveLink} onDeleteLink={deleteLink} onSavePractices={savePractices} tiers={tiers} onToggleTier={toggleClientTier} onAddTier={addTier} onSaveAbbr={(id, v) => patchInfo(id, { abbr: v.trim() })} onSaveClient={saveClient} onDeleteClient={deleteClient} onSaveNotes={(id, log) => patchInfo(id, { notesLog: log })} toast={toast} />

  // Dashboard = consulting cockpit: show consulting clients (and untagged
  // ones, which default to consulting). Membership filtering lives in the
  // Client Portal.
  const shown = clientMode
    ? clients.filter((c) => c.id === clientMode)
    : clients.filter((c) => (filter === 'all' || String(c.id) === String(filter)) && (getTiers(c).length === 0 || getTiers(c).includes('consulting')))

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Command Center" back="/" right={
        clientMode ? (
          <button onClick={() => setEndModal(true)} title="You're in Client Mode — click to end" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(24,168,102,0.18)', border: '0.5px solid rgba(24,168,102,0.55)', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#18e88a', boxShadow: '0 0 7px #18e88a', flexShrink: 0 }} />
            Client Mode: {clients.find((c) => c.id === clientMode)?.name || ''}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAddClientModal(true)} style={{ background: GOLD, border: 'none', color: NAVY, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Client</button>
            <button onClick={() => setSelectModal(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Client Mode</button>
            <button onClick={() => setEditMode((e) => !e)} style={{ background: editMode ? GOLD : 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: editMode ? NAVY : 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>{editMode ? 'Done editing' : 'Edit links'}</button>
          </div>
        )
      } />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
        {!clientMode && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
            <button onClick={() => setFilter('all')} style={pill(filter === 'all')}>{compactFilter ? 'All' : 'All clients'}</button>
            {clients.map((c) => <button key={c.id} onClick={() => setFilter(c.id)} title={compactFilter ? c.name : undefined} style={pill(String(filter) === String(c.id))}>{compactFilter ? abbrOf(c) : c.name}</button>)}
            <button onClick={toggleCompact} title="Toggle abbreviated client names" style={{ height: 28, padding: '0 12px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 999, background: 'transparent', color: MUTED, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{compactFilter ? '↔ Full names' : '↔ Abbreviate'}</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show on cards</span>
          {[['todos', 'To-dos'], ['progress', 'Progress'], ['metrics', 'Metrics'], ['accounting', 'Accounting']].filter(([k]) => !(clientMode && k === 'accounting')).map(([k, label]) => (
            <button key={k} onClick={() => toggleLayer(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, border: '0.5px solid ' + (toggles[k] ? NAVY : 'rgba(0,0,0,0.15)'), background: toggles[k] ? 'rgba(11,29,94,0.05)' : '#fff', color: toggles[k] ? NAVY : MUTED, fontSize: 12, cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: toggles[k] ? '#18a866' : '#c0c6d8' }} />{label}
            </button>
          ))}
        </div>
        {!clients.length && <div style={{ textAlign: 'center', padding: 60, color: MUTED, fontStyle: 'italic' }}>Loading clients…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {[...shown].sort((a, b) => (getPractices(a).length > 1 ? 1 : 0) - (getPractices(b).length > 1 ? 1 : 0)).map((c) => {
            const cl = links.filter((l) => l.clientId === c.id)
            const multi = getPractices(c).length > 1
            const accent = c.info?.accentColor || c.accentColor || GOLD
            const meta = [infoField(c, 'doctor') || c.doctor, infoField(c, 'timezone') ? infoField(c, 'timezone').split('—')[0].trim() : ''].filter(Boolean).join(' · ')
            const practices = tabPractices(c)
            const activePrac = cardPractice[c.id] || null
            // A link tagged with the client's own name is "shared" — it shows under every location tab.
            const cvis = cl.filter((l) => !activePrac || !l.practice || l.practice === activePrac || l.practice === c.name)
            const openN = openTasks(c.id)
            const hp = clientHealth(c.id)
            const wk = clientWeekly(c.id)
            // Open that client's page scoped to them, in a new tab (dashboard stays put).
            const go = (e, path) => { e.stopPropagation(); window.open(window.location.href.split('#')[0] + '#' + path + '?client=' + c.id, '_blank') }
            const web = websiteUrl(infoField(c, 'website'))
            return (
              <div key={c.id} onClick={() => setDetailId(c.id)} style={{ ...card, gridColumn: multi ? '1 / -1' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{ini(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    </div>
                    {meta && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{meta}</div>}
                  </div>
                  {web && (
                    <button onClick={(e) => { e.stopPropagation(); window.open(web, '_blank') }} title="Open website" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: '0.5px solid rgba(0,0,0,0.12)', background: BG, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NAVY }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                    </button>
                  )}
                </div>
                {toggles.todos && openN > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span onClick={(e) => go(e, '/tasks')} title="Open to-dos" style={{ display: 'inline-block', background: 'rgba(188,151,98,0.15)', color: '#8a6a3c', border: '0.5px solid rgba(188,151,98,0.4)', borderRadius: 999, fontSize: 11, fontWeight: 600, padding: '2px 8px', cursor: 'pointer' }}>{openN} to-do{openN !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {getTiers(c).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {getTiers(c).map((id) => { const t = tiers.find((x) => x.id === id); if (!t) return null; return <span key={id} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: t.color + '1a', color: t.color, border: '0.5px solid ' + t.color + '55' }}>{t.name}</span> })}
                  </div>
                )}
                {toggles.progress && (
                  <div onClick={(e) => go(e, '/success-map')} style={{ marginBottom: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: MUTED }}>Progress</span>
                      <span style={{ color: hp === null ? MUTED : GOLD, fontWeight: 600 }}>{hp === null ? 'Not assessed' : hp + '%'}</span>
                    </div>
                    <div style={{ height: 6, background: '#eceae7', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (hp || 0) + '%', background: hp === null ? 'transparent' : GOLD, borderRadius: 3, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
                {toggles.metrics && (
                  <div onClick={(e) => go(e, '/metrics')} style={{ display: 'flex', gap: 6, marginBottom: 10, cursor: 'pointer' }}>
                    {[['Leads', wk ? wk.leads : '—'], ['Closed', wk ? wk.closed : '—'], ['Revenue', wk ? fmtVal(M('total_revenue'), wk.revenue, true) : '—']].map(([l, v]) => (
                      <div key={l} style={{ flex: 1, background: BG, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, lineHeight: 1.1 }}>{v}</div>
                        <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                )}
                {practices.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button onClick={() => setCardPractice((m) => ({ ...m, [c.id]: null }))} style={cardTab(activePrac === null)}>All</button>
                    {practices.map((p) => <button key={p} onClick={() => setCardPractice((m) => ({ ...m, [c.id]: p }))} style={cardTab(activePrac === p)}>{p}</button>)}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {cvis.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', padding: '2px 0' }}>{activePrac ? 'No files for this location' : 'No files yet'}</div>}
                  <div style={cvis.length > 7 ? { display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 236, overflowY: 'auto' } : { display: 'contents' }}>
                    {cvis.map((l) => <LinkChip key={l.id} l={l} clientName={c.name} editMode={editMode} onEdit={(e) => { e.stopPropagation(); setLinkModal({ id: l.id, clientId: c.id }) }} onDelete={(e) => { e.stopPropagation(); deleteLink(l.id) }} />)}
                  </div>
                  {editMode && <button onClick={(e) => { e.stopPropagation(); setLinkModal({ clientId: c.id, practice: activePrac || '' }) }} style={addRow}>+ Add link</button>}
                </div>
                {toggles.accounting && !clientMode && (() => {
                  const billing = c.info?.billing || c.billing || {}
                  const payments = Array.isArray(c.info?.payments) ? c.info.payments : []
                  const lastPay = [...payments].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
                  const due = billingStatus(billing, lastPay)
                  return (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }}>Last payment{billing.monthlyAmount ? ' · ' + money(billing.monthlyAmount) + '/mo' : ''}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, marginTop: 2 }}>{lastPay ? money(lastPay.amount) + ' — ' + (lastPay.fmt || lastPay.date) : <span style={{ color: MUTED, fontStyle: 'italic', fontWeight: 400 }}>No payments yet</span>}</div>
                        {due && <div style={{ fontSize: 11, color: due.color, marginTop: 3, fontWeight: 500 }}>{due.label}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setAccModal({ type: 'history', clientId: c.id })} style={miniBtn}>History</button>
                          <button onClick={() => setAccModal({ type: 'record', clientId: c.id })} style={miniBtnP}>+ Payment</button>
                        </div>
                        <button onClick={() => setAccModal({ type: 'billing', clientId: c.id })} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 10, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Billing settings</button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>
      {linkModal && <LinkModal modal={linkModal} link={linkModal.id ? links.find((l) => l.id === linkModal.id) : null} clients={clients} onSave={saveLink} onDelete={deleteLink} onClose={() => setLinkModal(null)} />}
      {accModal && <AccountingModal modal={accModal} client={clients.find((c) => c.id === accModal.clientId)} onClose={() => setAccModal(null)} onSavePayment={savePayment} onDeletePayment={deletePayment} onSaveBilling={saveBilling} />}
      {addClientModal && <AddClientModal onClose={() => setAddClientModal(false)} onSave={addClient} />}
      {selectModal && (
        <div onClick={() => setSelectModal(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, width: 420 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Select a client</h3>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>Client Mode shows only this client — everyone else is hidden. Use it when screen-sharing.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
              {clients.map((c) => (
                <button key={c.id} onClick={() => enterClientMode(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{ini(c.name)}</span>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{c.name}</span>
                </button>
              ))}
            </div>
            <div style={modalActions}><button style={btnGhost} onClick={() => setSelectModal(false)}>Cancel</button></div>
          </div>
        </div>
      )}
      {endModal && (
        <div onClick={() => setEndModal(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, width: 380, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(24,168,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#18a866', boxShadow: '0 0 8px #18a866' }} /></div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 8 }}>End Client Mode?</h3>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>You're viewing only <strong>{clients.find((c) => c.id === clientMode)?.name}</strong>. Ending will show all clients again.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button style={btnGhost} onClick={() => setEndModal(false)}>Stay in Client Mode</button>
              <button style={btnPrimary} onClick={exitClientMode}>End Client Mode</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast msg={toast} />}
    </div>
  )
}

function LinkChip({ l, editMode, onEdit, onDelete, clientName }) {
  const cc = catColor(l.category)
  return (
    <div onClick={(e) => { e.stopPropagation(); if (l.url) window.open(l.url, '_blank'); else onEdit(e) }} title={l.url || 'No URL yet — click to add'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px', border: '0.5px solid rgba(0,0,0,0.1)', borderLeft: '4px solid ' + cc.border, borderRadius: 8, background: BG, fontSize: 12, cursor: 'pointer' }}>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: l.url ? TEXT : MUTED }}>{l.label}</span>
      {l.practice && l.practice !== clientName && (() => { const pc = practiceColor(l.practice); return <span style={{ fontSize: 10, color: pc.txt, background: pc.bg, borderRadius: 3, padding: '1px 6px', flexShrink: 0, fontWeight: 500 }}>{l.practice}</span> })()}
      {l.category && <span style={{ fontSize: 10, color: cc.txt, background: cc.bg, borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>{l.category}</span>}
      {!l.url && <span style={{ fontSize: 10, color: MUTED, fontStyle: 'italic' }}>no url</span>}
      {editMode && <>
        <button onClick={onEdit} title="Edit" style={iconBtn}>✎</button>
        <button onClick={onDelete} title="Delete" style={iconBtn}>×</button>
      </>}
    </div>
  )
}

function Detail({ client: c, links, onBack, clients, onSaveLink, onDeleteLink, onSavePractices, tiers, onToggleTier, onAddTier, onSaveAbbr, onSaveClient, onDeleteClient, onSaveNotes, toast }) {
  const [linkEdit, setLinkEdit] = useState(null)
  const [pracFilter, setPracFilter] = useState(null)
  const [newPrac, setNewPrac] = useState('')
  const [newTier, setNewTier] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const info = c.info || {}
  const practices = getPractices(c)
  const staffObjs = parseStaff(c)
  const billing = info.billing || c.billing || {}
  const payments = Array.isArray(info.payments) ? [...info.payments].sort((a, b) => (b.date || '').localeCompare(a.date || '')) : []
  const lastPay = payments[0]
  const accent = info.accentColor || c.accentColor || GOLD
  const shownLinks = links.filter((l) => !pracFilter || !l.practice || l.practice === pracFilter || l.practice === c.name)
  const addPractice = () => { const v = newPrac.trim(); if (!v || practices.includes(v)) return; onSavePractices(c.id, [...practices, v]); setNewPrac('') }
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Detail" back="/" right={<div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditOpen(true)} style={{ background: GOLD, border: 'none', color: NAVY, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit profile</button>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>← All clients</button>
      </div>} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>{ini(c.name)}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{c.name}</span><span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} /></div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{c.email || info.email || ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Short name</span>
          <input defaultValue={c.info?.abbr || ''} onBlur={(e) => onSaveAbbr(c.id, e.target.value)} placeholder={abbrOf({ name: c.name })} maxLength={8} style={{ width: 110, height: 30, padding: '0 10px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, color: TEXT, background: BG, fontFamily: 'inherit' }} />
          <span style={{ fontSize: 11, color: MUTED }}>shown in the abbreviated filter view</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <InfoCard label="Doctor / primary contact" value={infoField(c, 'doctor') || c.doctor} />
          <InfoCard label="Website" value={infoField(c, 'website')} href={infoField(c, 'website') ? websiteUrl(infoField(c, 'website')) : undefined} />
          <InfoCard label="Time zone" value={infoField(c, 'timezone')} />
          <InfoCard label="No. of locations" value={infoField(c, 'numLocations')} />
          <div style={{ gridColumn: '1 / -1' }}><StaffCard staff={staffObjs} /></div>
        </div>
        <NotesSection client={c} onSave={onSaveNotes} />
        <div style={{ ...sectionCard, marginBottom: 16 }}>
          <SectionTitle>Membership / tiers</SectionTitle>
          <div style={{ fontSize: 12, color: MUTED, margin: '8px 0 12px' }}>Tag this client with every tier they belong to — they can be in more than one.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tiers.map((t) => { const on = getTiers(c).includes(t.id); return (
              <button key={t.id} onClick={() => onToggleTier(c.id, t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, border: '0.5px solid ' + (on ? t.color : 'rgba(0,0,0,0.15)'), background: on ? t.color + '1a' : '#fff', color: on ? t.color : MUTED }}>
                {on && <span style={{ fontSize: 11 }}>✓</span>}{t.name}
              </button>
            )})}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input style={{ ...inp, flex: 1 }} value={newTier} onChange={(e) => setNewTier(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (onAddTier(newTier), setNewTier(''))} placeholder="Add a tier (e.g. VIP)" />
            <button style={btnPrimary} onClick={() => { onAddTier(newTier); setNewTier('') }}>Add tier</button>
          </div>
        </div>
        {(billing.monthlyAmount || lastPay) && (
          <div style={{ ...sectionCard, marginBottom: 16 }}>
            <SectionTitle>Billing</SectionTitle>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: TEXT, flexWrap: 'wrap' }}>
              {billing.monthlyAmount && <div><span style={{ color: MUTED }}>Monthly: </span>{money(billing.monthlyAmount)}</div>}
              {billing.billingDay && <div><span style={{ color: MUTED }}>Bills on the {billing.billingDay} of each month</span></div>}
              {lastPay && <div><span style={{ color: MUTED }}>Last payment: </span>{money(lastPay.amount)} — {lastPay.fmt || lastPay.date}</div>}
            </div>
          </div>
        )}
        <div style={{ ...sectionCard, marginBottom: 16 }}>
          <SectionTitle>Practices / locations</SectionTitle>
          <div style={{ fontSize: 12, color: MUTED, margin: '8px 0 12px' }}>Add each location, then tag a link to a location when you create it.</div>
          {infoField(c, 'locations') && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Practice location names</div>
              <div style={{ fontSize: 13, color: TEXT, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{infoField(c, 'locations')}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {practices.length === 0 && <span style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No extra locations — this client has one practice.</span>}
            {practices.map((p) => { const pc = practiceColor(p); return (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: pc.txt, background: pc.bg, borderRadius: 8, padding: '4px 10px' }}>{p}<button onClick={() => onSavePractices(c.id, practices.filter((x) => x !== p))} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: pc.txt, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button></span>
            )})}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} value={newPrac} onChange={(e) => setNewPrac(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPractice()} placeholder="e.g. Odessa Family Dental" />
            <button onClick={addPractice} style={btnPrimary}>Add</button>
          </div>
        </div>
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionTitle>Links & files ({shownLinks.length})</SectionTitle>
            <button onClick={() => setLinkEdit({ clientId: c.id })} style={{ ...addRow, width: 'auto', padding: '5px 12px' }}>+ Add link</button>
          </div>
          {tabPractices(c).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <button onClick={() => setPracFilter(null)} style={pill(pracFilter === null)}>All</button>
              {tabPractices(c).map((p) => <button key={p} onClick={() => setPracFilter(p)} style={pill(pracFilter === p)}>{p}</button>)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shownLinks.length === 0 && <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No links yet.</div>}
            {shownLinks.map((l) => <LinkChip key={l.id} l={l} clientName={c.name} editMode onEdit={() => setLinkEdit({ id: l.id, clientId: c.id })} onDelete={() => onDeleteLink(l.id)} />)}
          </div>
        </div>
      </div>
      {linkEdit && <LinkModal modal={linkEdit} link={linkEdit.id ? links.find((l) => l.id === linkEdit.id) : null} clients={clients} onSave={(f) => { onSaveLink(f); setLinkEdit(null) }} onDelete={(id) => { onDeleteLink(id); setLinkEdit(null) }} onClose={() => setLinkEdit(null)} />}
      {editOpen && <EditClientModal client={c} onSave={(f) => { onSaveClient(c.id, f); setEditOpen(false) }} onDelete={() => onDeleteClient(c.id)} onClose={() => setEditOpen(false)} />}
      {toast && <Toast msg={toast} />}
    </div>
  )
}

function StaffCard({ staff }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: staff.length ? 8 : 6 }}>Staff / team</div>
      {staff.length === 0 ? (
        <div style={{ fontSize: 13, color: '#c0c6d8', fontStyle: 'italic' }}>Not set</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {staff.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{s.name}</span>
              {s.title && <span style={{ fontSize: 12, color: MUTED }}>{s.title}</span>}
              {s.phone && <span style={{ fontSize: 12, color: MUTED }}>{s.phone}</span>}
              {s.email && <a href={'mailto:' + s.email} style={{ fontSize: 12, color: NAVY, textDecoration: 'none' }}>{s.email}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value, href }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      {href && value
        ? <a href={href} target="_blank" rel="noopener" style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, wordBreak: 'break-all', textDecoration: 'none', fontWeight: 500 }}>{value} ↗</a>
        : <div style={{ fontSize: 13, color: value ? TEXT : '#c0c6d8', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: value ? 'normal' : 'italic' }}>{value || 'Not set'}</div>}
    </div>
  )
}

function LinkModal({ modal, link, clients, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ id: link?.id, label: link?.label || '', category: link?.category || '', url: link?.url || '', clientId: link?.clientId ?? modal.clientId, practice: link?.practice || modal.practice || '' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const practices = getPractices(clients.find((c) => c.id === form.clientId))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 460, maxWidth: '95vw' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 16 }}>{link ? 'Edit link' : 'New link'}</h3>
        <Field label="Label *"><input style={inp} value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Metrics Scorecard" autoFocus /></Field>
        <Field label="Category"><input style={inp} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Success Map" /></Field>
        <Field label="URL"><input style={inp} value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
        <Field label="Client">
          <select style={inp} value={form.clientId || ''} onChange={(e) => set('clientId', parseInt(e.target.value))}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {practices.length > 0 && (
          <Field label="Practice / location">
            <select style={inp} value={form.practice || ''} onChange={(e) => set('practice', e.target.value)}>
              <option value="">— All locations —</option>
              {practices.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 14 }}>
          {link && <button onClick={() => onDelete(link.id)} style={{ ...btnGhost, color: '#A32D2D', borderColor: 'rgba(163,45,45,0.3)', marginRight: 'auto' }}>Delete</button>}
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={() => onSave(form)} style={btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  )
}

function AccountingModal({ modal, client, onClose, onSavePayment, onDeletePayment, onSaveBilling }) {
  const payments = Array.isArray(client?.info?.payments) ? [...client.info.payments].sort((a, b) => (b.date || '').localeCompare(a.date || '')) : []
  const billing = client?.info?.billing || client?.billing || {}
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [monthly, setMonthly] = useState(billing.monthlyAmount || '')
  const [billingDay, setBillingDay] = useState(billing.billingDay || '')
  const total = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const byMonth = {}
  payments.forEach((p) => { const k = (p.date || '').slice(0, 7); if (k) byMonth[k] = (byMonth[k] || 0) + (parseFloat(p.amount) || 0) })
  const months = Object.keys(byMonth).sort().slice(-12)
  const maxM = Math.max(1, ...months.map((m) => byMonth[m]))
  const title = modal.type === 'record' ? 'Record payment' : modal.type === 'billing' ? 'Billing settings' : 'Payment history — ' + (client?.name || '')
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, width: modal.type === 'history' ? 560 : 420 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 16 }}>{title}</h3>
        {modal.type === 'record' && (<>
          <Field label="Amount *"><input style={inp} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus /></Field>
          <Field label="Date"><input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note"><input style={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
          <div style={modalActions}>
            <button style={btnGhost} onClick={onClose}>Cancel</button>
            <button style={btnPrimary} onClick={() => { if (!amount) return; onSavePayment(client.id, { amount: parseFloat(amount), date, fmt: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), note: note || null, recorded: new Date().toISOString() }); onClose() }}>Save payment</button>
          </div>
        </>)}
        {modal.type === 'billing' && (<>
          <Field label="Monthly amount"><input style={inp} type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="5000" autoFocus /></Field>
          <Field label="Bills on day of month (1–31)"><input style={inp} type="number" min="1" max="31" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} placeholder="1" /></Field>
          <div style={modalActions}>
            <button style={btnGhost} onClick={onClose}>Cancel</button>
            <button style={btnPrimary} onClick={() => { onSaveBilling(client.id, { monthlyAmount: monthly ? parseFloat(monthly) : null, billingDay: billingDay ? parseInt(billingDay) : null }); onClose() }}>Save</button>
          </div>
        </>)}
        {modal.type === 'history' && (<>
          {months.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Monthly totals</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 62 }}>
                {months.map((m) => (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} title={m + ': ' + money(byMonth[m])}>
                    <div style={{ width: '100%', height: Math.round(byMonth[m] / maxM * 46) + 4, background: NAVY, borderRadius: '3px 3px 0 0' }} />
                    <div style={{ fontSize: 8, color: MUTED, whiteSpace: 'nowrap' }}>{m.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {payments.length === 0 && <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', padding: '12px 0' }}>No payments recorded yet.</div>}
            {payments.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div><div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{money(p.amount)}</div><div style={{ fontSize: 11, color: MUTED }}>{p.fmt || p.date}{p.note ? ' · ' + p.note : ''}</div></div>
                <button onClick={() => onDeletePayment(client.id, p)} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: 12 }}>Delete</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Total: {money(total)}</span>
            <button style={btnGhost} onClick={onClose}>Close</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function NotesSection({ client: c, onSave }) {
  const raw = () => (Array.isArray(c.info?.notesLog) ? c.info.notesLog : [])
  const notes = [...raw()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const [histId, setHistId] = useState(null)
  const fmt = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }
  const add = () => { const t = draft.trim(); if (!t) return; onSave(c.id, [...raw(), { id: 'n' + Date.now(), text: t, createdAt: new Date().toISOString(), editedAt: null, history: [] }]); setDraft('') }
  const saveEdit = (id) => { const t = editText.trim(); if (!t) return; onSave(c.id, raw().map((n) => (n.id === id ? { ...n, text: t, editedAt: new Date().toISOString(), history: [...(n.history || []), { text: n.text, date: n.editedAt || n.createdAt }] } : n))); setEditId(null) }
  const del = (id) => onSave(c.id, raw().filter((n) => n.id !== id))
  return (
    <div style={{ ...sectionCard, marginBottom: 16 }}>
      <SectionTitle>Notes</SectionTitle>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note…" style={{ ...inp, flex: 1, height: 40, padding: '9px 10px', resize: 'vertical' }} />
        <button onClick={add} style={btnPrimary}>Add note</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 && <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} style={{ background: BG, borderRadius: 8, padding: '10px 12px' }}>
            {editId === n.id ? (
              <div>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={{ ...inp, width: '100%', height: 60, padding: '8px 10px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditId(null)} style={{ ...btnGhost, height: 28 }}>Cancel</button>
                  <button onClick={() => saveEdit(n.id)} style={{ ...btnPrimary, height: 28 }}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{fmt(n.createdAt)}{n.editedAt ? ' · edited ' + fmt(n.editedAt) : ''}</span>
                  <button onClick={() => { setEditId(n.id); setEditText(n.text) }} style={noteLink}>Edit</button>
                  {n.history && n.history.length > 0 && <button onClick={() => setHistId(histId === n.id ? null : n.id)} style={noteLink}>History ({n.history.length})</button>}
                  <button onClick={() => del(n.id)} style={{ ...noteLink, color: '#A32D2D' }}>Delete</button>
                </div>
                {histId === n.id && (
                  <div style={{ marginTop: 8, borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...(n.history || [])].reverse().map((h, i) => (
                      <div key={i}><div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>{fmt(h.date)}</div><div style={{ fontSize: 12, color: MUTED, whiteSpace: 'pre-wrap' }}>{h.text}</div></div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EditClientModal({ client: c, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    name: c.name || '', doctor: c.doctor || infoField(c, 'doctor') || '', email: c.email || infoField(c, 'email') || '',
    timezone: infoField(c, 'timezone') || '', website: infoField(c, 'website') || '',
    numLocations: infoField(c, 'numLocations') || '', locations: infoField(c, 'locations') || '', notes: infoField(c, 'notes') || '',
  })
  const [staff, setStaff] = useState(() => parseStaff(c))
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setStaffRow = (i, k, v) => setStaff((st) => st.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const save = () => {
    if (!f.name.trim()) return
    onSave({
      name: f.name.trim(), doctor: f.doctor.trim(), email: f.email.trim(),
      info: {
        doctor: f.doctor.trim(), timezone: f.timezone.trim(), website: f.website.trim(),
        numLocations: f.numLocations.trim(), locations: f.locations.trim(), notes: f.notes.trim(),
        staff: staff.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), title: s.title.trim(), phone: s.phone.trim(), email: s.email.trim() })),
      },
    })
  }
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, width: 580 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 16 }}>Edit client profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Practice name *"><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Doctor / owner"><input style={inp} value={f.doctor} onChange={(e) => set('doctor', e.target.value)} /></Field>
          <Field label="Email"><input style={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Time zone"><input style={inp} value={f.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="e.g. CT" /></Field>
          <Field label="Website"><input style={inp} value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" /></Field>
          <Field label="No. of locations"><input style={inp} value={f.numLocations} onChange={(e) => set('numLocations', e.target.value)} /></Field>
        </div>
        <Field label="Location names"><textarea style={{ ...inp, height: 52, padding: '8px 10px' }} value={f.locations} onChange={(e) => set('locations', e.target.value)} /></Field>
        <Field label="Notes"><textarea style={{ ...inp, height: 68, padding: '8px 10px' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, margin: '4px 0 8px' }}>Staff / team</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          {staff.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...inp, flex: 1 }} value={s.name} placeholder="Name" onChange={(e) => setStaffRow(i, 'name', e.target.value)} />
              <input style={{ ...inp, flex: 0.9 }} value={s.title} placeholder="Title" onChange={(e) => setStaffRow(i, 'title', e.target.value)} />
              <input style={{ ...inp, flex: 0.9 }} value={s.phone} placeholder="Phone" onChange={(e) => setStaffRow(i, 'phone', e.target.value)} />
              <input style={{ ...inp, flex: 1.3 }} value={s.email} placeholder="Email" onChange={(e) => setStaffRow(i, 'email', e.target.value)} />
              <button onClick={() => setStaff((st) => st.filter((_, idx) => idx !== i))} title="Remove" style={{ ...iconBtn, color: '#A32D2D', fontSize: 16 }}>×</button>
            </div>
          ))}
          <button onClick={() => setStaff((st) => [...st, { name: '', title: '', phone: '', email: '' }])} style={{ ...addRow, width: 'auto', alignSelf: 'flex-start', padding: '6px 12px' }}>+ Add staff</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 14 }}>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} style={{ ...btnGhost, color: '#A32D2D', borderColor: 'rgba(163,45,45,0.3)', marginRight: 'auto' }}>Delete client</button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 'auto' }}>
              <span style={{ fontSize: 12, color: '#A32D2D' }}>Delete permanently?</span>
              <button onClick={() => setConfirmDel(false)} style={{ ...btnGhost, height: 30 }}>No</button>
              <button onClick={onDelete} style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 8, background: '#A32D2D', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, delete</button>
            </div>
          )}
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={save} style={btnPrimary}>Save profile</button>
        </div>
      </div>
    </div>
  )
}

function AddClientModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', doctor: '', email: '' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, width: 420 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 16 }}>Add new client</h3>
        <Field label="Practice / client name *"><input style={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bright Smiles Dental" autoFocus /></Field>
        <Field label="Doctor / owner"><input style={inp} value={form.doctor} onChange={(e) => set('doctor', e.target.value)} placeholder="e.g. Dr. Anna Torres" /></Field>
        <Field label="Email"><input style={inp} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="hello@practice.com" /></Field>
        <div style={modalActions}>
          <button style={btnGhost} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} onClick={() => onSave(form)}>Add client</button>
        </div>
      </div>
    </div>
  )
}

const Field = ({ label, children }) => <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, marginBottom: 5 }}>{label}</div>{children}</div>
const SectionTitle = ({ children }) => <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, borderBottom: '1.5px solid ' + GOLD, paddingBottom: 6 }}>{children}</div>
const Toast = ({ msg }) => <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', fontSize: 12, padding: '8px 18px', borderRadius: 20, zIndex: 9999 }}>{msg}</div>

const pill = (active) => ({ padding: '5px 14px', border: '0.5px solid ' + (active ? GOLD : 'rgba(0,0,0,0.15)'), borderRadius: 999, background: active ? NAVY : '#fff', color: active ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer' })
const cardTab = (active) => ({ padding: '3px 9px', borderRadius: 6, border: '0.5px solid ' + (active ? NAVY : 'rgba(0,0,0,0.12)'), background: active ? NAVY : '#fff', color: active ? '#fff' : MUTED, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' })
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }
const modalBox = { background: '#fff', borderRadius: 14, padding: 24, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }
const modalActions = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 14 }
const miniBtn = { height: 26, padding: '0 9px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: MUTED, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, whiteSpace: 'nowrap' }
const miniBtnP = { height: 26, padding: '0 9px', border: 'none', borderRadius: 6, background: NAVY, color: GOLD, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, whiteSpace: 'nowrap' }
const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }
const sectionCard = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '18px 20px' }
const addRow = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', border: '0.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer', background: 'none', width: '100%', fontFamily: 'inherit' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '2px 4px', fontSize: 13, lineHeight: 1 }
const noteLink = { background: 'none', border: 'none', padding: 0, color: NAVY, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }
const inp = { width: '100%', height: 34, padding: '0 10px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, color: TEXT, background: BG, fontFamily: 'inherit' }
const btnGhost = { height: 34, padding: '0 16px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary = { height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
