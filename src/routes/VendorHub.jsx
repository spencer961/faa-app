import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { activeVendors, vendorById, vendorTypeName, abbrOf, clientVendorLinks } from '../lib/vendors.js'
import { isArchived } from '../lib/archive.js'

// ─────────────────────────────────────────────────────────────────────
// Vendor Hub — per-client vendor status / pre-meeting briefing. For now:
// link the vendors a client uses (from the shared directory) and log their
// updates ("when did their SEO company last update us?"). Needs-attention,
// the strategy log, and the themed detail sections come next. All stored on
// the client's `info` blob — no schema change.
// ─────────────────────────────────────────────────────────────────────

const STATE_ID = 'gmj_main'
const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d } }
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

export default function VendorHub() {
  const [clients, setClients] = useState([])
  const [vendors, setVendors] = useState([])
  const [searchParams] = useSearchParams()
  const [sel, setSel] = useState(searchParams.get('client') ? parseInt(searchParams.get('client')) : null)
  const [linkMenu, setLinkMenu] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // update being edited (the full update object)
  const [updFilter, setUpdFilter] = useState('all') // vendorId or 'all' — filters the history

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,info,status').order('id')
      if (Array.isArray(cs)) setClients(cs) // sel stays null = All clients summary (unless a ?client= was passed)
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      setVendors(st?.data?.vendors || [])
    })()
  }, [])

  const client = clients.find((c) => c.id === sel)
  const activeClients = clients.filter((c) => !isArchived(c)) // archived clients drop out of Vendor Updates, like the rest of the app
  const linkedIds = client?.info?.vendorIds || []
  const linked = activeVendors(vendors).filter((v) => linkedIds.includes(v.id))
  const available = activeVendors(vendors).filter((v) => !linkedIds.includes(v.id))
  const allUpdates = client?.info?.vendorUpdates || []
  const updates = [...allUpdates].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const lastFor = (vid) => allUpdates.filter((u) => u.vendorId === vid).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
  // History view — filter by vendor, grouped by month (updates already sorted newest-first).
  const shownUpdates = updFilter === 'all' ? updates : updates.filter((u) => u.vendorId === updFilter)
  const monthGroups = []
  shownUpdates.forEach((u) => { const mk = (u.date || '').slice(0, 7) || '—'; let g = monthGroups.find((x) => x.mk === mk); if (!g) { g = { mk, items: [] }; monthGroups.push(g) } g.items.push(u) })
  const monthLabel = (mk) => { try { return new Date(mk + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) } catch { return mk } }

  async function patchClient(patchObj) {
    if (!client) return
    const info = { ...(client.info || {}), ...patchObj }
    setClients((cs) => cs.map((x) => (x.id === sel ? { ...x, info } : x)))
    await supabase.from('clients').update({ info, updated_at: new Date().toISOString() }).eq('id', sel)
  }
  const linkVendor = (vid) => { patchClient({ vendorIds: [...linkedIds, vid] }); setLinkMenu(false) }
  const unlinkVendor = (vid) => { const v = vendorById(vendors, vid); if (!window.confirm('Unlink ' + (v?.name || 'this vendor') + ' from ' + client.name + '? Past updates stay in the log.')) return; patchClient({ vendorIds: linkedIds.filter((x) => x !== vid) }) }
  // Multi-client aware writes — a tagged update lives (in sync) on each client.
  async function applyToClients(ids, transform) {
    const next = clients.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, info: { ...(c.info || {}), ...transform(c.info || {}) } }))
    setClients((cs) => cs.map((x) => { const n = next.find((y) => y.id === x.id); return n ? { ...x, info: n.info } : x }))
    for (const n of next) await supabase.from('clients').update({ info: n.info, updated_at: new Date().toISOString() }).eq('id', n.id)
  }
  const writeUpdateToClients = (update, ids) => applyToClients(ids, (info) => {
    const list = (info.vendorUpdates || []).filter((u) => u.id !== update.id)
    const vIds = info.vendorIds || []
    const linkPatch = update.vendorId && !vIds.includes(update.vendorId) ? { vendorIds: [...vIds, update.vendorId] } : {} // auto-link the vendor on each tagged client
    return { vendorUpdates: [...list, update], ...linkPatch }
  })
  const removeUpdateFromClients = (id, ids) => applyToClients(ids, (info) => ({ vendorUpdates: (info.vendorUpdates || []).filter((u) => u.id !== id) }))
  const mkUpdate = (f, id, createdAt) => ({ id, vendorId: f.vendorId, date: f.date, text: f.text.trim(), link: (f.link || '').trim() || null, from: (f.from || '').trim() || null, related: (f.related || '').trim() || null, clientIds: Array.from(new Set([sel, ...(f.clientIds || [])])), createdAt })
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

  const vChip = (v, extra) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#fff', background: v.color || NAVY, borderRadius: 999, padding: '2px 10px' }}>{v.name}{extra}</span>

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Vendor Updates" back="/" right={
        <select value={sel || ''} onChange={(e) => setSel(e.target.value ? parseInt(e.target.value) : null)} style={{ height: 32, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">All clients</option>
          {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      } />
      <div style={{ maxWidth: sel === null ? 940 : 820, margin: '0 auto', padding: '22px 20px 60px' }}>
        {sel === null ? <AllClientsSummary clients={activeClients} vendors={vendors} onPick={setSel} />
          : !client ? <div style={{ textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' }}>Loading…</div> : (
          <>
            <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12 }}>← All clients</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{ini(client.name)}</div>
              <div><div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{client.name}</div><div style={{ fontSize: 12, color: MUTED }}>Vendor status &amp; updates</div></div>
            </div>

            {/* Vendors this client uses */}
            <div style={{ ...card, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: linked.length ? 12 : 0 }}>
                <span style={secTitle}>Vendors</span>
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button onClick={() => setLinkMenu((o) => !o)} disabled={!available.length} style={{ ...btnSoft, opacity: available.length ? 1 : 0.5 }}>+ Link vendor</button>
                  {linkMenu && available.length > 0 && (
                    <div style={menu}>
                      {available.map((v) => <div key={v.id} onClick={() => linkVendor(v.id)} style={menuItem}><span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color, flexShrink: 0 }} />{v.name}<span style={{ marginLeft: 'auto', fontSize: 10.5, color: MUTED }}>{vendorTypeName(v.type)}</span></div>)}
                    </div>
                  )}
                </div>
              </div>
              {linked.length === 0 ? <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>No vendors linked yet. Link the marketing / SEO companies this client uses (manage the master list in Super Admin).</div> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {linked.map((v) => { const last = lastFor(v.id); return (
                    <div key={v.id} style={{ border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, padding: '10px 12px', minWidth: 170, background: '#fbfbfa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{vChip(v)}<span style={{ fontSize: 10.5, color: MUTED }}>{vendorTypeName(v.type)}</span><button onClick={() => unlinkVendor(v.id)} title="Unlink" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button></div>
                      <div style={{ fontSize: 11.5, color: last ? TEXT : MUTED, marginTop: 7 }}>{last ? 'Last update ' + fmtDate(last.date) : 'No updates yet'}</div>
                    </div>
                  ) })}
                </div>
              )}
            </div>

            {/* Updates log */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={secTitle}>Updates history{updates.length > 0 ? ' · ' + updates.length : ''}</span>
                <button onClick={() => { setEditing(null); setAdding((o) => !o) }} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Add update</button>
              </div>

              {adding && (
                <UpdateForm
                  initial={{ vendorId: activeVendors(vendors)[0]?.id || '', date: today(), text: '', link: '', from: '', related: '', clientIds: [sel] }}
                  vendors={vendors} activeClients={activeClients} sel={sel} onCancel={() => setAdding(false)} onSave={handleAdd} />
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
                            initial={{ vendorId: u.vendorId, date: u.date, text: u.text, link: u.link || '', from: u.from || '', related: u.related || '', clientIds: u.clientIds || [sel] }}
                            vendors={vendors} activeClients={activeClients} sel={sel} onCancel={() => setEditing(null)} onSave={handleEdit} />
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
          </>
        )}
      </div>
    </div>
  )
}

// Shared add/edit form — summary + email link + from + related + multi-client tag.
function UpdateForm({ initial, vendors, activeClients, sel, onCancel, onSave }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const others = activeClients.filter((c) => c.id !== sel)
  const toggle = (id) => setF((s) => ({ ...s, clientIds: s.clientIds.includes(id) ? s.clientIds.filter((x) => x !== id) : [...s.clientIds, id] }))
  const selName = (activeClients.find((c) => c.id === sel) || {}).name || 'this client'
  return (
    <div style={{ border: '0.5px solid ' + NAVY, borderRadius: 11, padding: 13, marginBottom: 14, background: '#fbfcff' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <select value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)} style={inp}><option value="">Which vendor…</option>{activeVendors(vendors).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} style={{ ...inp, maxWidth: 160 }} />
      </div>
      <textarea value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Summary — what's the update? (e.g. launched new All-on-4 campaign; +12 backlinks, traffic up 18%)" style={{ ...inp, width: '100%', minHeight: 60, resize: 'vertical', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input value={f.from} onChange={(e) => set('from', e.target.value)} placeholder="From (who sent it)" style={{ ...inp, flex: '1 1 150px' }} />
        <input value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="Email thread link (optional)" style={{ ...inp, flex: '1 1 200px' }} />
      </div>
      <input value={f.related} onChange={(e) => set('related', e.target.value)} placeholder="Who else was on it / related (optional)" style={{ ...inp, width: '100%', marginBottom: others.length ? 10 : 2 }} />
      {others.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Tag clients — the update also shows on each one you pick:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...tagPill(true), cursor: 'default', opacity: 0.8 }}>{selName}</span>
            {others.map((c) => <button key={c.id} onClick={() => toggle(c.id)} style={tagPill(f.clientIds.includes(c.id))}>{c.name}</button>)}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
        <button onClick={() => { if (!f.vendorId || !f.text.trim()) return; onSave(f) }} style={btnPrimary}>Save update</button>
      </div>
    </div>
  )
}

