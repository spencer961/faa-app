import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { activeVendors, vendorById, vendorTypeName, abbrOf, clientVendorLinks, uid as vendorUid, VENDOR_PALETTE } from '../lib/vendors.js'
import { isArchived } from '../lib/archive.js'

// ─────────────────────────────────────────────────────────────────────
// Client Updates — the single per-client hub. A wide two-column layout:
//   left   = what's happening (vendors + updates log + notes & history)
//   right  = what needs me (To review + My to-dos), in a tinted panel
// plus a Heads-up strip on top. This absorbed the old Client Pulse page
// (Heads up / To review / Notes & history); the channel board + questions
// come in Phase 2. All per-client data lives on the client's `info` blob.
// ─────────────────────────────────────────────────────────────────────

const STATE_ID = 'gmj_main'
const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const iid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const nid = () => 'n' + Date.now()
const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d } }
const sd = (iso) => { try { const d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2) } catch { return '' } }
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
// Fallback label for a link with no name — its domain (e.g. "fathom.video").
const shortUrl = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return String(u || '').slice(0, 40) } }
// My to-dos — pulled from the tasks table, filtered to ones assigned to me.
// Until logins land, "me" is Spencer (the default assignee on the To-Do page).
const ME = 'Spencer'
const isMine = (t) => (t.assignee || '').trim().toLowerCase() === ME.toLowerCase()
const fmtDue = (d) => { if (!d) return ''; try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return d } }
const TASK_SL = { not_started: 'Not started', in_progress: 'In progress', waiting: 'Waiting', done: 'Done' }
const TASK_SC = { not_started: '#888786', in_progress: '#1a7fd4', waiting: '#e07b0a', done: '#18a866' }
const TASK_PL = { high: 'High', medium: 'Medium', low: 'Low' }
const TASK_PC = { high: '#d42020', medium: '#e07b0a', low: '#18a866' }

