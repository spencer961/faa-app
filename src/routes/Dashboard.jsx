import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { supabase } from '../lib/supabase.js'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { aggregate, METRICS, fmtVal } from '../lib/metrics.js'
import { health } from '../lib/successMap.js'

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
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const staffList = (info) => { let s = info?.staff; if (!s) return []; try { if (typeof s === 'string') s = JSON.parse(s) } catch { return [String(info.staff)] } return Array.isArray(s) ? s : [s] }

// Practices/locations live at info.practices. Some older records nest the
// text fields (doctor, staff, notes…) one level deeper at info.info — read
// both so nothing shows blank.
const getPractices = (c) => (Array.isArray(c?.info?.practices) ? c.info.practices.filter(Boolean) : [])
const infoField = (c, k) => (c?.info?.info?.[k] ?? c?.info?.[k] ?? '')
const PRACTICE_PALETTE = [
  { bg: '#E6F1FB', txt: '#0C447C' }, { bg: '#FAEEDA', txt: '#633806' }, { bg: '#E1F5EE', txt: '#085041' },
  { bg: '#FDEEF6', txt: '#8C1A5A' }, { bg: '#F0EDFB', txt: '#5A3DAA' }, { bg: '#EAF3DE', txt: '#274F0A' },
]
const practiceColor = (name) => { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PRACTICE_PALETTE[h % PRACTICE_PALETTE.length] }