// The all-clients overview — vendor status for everyone, filterable, click to open.
function AllClientsSummary({ clients, vendors, onPick }) {
  const [q, setQ] = useState('')
  const act = activeVendors(vendors)
  const rows = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
  const abbr = (v) => <span key={v.id} title={v.name} style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: v.color || NAVY, borderRadius: 5, padding: '1px 6px' }}>{abbrOf(v)}</span>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>All clients</div><div style={{ fontSize: 12, color: MUTED }}>Vendor status across every client — click one to open its hub.</div></div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter clients…" style={{ marginLeft: 'auto', height: 32, width: 200, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 11px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit' }} />
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Client</th><th style={th}>Vendors</th><th style={th}>Latest update</th><th style={{ ...th, width: 70 }} /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No clients match.</td></tr>}
            {rows.map((c) => {
              const ids = clientVendorLinks(c).map((l) => l.vendorId)
              const vs = act.filter((v) => ids.includes(v.id))
              const ups = [...(c.info?.vendorUpdates || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
              const last = ups[0]; const lv = last ? vendorById(vendors, last.vendorId) : null
              return (
                <tr key={c.id} onClick={() => onPick(c.id)} style={{ cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                  <td style={td}>{vs.length ? <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{vs.map(abbr)}</span> : <span style={{ color: MUTED, fontStyle: 'italic' }}>none linked</span>}</td>
                  <td style={td}>{last ? <span><span style={{ color: MUTED }}>{fmtDate(last.date)} · </span>{lv ? abbrOf(lv) + ': ' : ''}{last.text.length > 64 ? last.text.slice(0, 64) + '…' : last.text}</span> : <span style={{ color: MUTED }}>—</span>}</td>
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
const th = { textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, background: '#f9f8f6', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }
const td = { padding: '11px 14px', fontSize: 12.5, color: TEXT, verticalAlign: 'middle' }
const secTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }
const btnPrimary = { height: 32, padding: '0 14px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnSoft = { height: 30, padding: '0 12px', borderRadius: 8, border: '0.5px solid rgba(11,29,94,0.16)', background: 'rgba(11,29,94,0.055)', color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost = { height: 32, padding: '0 14px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: TEXT, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn = { background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 5px' }
const fpill = (on) => ({ padding: '4px 11px', borderRadius: 999, border: '0.5px solid ' + (on ? NAVY : 'rgba(0,0,0,0.15)'), background: on ? NAVY : '#fff', color: on ? '#fff' : MUTED, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })
const tagPill = (on) => ({ padding: '4px 11px', borderRadius: 999, border: '0.5px solid ' + (on ? '#0f7a49' : 'rgba(0,0,0,0.18)'), background: on ? '#E1F5EE' : '#fff', color: on ? '#0f7a49' : MUTED, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })
const inp = { height: 34, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', boxSizing: 'border-box' }
const menu = { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 230, background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, boxShadow: '0 12px 30px rgba(0,0,0,0.16)', padding: 6, zIndex: 30 }
const menuItem = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', color: TEXT }