export default function VendorHub() {
  const [clients, setClients] = useState([])
  const [vendors, setVendors] = useState([])
  const [tasks, setTasks] = useState([])
  const [searchParams] = useSearchParams()
  const [sel, setSel] = useState(searchParams.get('client') ? parseInt(searchParams.get('client')) : null)
  const [linkMenu, setLinkMenu] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // update being edited (the full update object)
  const [updFilter, setUpdFilter] = useState('all') // vendorId or 'all' — filters the history
  const [notesOpen, setNotesOpen] = useState(false)
  const [taskModal, setTaskModal] = useState(null)
  // Measure the content area (not the window — the sidebar can collapse) and
  // drop to a single column when it's too narrow for two.
  // Heads up + vendors stay side by side down to a narrower width than the main
  // two-column split, since the vendor box is small.
  const wrapRef = useRef(null)
  const [wrapW, setWrapW] = useState(1080)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const wide = wrapW >= 860
  const topWide = wrapW >= 560

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,info,status').order('id')
      if (Array.isArray(cs)) setClients(cs) // sel stays null = All clients summary (unless a ?client= was passed)
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      setVendors(st?.data?.vendors || [])
      const { data: ts } = await supabase.from('tasks').select('id,status,client_id,title,assignee,priority,due_date,notes')
      if (Array.isArray(ts)) setTasks(ts)
    })()
  }, [])

  const client = clients.find((c) => c.id === sel)
  const info = client?.info || {}
  const activeClients = clients.filter((c) => !isArchived(c)) // archived clients drop out of Client Updates, like the rest of the app
  const linkedIds = info.vendorIds || []
  const linked = activeVendors(vendors).filter((v) => linkedIds.includes(v.id))
  const available = activeVendors(vendors).filter((v) => !linkedIds.includes(v.id))
  const allUpdates = info.vendorUpdates || []
  const updates = [...allUpdates].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const lastFor = (vid) => allUpdates.filter((u) => u.vendorId === vid).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
  const shownUpdates = updFilter === 'all' ? updates : updates.filter((u) => u.vendorId === updFilter)
  const monthGroups = []
  shownUpdates.forEach((u) => { const mk = (u.date || '').slice(0, 7) || '—'; let g = monthGroups.find((x) => x.mk === mk); if (!g) { g = { mk, items: [] }; monthGroups.push(g) } g.items.push(u) })
  const monthLabel = (mk) => { try { return new Date(mk + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) } catch { return mk } }

  // Pulse-era per-client data.
  const heads = info.headsUp || []
  const review = info.reviewItems || []
  const notes = [...(info.notesLog || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const myTodos = tasks.filter((t) => t.client_id === sel && isMine(t) && t.status !== 'done')

  async function patchClient(patchObj) {
    if (!client) return
    const nextInfo = { ...(client.info || {}), ...patchObj }
    setClients((cs) => cs.map((x) => (x.id === sel ? { ...x, info: nextInfo } : x)))
    await supabase.from('clients').update({ info: nextInfo, updated_at: new Date().toISOString() }).eq('id', sel)
  }
  const addItem = (key, item) => patchClient({ [key]: [...(info[key] || []), item] })
  const updateItem = (key, itemId, changes) => patchClient({ [key]: (info[key] || []).map((it) => (it.id === itemId ? { ...it, ...changes } : it)) })
  const removeItem = (key, itemId) => patchClient({ [key]: (info[key] || []).filter((it) => it.id !== itemId) })
  const onReply = (key, itemId, v) => updateItem(key, itemId, { reply: v })
  // Checking off logs a running record to Notes & history, so the profile keeps
  // the story (Reviewed / Noted on check, Reopened on uncheck).
  const toggleItem = (key, it, doneKey) => {
    const nowDone = !it[doneKey]
    const verb = nowDone ? (key === 'reviewItems' ? 'Reviewed' : 'Noted') : 'Reopened'
    patchClient({
      notesLog: [...(info.notesLog || []), { id: nid(), text: verb + ': ' + it.title + (nowDone && it.reply ? ' — ' + it.reply : ''), createdAt: new Date().toISOString(), editedAt: null, history: [], source: 'updates' }],
      [key]: (info[key] || []).map((x) => (x.id === it.id ? { ...x, [doneKey]: nowDone } : x)),
    })
  }

  // Create a brand-new vendor in the shared directory (from the update form) and
  // return its id. Re-reads app_state first so other edits aren't clobbered.
  async function createVendor(name) {
    const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
    const cur = st?.data?.vendors || []
    const v = { id: vendorUid(), name: name.trim(), abbr: '', type: 'marketing', color: VENDOR_PALETTE[cur.length % VENDOR_PALETTE.length], archived: false, contacts: [] }
    const nextVendors = [...cur, v]
    await supabase.from('app_state').upsert({ id: STATE_ID, data: { ...(st?.data || {}), vendors: nextVendors }, updated_at: new Date().toISOString() })
    setVendors(nextVendors)
    return v.id
  }
  const linkVendor = (vid) => { patchClient({ vendorIds: [...linkedIds, vid] }); setLinkMenu(false) }
  const unlinkVendor = (vid) => { const v = vendorById(vendors, vid); if (!window.confirm('Unlink ' + (v?.name || 'this vendor') + ' from ' + client.name + '? Past updates stay in the log.')) return; patchClient({ vendorIds: linkedIds.filter((x) => x !== vid) }) }
  // Multi-client aware writes — a tagged update lives (in sync) on each client.
  async function applyToClients(ids, transform) {
    const next = clients.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, info: { ...(c.info || {}), ...transform(c.info || {}) } }))
    setClients((cs) => cs.map((x) => { const n = next.find((y) => y.id === x.id); return n ? { ...x, info: n.info } : x }))
    for (const n of next) await supabase.from('clients').update({ info: n.info, updated_at: new Date().toISOString() }).eq('id', n.id)
  }
  const writeUpdateToClients = (update, ids) => applyToClients(ids, (inf) => {
    const list = (inf.vendorUpdates || []).filter((u) => u.id !== update.id)
    const vIds = inf.vendorIds || []
    const linkPatch = update.vendorId && !vIds.includes(update.vendorId) ? { vendorIds: [...vIds, update.vendorId] } : {}
    return { vendorUpdates: [...list, update], ...linkPatch }
  })
  const removeUpdateFromClients = (id, ids) => applyToClients(ids, (inf) => ({ vendorUpdates: (inf.vendorUpdates || []).filter((u) => u.id !== id) }))
  // `link` = the one email thread; `files` = any number of docs / recordings /
  // attachments mentioned in the email, each of which can be sent to To review.
  const mkUpdate = (f, id, createdAt) => ({
    id, vendorId: f.vendorId, date: f.date, text: f.text.trim(), link: (f.link || '').trim() || null,
    files: (f.files || []).filter((x) => (x.url || '').trim()).map((x) => ({ id: x.id || iid(), label: (x.label || '').trim() || shortUrl(x.url), url: x.url.trim() })),
    from: (f.from || '').trim() || null, related: (f.related || '').trim() || null, clientIds: Array.from(new Set([sel, ...(f.clientIds || [])])), createdAt,
  })
  // Push one of an update's files into this client's To review panel.
  const sentToReview = (u, file) => review.some((r) => r.fromUpdate === u.id && r.fileId === file.id)
  const sendToReview = (u, file) => {
    const v = vendorById(vendors, u.vendorId)
    addItem('reviewItems', { id: iid(), title: file.label, url: file.url, kind: null, note: 'From ' + (v ? abbrOf(v) : 'vendor') + ' update · ' + fmtDate(u.date), done: false, reply: '', createdAt: new Date().toISOString(), fromUpdate: u.id, fileId: file.id })
  }
  const handleAdd = (f) => { const u = mkUpdate(f, uid(), new Date().toISOString()); writeUpdateToClients(u, u.clientIds); setAdding(false) }
  const handleEdit = (f) => {
    const u = mkUpdate(f, editing.id, editing.createdAt || new Date().toISOString())
    const oldIds = editing.clientIds && editing.clientIds.length ? editing.clientIds : [sel]
    const removed = oldIds.filter((id) => !u.clientIds.includes(id))
    if (removed.length) removeUpdateFromClients(u.id, removed)
    writeUpdateToClients(u, u.clientIds); setEditing(null)
  }
  const deleteUpdate = (u) => { const ids = u.clientIds && u.clientIds.length ? u.clientIds : [sel]; if (!window.confirm('Delete this update?' + (ids.length > 1 ? ' It will be removed from all ' + ids.length + ' tagged clients.' : ''))) return; removeUpdateFromClients(u.id, ids) }
  const clientName = (id) => (clients.find((c) => c.id === id) || {}).name || 'client'

  const vChip = (v) => <span title={v.name} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: v.color || NAVY, borderRadius: 6, padding: '2px 8px' }}>{abbrOf(v)}</span>

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Updates" back="/" right={
        <select value={sel || ''} onChange={(e) => setSel(e.target.value ? parseInt(e.target.value) : null)} style={{ height: 32, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">All clients</option>
          {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      } />
      <div ref={wrapRef} style={{ maxWidth: sel === null ? 940 : 1120, margin: '0 auto', padding: '22px 20px 60px' }}>
        {sel === null ? <AllClientsSummary clients={activeClients} vendors={vendors} onPick={setSel} />
          : !client ? <div style={{ textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' }}>Loading…</div> : (
          <>
            <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12 }}>← All clients</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{ini(client.name)}</div>
              <div><div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{client.name}</div><div style={{ fontSize: 12, color: MUTED }}>{myTodos.length} on your plate · {review.filter((i) => !i.done).length} to review</div></div>
            </div>

            {/* TOP BAND — Heads up beside a compact vendor box (stacks when narrow) */}
            <div style={{ display: 'grid', gridTemplateColumns: topWide ? 'minmax(0,1fr) 230px' : '1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
              <div style={{ ...headsCard, marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8860b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a6d2e' }}>Heads up</span>
                  {heads.filter((i) => !i.seen).length > 0 && <span style={{ fontSize: 11, color: '#8a6d2e', background: 'rgba(188,151,98,0.25)', borderRadius: 999, padding: '1px 8px' }}>{heads.filter((i) => !i.seen).length}</span>}
                </div>
                {heads.length === 0 && <div style={{ fontSize: 12.5, color: '#9a8757', fontStyle: 'italic', padding: '4px 0 2px' }}>Nothing flagged. Add the main things to be aware of for this client.</div>}
                {heads.map((it) => <ItemRow key={it.id} it={it} doneKey="seen" onToggle={() => toggleItem('headsUp', it, 'seen')} onReply={(v) => onReply('headsUp', it.id, v)} onRemove={() => removeItem('headsUp', it.id)} />)}
                <ItemComposer label="a heads-up" onAdd={(o) => addItem('headsUp', { id: iid(), seen: false, reply: '', createdAt: new Date().toISOString(), ...o })} />
              </div>

              {/* Vendors — compact, abbreviated, scrolls if long. Vendors mostly get
                  linked by logging an update; the + is for linking without one. */}
              <div style={{ ...card, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={secTitle}>Vendors</span>
                  <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button onClick={() => setLinkMenu((o) => !o)} disabled={!available.length} title="Link a vendor" style={{ width: 26, height: 26, borderRadius: 7, border: '0.5px solid rgba(11,29,94,0.16)', background: 'rgba(11,29,94,0.055)', color: NAVY, fontSize: 15, fontWeight: 600, cursor: available.length ? 'pointer' : 'default', opacity: available.length ? 1 : 0.4, padding: 0, lineHeight: 1, fontFamily: 'inherit' }}>+</button>
                    {linkMenu && available.length > 0 && (
                      <div style={menu}>
                        {available.map((v) => <div key={v.id} onClick={() => linkVendor(v.id)} style={menuItem}><span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color, flexShrink: 0 }} />{v.name}<span style={{ marginLeft: 'auto', fontSize: 10.5, color: MUTED }}>{vendorTypeName(v.type)}</span></div>)}
                      </div>
                    )}
                  </div>
                </div>
                {linked.length === 0 ? <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginTop: 8, lineHeight: 1.45 }}>None yet — picking a vendor when you add an update links it here.</div> : (
                  <div style={{ maxHeight: 128, overflowY: 'auto', marginTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {linked.map((v) => { const last = lastFor(v.id); return (
                      <div key={v.id} title={v.name + ' · ' + vendorTypeName(v.type)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: v.color || NAVY, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{abbrOf(v)}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: last ? TEXT : MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last ? 'Last ' + fmtDate(last.date) : 'No updates yet'}</span>
                        <button onClick={() => unlinkVendor(v.id)} title={'Unlink ' + v.name} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    ) })}
                  </div>
                )}
              </div>
            </div>

            {/* MAIN — two columns when wide; one column (needs-me panel FIRST) when narrow */}
            <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1.55fr) minmax(0,1fr)' : '1fr', gap: 18, alignItems: 'start' }}>
              {/* LEFT — what's happening */}
              <div style={{ minWidth: 0, order: wide ? 1 : 2 }}>
                {/* Updates log */}
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <span style={secTitle}>Updates history{updates.length > 0 ? ' · ' + updates.length : ''}</span>
                    <button onClick={() => { setEditing(null); setAdding((o) => !o) }} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Add update</button>
                  </div>

                  {adding && (
                    <UpdateForm
                      initial={{ vendorId: activeVendors(vendors)[0]?.id || '', date: today(), text: '', link: '', files: [], from: '', related: '', clientIds: [sel] }}
                      vendors={vendors} activeClients={activeClients} sel={sel} onCreateVendor={createVendor} onCancel={() => setAdding(false)} onSave={handleAdd} />
                  )}

                  {updates.length === 0 && !adding && <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>No updates logged yet. Click “+ Add update” to log what a vendor has reported.</div>}

                  {updates.length > 0 && linked.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                      <button onClick={() => setUpdFilter('all')} style={fpill(updFilter === 'all')}>All vendors</button>
                      {linked.map((v) => <button key={v.id} onClick={() => setUpdFilter(v.id)} title={v.name} style={fpill(updFilter === v.id)}>{abbrOf(v)}</button>)}
                    </div>
                  )}

                  {updates.length > 0 && shownUpdates.length === 0 && <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>No updates from this vendor yet.</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {monthGroups.map((g) => (
                      <div key={g.mk}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 9, paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>{monthLabel(g.mk)}<span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> · {g.items.length}</span></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {g.items.map((u) => { const v = vendorById(vendors, u.vendorId) || { name: 'Unknown vendor', color: '#9a9a96' }
                            if (editing && editing.id === u.id) return (
                              <UpdateForm key={u.id}
                                initial={{ vendorId: u.vendorId, date: u.date, text: u.text, link: u.link || '', files: u.files || [], from: u.from || '', related: u.related || '', clientIds: u.clientIds || [sel] }}
                                vendors={vendors} activeClients={activeClients} sel={sel} onCreateVendor={createVendor} onCancel={() => setEditing(null)} onSave={handleEdit} />
                            )
                            const others = (u.clientIds || []).filter((id) => id !== sel)
                            return (
                              <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, padding: '12px 14px', background: '#fff' }}>
                                <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: v.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>{vChip(v)}<span style={{ fontSize: 11.5, color: MUTED }}>{fmtDate(u.date)}</span></div>
                                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{u.text}</div>
                                  {(u.from || u.related || u.link) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: MUTED }}>
                                      {u.from && <span><span style={{ color: '#a0a09e' }}>from</span> {u.from}</span>}
                                      {u.related && <span>· {u.related}</span>}
                                      {u.link && <a href={u.link} target="_blank" rel="noopener" style={{ color: NAVY, fontWeight: 600, textDecoration: 'none' }}>View email thread ↗</a>}
                                    </div>
                                  )}
                                  {(u.files || []).length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {u.files.map((file) => (
                                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: '#f7f6f4', borderRadius: 7, padding: '5px 9px' }}>
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                          <a href={file.url} target="_blank" rel="noopener" style={{ flex: 1, minWidth: 0, color: NAVY, fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.label} ↗</a>
                                          {sentToReview(u, file)
                                            ? <span style={{ fontSize: 11, color: '#0f7a49', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ in To review</span>
                                            : <button onClick={() => sendToReview(u, file)} title="Add this to the To review panel" style={{ background: 'none', border: 'none', color: NAVY, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+ To review</button>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {others.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: '#0f7a49' }}>⤷ also tagged: {others.map(clientName).join(', ')}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <button onClick={() => { setAdding(false); setEditing(u) }} title="Edit" style={iconBtn}>✎</button>
                                  <button onClick={() => deleteUpdate(u)} title="Delete" style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes & history — collapsible */}
                <div style={card}>
                  <div onClick={() => setNotesOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={secTitle}>Notes &amp; history</span>
                    {notes.length > 0 && <span style={{ fontSize: 11, color: MUTED, background: '#f0efed', borderRadius: 999, padding: '1px 8px' }}>{notes.length}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: NAVY, fontWeight: 600 }}>{notesOpen ? 'Hide' : 'Show'}</span>
                  </div>
                  {notesOpen && (
                    <div style={{ marginTop: 12 }}>
                      <NoteAdd onAdd={(text) => addItem('notesLog', { id: nid(), text, createdAt: new Date().toISOString(), editedAt: null, history: [] })} />
                      {notes.length === 0 && <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', padding: '8px 2px 2px' }}>No notes yet.</div>}
                      {notes.map((n, idx) => {
                        const lines = (n.text || '').split('\n'); const title = lines[0]; const body = lines.slice(1).join('\n').replace(/^\n+|\n+$/g, '')
                        return (
                          <div key={n.id} style={{ padding: '9px 0', borderTop: idx > 0 ? '0.5px solid rgba(0,0,0,0.07)' : '0.5px solid rgba(0,0,0,0.07)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}><span style={{ color: GOLD }}>{sd(n.createdAt)}</span>&nbsp; {title}</div>
                            {body && <div style={{ fontSize: 13, color: '#44443f', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: 2 }}>{body}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — needs me (tinted action panel) */}
              <div style={{ ...actionPanel, order: wide ? 2 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 2px 9px' }}>
                  <span style={secTitle}>To review</span>
                  {review.filter((i) => !i.done).length > 0 && <span style={{ fontSize: 11, color: NAVY, background: '#fff', borderRadius: 999, padding: '1px 8px' }}>{review.filter((i) => !i.done).length}</span>}
                </div>
                <div style={{ ...card, marginBottom: 18 }}>
                  {review.length === 0 && <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>Nothing to review right now.</div>}
                  {review.map((it) => <ItemRow key={it.id} it={it} doneKey="done" hasLink onToggle={() => toggleItem('reviewItems', it, 'done')} onReply={(v) => onReply('reviewItems', it.id, v)} onRemove={() => removeItem('reviewItems', it.id)} />)}
                  <ItemComposer hasLink label="something to review" onAdd={(o) => addItem('reviewItems', { id: iid(), done: false, reply: '', createdAt: new Date().toISOString(), ...o })} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 2px 9px' }}>
                  <span style={secTitle}>My to-dos</span>
                  {myTodos.length > 0 && <span style={{ fontSize: 11, color: NAVY, background: '#fff', borderRadius: 999, padding: '1px 8px' }}>{myTodos.length}</span>}
                  <a href={'#/tasks?client=' + sel} style={{ marginLeft: 'auto', fontSize: 11.5, color: NAVY, fontWeight: 600, textDecoration: 'none' }}>Open To-Do list ↗</a>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: myTodos.length ? 10 : 0 }}>What you owe this client — assigned to you on the To-Do list.</div>
                  {myTodos.length === 0 ? <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>Nothing on your plate for this client.</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {myTodos.map((t) => (
                        <div key={t.id} onClick={() => setTaskModal(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderLeft: '3px solid ' + (TASK_SC[t.status] || '#888'), borderRadius: 10, padding: '9px 11px', cursor: 'pointer' }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          {t.due_date && <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{fmtDue(t.due_date)}</span>}
                          <span style={{ color: '#c0c6d8', fontSize: 15 }}>›</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {taskModal && <TaskModal t={taskModal} clientId={sel} onClose={() => setTaskModal(null)} />}
    </div>
  )
}

// A review / heads-up item: checkbox + title (+ optional link) + reply + remove.
function ItemRow({ it, doneKey, hasLink, onToggle, onReply, onRemove }) {
  const done = it[doneKey]
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '11px 13px', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <button onClick={onToggle} aria-label="Mark done" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, border: '1.6px solid ' + (done ? NAVY : 'rgba(0,0,0,0.25)'), background: done ? NAVY : '#fff', color: GOLD, cursor: 'pointer', marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1, padding: 0 }}>{done ? '✓' : ''}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: done ? 0.55 : 1 }}>
            {hasLink && it.url
              ? <a href={it.url} target="_blank" rel="noopener" style={{ fontSize: 13.5, color: NAVY, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{it.title} ↗</a>
              : <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 500, textDecoration: done ? 'line-through' : 'none' }}>{it.title}</span>}
            {it.kind && <span style={{ fontSize: 10, color: MUTED, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0 6px' }}>{it.kind}</span>}
            <button onClick={() => { if (window.confirm('Remove “' + it.title + '”?')) onRemove() }} title="Remove" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {it.note && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4 }}>{it.note}</div>}
          {!hasLink && it.url && <a href={it.url} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: NAVY, fontWeight: 600, marginTop: 6, textDecoration: 'none' }}>View email thread ↗</a>}
          <ReplyBox value={it.reply} onSave={onReply} />
        </div>
      </div>
    </div>
  )
}

function ReplyBox({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <textarea autoFocus defaultValue={value || ''} onBlur={(e) => { onSave(e.target.value.trim()); setEditing(false) }} placeholder="What to do / how to reply…" style={{ marginTop: 8, width: '100%', minHeight: 52, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
  if (value) return <div onClick={() => setEditing(true)} style={{ marginTop: 8, background: 'rgba(11,29,94,0.05)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: NAVY, cursor: 'text', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>↳ {value}</div>
  return <button onClick={() => setEditing(true)} style={{ marginTop: 8, background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', padding: 0 }}>+ add what to do / your reply</button>
}

function ItemComposer({ hasLink, label, onAdd }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', url: '', kind: '', note: '' })
  const reset = () => setF({ title: '', url: '', kind: '', note: '' })
  const submit = () => { if (!f.title.trim()) return; onAdd({ title: f.title.trim(), url: f.url.trim() || null, kind: f.kind.trim() || null, note: f.note.trim() || '' }); reset(); setOpen(false) }
  if (!open) return <button onClick={() => setOpen(true)} style={{ marginTop: 10, ...addRow }}>+ Add {label}</button>
  return (
    <div style={{ marginTop: 10, border: '0.5px dashed rgba(0,0,0,0.25)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' }}>
      <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={hasLink ? 'What is it? (e.g. New consult script)' : 'What happened? (e.g. Owner emailed about close rate)'} style={inpFull} />
      <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder={hasLink ? 'Link — Drive, Doc, sheet… (optional)' : 'Link to the email thread (optional)'} style={inpFull} />
      {hasLink && <input value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} placeholder="Type — PDF, Doc, Sheet… (optional)" style={inpFull} />}
      <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note — what this is / what to do with it" style={{ ...inpFull, minHeight: 48, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => { setOpen(false); reset() }} style={btnGhost}>Cancel</button>
        <button onClick={submit} style={btnPrimary}>Add</button>
      </div>
    </div>
  )
}

function NoteAdd({ onAdd }) {
  const [t, setT] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Add a note…" style={{ ...inpFull, minHeight: 40, resize: 'vertical', flex: 1 }} />
      <button onClick={() => { if (t.trim()) { onAdd(t.trim()); setT('') } }} style={btnPrimary}>Add note</button>
    </div>
  )
}

// Read-only look at a single to-do, with a jump to the full To-Do list to edit.
function TaskModal({ t, clientId, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 440, maxWidth: '100%', padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: TEXT, flex: 1, lineHeight: 1.35 }}>{t.title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#fff', background: TASK_SC[t.status] || '#888', borderRadius: 999, padding: '3px 11px' }}>{TASK_SL[t.status] || t.status}</span>
          <span style={{ fontSize: 12, color: TASK_PC[t.priority] || MUTED, border: '0.5px solid ' + (TASK_PC[t.priority] || 'rgba(0,0,0,0.15)'), borderRadius: 999, padding: '3px 11px' }}>{TASK_PL[t.priority] || t.priority} priority</span>
          {t.due_date && <span style={{ fontSize: 12, color: MUTED, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 999, padding: '3px 11px' }}>Due {fmtDue(t.due_date)}</span>}
        </div>
        {t.assignee && <div style={{ fontSize: 13, color: TEXT, marginBottom: 12 }}><span style={{ color: MUTED }}>Assigned to</span> &nbsp;{t.assignee}</div>}
        {t.notes && <div style={{ fontSize: 13, color: '#44443f', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f7f6f4', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>{t.notes}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Close</button>
          <a href={'#/tasks?client=' + clientId} style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open in To-Do list ↗</a>
        </div>
      </div>
    </div>
  )
}

// Shared add/edit form — summary + email link + from + related + multi-client tag.
function UpdateForm({ initial, vendors, activeClients, sel, onCreateVendor, onCancel, onSave }) {
  const [f, setF] = useState(initial)
  const [newVendor, setNewVendor] = useState(null) // null = closed; string = the name being typed
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setFile = (i, k, v) => setF((s) => ({ ...s, files: s.files.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) }))
  const others = activeClients.filter((c) => c.id !== sel)
  const toggle = (id) => setF((s) => ({ ...s, clientIds: s.clientIds.includes(id) ? s.clientIds.filter((x) => x !== id) : [...s.clientIds, id] }))
  const selName = (activeClients.find((c) => c.id === sel) || {}).name || 'this client'
  const addNewVendor = async () => { const n = (newVendor || '').trim(); if (!n) return; const id = await onCreateVendor(n); set('vendorId', id); setNewVendor(null) }
  return (
    <div style={{ border: '0.5px solid ' + NAVY, borderRadius: 11, padding: 13, marginBottom: 14, background: '#fbfcff' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <select value={f.vendorId} onChange={(e) => { if (e.target.value === '__new') setNewVendor(''); else set('vendorId', e.target.value) }} style={{ ...inp, flex: '1 1 180px', minWidth: 0 }}>
          <option value="">Which vendor…</option>
          {activeVendors(vendors).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          <option value="__new">+ New vendor…</option>
        </select>
        <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} style={{ ...inp, maxWidth: 160 }} />
      </div>
      {newVendor !== null && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 9, padding: 8, background: '#fff', border: '0.5px dashed rgba(11,29,94,0.35)', borderRadius: 9 }}>
          <input autoFocus value={newVendor} onChange={(e) => setNewVendor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNewVendor(); if (e.key === 'Escape') setNewVendor(null) }} placeholder="New vendor's full name (e.g. Searchlight SEO)" style={{ ...inp, flex: 1, minWidth: 0 }} />
          <button onClick={addNewVendor} style={btnPrimary}>Add</button>
          <button onClick={() => setNewVendor(null)} style={btnGhost}>Cancel</button>
        </div>
      )}
      <textarea value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Summary — what's the update? (e.g. launched new All-on-4 campaign; +12 backlinks, traffic up 18%)" style={{ ...inpFull, minHeight: 60, resize: 'vertical', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input value={f.from} onChange={(e) => set('from', e.target.value)} placeholder="From (who sent it)" style={{ ...inp, flex: '1 1 150px' }} />
        <input value={f.related} onChange={(e) => set('related', e.target.value)} placeholder="Who else was on it (optional)" style={{ ...inp, flex: '1 1 200px' }} />
      </div>
      <input value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="Email thread link — the Gmail URL (optional)" style={{ ...inpFull, marginBottom: 10 }} />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Files &amp; links to review — docs, recordings, attachments from the email:</div>
        {(f.files || []).map((file, i) => (
          <div key={file.id || i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={file.label} onChange={(e) => setFile(i, 'label', e.target.value)} placeholder="Name (e.g. Meeting recording)" style={{ ...inp, flex: '0 1 190px', minWidth: 0 }} />
            <input value={file.url} onChange={(e) => setFile(i, 'url', e.target.value)} placeholder="Link (Drive, Docs, Fathom…)" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <button onClick={() => setF((s) => ({ ...s, files: s.files.filter((_, idx) => idx !== i) }))} title="Remove link" style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
          </div>
        ))}
        <button onClick={() => setF((s) => ({ ...s, files: [...(s.files || []), { id: '', label: '', url: '' }] }))} style={{ ...addRow, width: 'auto', padding: '6px 12px', fontSize: 12 }}>+ Add file / link</button>
      </div>
      {others.length > 0 && <ClientTagSelect others={others} selected={f.clientIds} selName={selName} onToggle={toggle} />}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
        <button onClick={() => { if (!f.vendorId || !f.text.trim()) return; onSave(f) }} style={btnPrimary}>Save update</button>
      </div>
    </div>
  )
}

// "Also show on other clients" — a dropdown checklist (searchable) instead of a
// wall of pills. The current client is always included.
function ClientTagSelect({ others, selected, selName, onToggle }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const picked = others.filter((c) => selected.includes(c.id))
  const shown = others.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Also show this update on other clients (optional):</div>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inp, width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: picked.length ? TEXT : MUTED }}>
          {picked.length ? selName + ' + ' + picked.map((c) => c.name).join(', ') : 'Only ' + selName + ' — tag other clients…'}
        </span>
        <span style={{ color: MUTED, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...menu, top: 'calc(100% + 4px)', left: 0, right: 'auto', width: '100%', maxHeight: 260, overflowY: 'auto', boxSizing: 'border-box' }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" style={{ ...inpFull, marginBottom: 4 }} />
          {shown.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', padding: '8px 10px' }}>No clients match.</div>}
          {shown.map((c) => (
            <label key={c.id} style={{ ...menuItem, gap: 9 }}>
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} style={{ accentColor: NAVY, cursor: 'pointer' }} />
              {c.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// The all-clients overview — vendor status + what needs you, filterable, click to open.
function AllClientsSummary({ clients, vendors, onPick }) {
  const [q, setQ] = useState('')
  const act = activeVendors(vendors)
  const rows = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
  const abbr = (v) => <span key={v.id} title={v.name} style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: v.color || NAVY, borderRadius: 5, padding: '1px 6px' }}>{abbrOf(v)}</span>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>All clients</div><div style={{ fontSize: 12, color: MUTED }}>Status across every client — what needs you, and vendor activity. Click one to open its hub.</div></div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter clients…" style={{ marginLeft: 'auto', height: 32, width: 200, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 11px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit' }} />
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Client</th><th style={th}>Needs you</th><th style={th}>Vendors</th><th style={th}>Latest update</th><th style={{ ...th, width: 70 }} /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No clients match.</td></tr>}
            {rows.map((c) => {
              const ids = clientVendorLinks(c).map((l) => l.vendorId)
              const vs = act.filter((v) => ids.includes(v.id))
              const ups = [...(c.info?.vendorUpdates || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
              const last = ups[0]; const lv = last ? vendorById(vendors, last.vendorId) : null
              const rO = (c.info?.reviewItems || []).filter((i) => !i.done).length
              const fO = (c.info?.headsUp || []).filter((i) => !i.seen).length
              return (
                <tr key={c.id} onClick={() => onPick(c.id)} style={{ cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                  <td style={td}>{(rO || fO) ? <span style={{ color: '#8a6a3c', fontWeight: 600 }}>{[rO ? rO + ' to review' : null, fO ? fO + ' heads-up' : null].filter(Boolean).join(' · ')}</span> : <span style={{ color: MUTED }}>All caught up</span>}</td>
                  <td style={td}>{vs.length ? <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{vs.map(abbr)}</span> : <span style={{ color: MUTED, fontStyle: 'italic' }}>none linked</span>}</td>
                  <td style={td}>{last ? <span><span style={{ color: MUTED }}>{fmtDate(last.date)} · </span>{lv ? abbrOf(lv) + ': ' : ''}{last.text.length > 56 ? last.text.slice(0, 56) + '…' : last.text}</span> : <span style={{ color: MUTED }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'right' }}><span style={{ color: NAVY, fontWeight: 600, whiteSpace: 'nowrap' }}>Open →</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: '16px 18px' }
const headsCard = { background: '#fdf8ee', border: '0.5px solid #ecdcb6', borderRadius: 14, padding: '13px 16px', marginBottom: 16 }
const actionPanel = { background: '#e9edf7', border: '0.5px solid #d7ddee', borderRadius: 14, padding: 14 }
const th = { textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, background: '#f9f8f6', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }
const td = { padding: '11px 14px', fontSize: 12.5, color: TEXT, verticalAlign: 'middle' }
const secTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }
const btnPrimary = { height: 32, padding: '0 14px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost = { height: 32, padding: '0 14px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: TEXT, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn = { background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 5px' }
const addRow = { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: '0.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, color: MUTED, fontSize: 13, cursor: 'pointer', background: 'none', width: '100%', fontFamily: 'inherit' }
const fpill = (on) => ({ padding: '4px 11px', borderRadius: 999, border: '0.5px solid ' + (on ? NAVY : 'rgba(0,0,0,0.15)'), background: on ? NAVY : '#fff', color: on ? '#fff' : MUTED, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })
const inp = { height: 34, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', boxSizing: 'border-box' }
const inpFull = { ...inp, width: '100%', height: 'auto', padding: '8px 10px' }
const menu = { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 230, background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, boxShadow: '0 12px 30px rgba(0,0,0,0.16)', padding: 6, zIndex: 30 }
const menuItem = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', color: TEXT }