const INFO_FIELDS = [
  ['doctor', 'Doctor / primary contact'], ['timezone', 'Time zone'], ['website', 'Website'],
  ['numLocations', 'No. of locations'], ['locations', 'Practice location names'],
]

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [links, setLinks] = useState([])
  const [appData, setAppData] = useState({})
  const [filter, setFilter] = useState('all')
  const [editMode, setEditMode] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [linkModal, setLinkModal] = useState(null) // {id?, clientId}
  const [toast, setToast] = useState('')
  const [tasks, setTasks] = useState([])
  const [metricsByClient, setMetricsByClient] = useState({})
  const [snaps] = useState(() => { try { return JSON.parse(localStorage.getItem('faa_success_snapshots')) || {} } catch { return {} } })
  const [toggles, setToggles] = useState(() => { try { return { todos: true, progress: true, metrics: true, ...(JSON.parse(localStorage.getItem('faa_dash_toggles') || '{}')) } } catch { return { todos: true, progress: true, metrics: true } } })
  const navigate = useNavigate()
  const toggleLayer = (k) => setToggles((t) => { const n = { ...t, [k]: !t[k] }; try { localStorage.setItem('faa_dash_toggles', JSON.stringify(n)) } catch { /* ignore */ } return n })

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('*').order('id')
      if (Array.isArray(cs)) setClients(cs.map((r) => ({ ...r, info: r.info || {} })))
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      if (st?.data) { setAppData(st.data); if (Array.isArray(st.data.links)) setLinks(st.data.links) }
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

  const M = (id) => METRICS.find((m) => m.id === id)
  const openTasks = (cid) => tasks.filter((t) => t.client_id === cid && t.status !== 'done').length
  const clientHealth = (cid) => { const s = snaps[cid] || []; if (!s.length) return null; const latest = [...s].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-1)[0]; return health(latest.scores) }
  const clientWeekly = (cid) => { const daily = metricsByClient[cid] || {}; const keys = Object.keys(daily).sort().slice(-7); if (!keys.length) return null; const agg = aggregate(keys.map((k) => daily[k])); return { leads: agg.leads || 0, closed: agg.total_closed_tx || 0, revenue: agg.total_revenue || 0 } }

  const detail = detailId != null ? clients.find((c) => c.id === detailId) : null
  if (detail) return <Detail client={detail} links={links.filter((l) => l.clientId === detail.id)} onBack={() => setDetailId(null)} clients={clients} onSaveLink={saveLink} onDeleteLink={deleteLink} onSavePractices={savePractices} toast={toast} />

  const shown = filter === 'all' ? clients : clients.filter((c) => String(c.id) === String(filter))

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Command Center" back="/" right={
        <button onClick={() => setEditMode((e) => !e)} style={{ background: editMode ? GOLD : 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: editMode ? NAVY : 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>{editMode ? 'Done editing' : 'Edit links'}</button>
      } />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={() => setFilter('all')} style={pill(filter === 'all')}>All clients</button>
          {clients.map((c) => <button key={c.id} onClick={() => setFilter(c.id)} style={pill(String(filter) === String(c.id))}>{c.name}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show on cards</span>
          {[['todos', 'To-dos'], ['progress', 'Progress'], ['metrics', 'Metrics']].map(([k, label]) => (
            <button key={k} onClick={() => toggleLayer(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, border: '0.5px solid ' + (toggles[k] ? NAVY : 'rgba(0,0,0,0.15)'), background: toggles[k] ? 'rgba(11,29,94,0.05)' : '#fff', color: toggles[k] ? NAVY : MUTED, fontSize: 12, cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: toggles[k] ? '#18a866' : '#c0c6d8' }} />{label}
            </button>
          ))}
        </div>
        {!clients.length && <div style={{ textAlign: 'center', padding: 60, color: MUTED, fontStyle: 'italic' }}>Loading clients…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {shown.map((c) => {
            const cl = links.filter((l) => l.clientId === c.id)
            const accent = c.info?.accentColor || c.accentColor || GOLD
            const meta = [c.doctor || c.info?.doctor, c.info?.timezone ? c.info.timezone.split('—')[0].trim() : ''].filter(Boolean).join(' · ')
            const openN = openTasks(c.id)
            const hp = clientHealth(c.id)
            const wk = clientWeekly(c.id)
            const go = (e, path) => { e.stopPropagation(); navigate(path) }
            return (
              <div key={c.id} onClick={() => setDetailId(c.id)} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{ini(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    </div>
                    {meta && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{meta}</div>}
                  </div>
                  {toggles.todos && openN > 0 && (
                    <span onClick={(e) => go(e, '/tasks')} title="Open to-dos" style={{ flexShrink: 0, background: 'rgba(188,151,98,0.15)', color: '#8a6a3c', border: '0.5px solid rgba(188,151,98,0.4)', borderRadius: 999, fontSize: 11, fontWeight: 600, padding: '2px 8px', cursor: 'pointer' }}>{openN} to-do{openN !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {toggles.progress && (
                  <div onClick={(e) => go(e, '/success-map')} style={{ marginBottom: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: MUTED }}>Success Map</span>
                      <span style={{ color: hp === null ? MUTED : hp >= 70 ? '#18a866' : hp >= 40 ? '#e07b0a' : '#d42020', fontWeight: 600 }}>{hp === null ? 'Not assessed' : hp + '%'}</span>
                    </div>
                    <div style={{ height: 6, background: '#eceae7', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (hp || 0) + '%', background: hp === null ? 'transparent' : hp >= 70 ? '#18a866' : hp >= 40 ? '#e07b0a' : '#d42020', borderRadius: 3, transition: 'width .4s' }} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {cl.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', padding: '2px 0' }}>No files yet</div>}
                  {cl.map((l) => <LinkChip key={l.id} l={l} editMode={editMode} onEdit={(e) => { e.stopPropagation(); setLinkModal({ id: l.id, clientId: c.id }) }} onDelete={(e) => { e.stopPropagation(); deleteLink(l.id) }} />)}
                  {editMode && <button onClick={(e) => { e.stopPropagation(); setLinkModal({ clientId: c.id }) }} style={addRow}>+ Add link</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {linkModal && <LinkModal modal={linkModal} link={linkModal.id ? links.find((l) => l.id === linkModal.id) : null} clients={clients} onSave={saveLink} onDelete={deleteLink} onClose={() => setLinkModal(null)} />}
      {toast && <Toast msg={toast} />}
    </div>
  )
}

function LinkChip({ l, editMode, onEdit, onDelete }) {
  const cc = catColor(l.category)
  return (
    <div onClick={(e) => { e.stopPropagation(); if (l.url) window.open(l.url, '_blank'); else onEdit(e) }} title={l.url || 'No URL yet — click to add'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px', border: '0.5px solid rgba(0,0,0,0.1)', borderLeft: '4px solid ' + cc.border, borderRadius: 8, background: BG, fontSize: 12, cursor: 'pointer' }}>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: l.url ? TEXT : MUTED }}>{l.label}</span>
      {l.practice && (() => { const pc = practiceColor(l.practice); return <span style={{ fontSize: 10, color: pc.txt, background: pc.bg, borderRadius: 3, padding: '1px 6px', flexShrink: 0, fontWeight: 500 }}>{l.practice}</span> })()}
      {l.category && <span style={{ fontSize: 10, color: cc.txt, background: cc.bg, borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>{l.category}</span>}
      {!l.url && <span style={{ fontSize: 10, color: MUTED, fontStyle: 'italic' }}>no url</span>}
      {editMode && <>
        <button onClick={onEdit} title="Edit" style={iconBtn}>✎</button>
        <button onClick={onDelete} title="Delete" style={iconBtn}>×</button>
      </>}
    </div>
  )
}

function Detail({ client: c, links, onBack, clients, onSaveLink, onDeleteLink, onSavePractices, toast }) {
  const [linkEdit, setLinkEdit] = useState(null)
  const [pracFilter, setPracFilter] = useState(null)
  const [newPrac, setNewPrac] = useState('')
  const info = c.info || {}
  const practices = getPractices(c)
  const staff = staffList({ staff: infoField(c, 'staff') })
  const billing = info.billing || c.billing || {}
  const payments = Array.isArray(info.payments) ? [...info.payments].sort((a, b) => (b.date || '').localeCompare(a.date || '')) : []
  const lastPay = payments[0]
  const accent = info.accentColor || c.accentColor || GOLD
  const shownLinks = links.filter((l) => !pracFilter || !l.practice || l.practice === pracFilter)
  const addPractice = () => { const v = newPrac.trim(); if (!v || practices.includes(v)) return; onSavePractices(c.id, [...practices, v]); setNewPrac('') }
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Detail" back="/" right={<button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>← All clients</button>} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>{ini(c.name)}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{c.name}</span><span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} /></div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{c.email || info.email || ''}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {INFO_FIELDS.map(([k, label]) => (
            <InfoCard key={k} label={label} value={infoField(c, k) || (k === 'doctor' ? c.doctor : '')} />
          ))}
          <InfoCard label="Staff / team" value={staff.length ? staff.map((s) => (typeof s === 'object' ? [s.name, s.role].filter(Boolean).join(' — ') : s)).join('\n') : ''} />
          <InfoCard label="Notes" value={infoField(c, 'notes') || ''} />
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
          {practices.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <button onClick={() => setPracFilter(null)} style={pill(pracFilter === null)}>All</button>
              {practices.map((p) => <button key={p} onClick={() => setPracFilter(p)} style={pill(pracFilter === p)}>{p}</button>)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shownLinks.length === 0 && <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No links yet.</div>}
            {shownLinks.map((l) => <LinkChip key={l.id} l={l} editMode onEdit={() => setLinkEdit({ id: l.id, clientId: c.id })} onDelete={() => onDeleteLink(l.id)} />)}
          </div>
        </div>
      </div>
      {linkEdit && <LinkModal modal={linkEdit} link={linkEdit.id ? links.find((l) => l.id === linkEdit.id) : null} clients={clients} onSave={(f) => { onSaveLink(f); setLinkEdit(null) }} onDelete={(id) => { onDeleteLink(id); setLinkEdit(null) }} onClose={() => setLinkEdit(null)} />}
      {toast && <Toast msg={toast} />}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? TEXT : '#c0c6d8', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: value ? 'normal' : 'italic' }}>{value || 'Not set'}</div>
    </div>
  )
}

function LinkModal({ modal, link, clients, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ id: link?.id, label: link?.label || '', category: link?.category || '', url: link?.url || '', clientId: link?.clientId ?? modal.clientId, practice: link?.practice || '' })
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

const Field = ({ label, children }) => <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, marginBottom: 5 }}>{label}</div>{children}</div>
const SectionTitle = ({ children }) => <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, borderBottom: '1.5px solid ' + GOLD, paddingBottom: 6 }}>{children}</div>
const Toast = ({ msg }) => <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', fontSize: 12, padding: '8px 18px', borderRadius: 20, zIndex: 9999 }}>{msg}</div>

const pill = (active) => ({ padding: '5px 14px', border: '0.5px solid ' + (active ? GOLD : 'rgba(0,0,0,0.15)'), borderRadius: 999, background: active ? NAVY : '#fff', color: active ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer' })
const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }
const sectionCard = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '18px 20px' }
const addRow = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', border: '0.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer', background: 'none', width: '100%', fontFamily: 'inherit' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '2px 4px', fontSize: 13, lineHeight: 1 }
const inp = { width: '100%', height: 34, padding: '0 10px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, color: TEXT, background: BG, fontFamily: 'inherit' }
const btnGhost = { height: 34, padding: '0 16px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary = { height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
