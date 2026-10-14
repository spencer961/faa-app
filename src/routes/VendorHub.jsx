import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { activeVendors, vendorById, vendorTypeName } from '../lib/vendors.js'

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
  const [form, setForm] = useState({ vendorId: '', date: today(), text: '' })
  const [editing, setEditing] = useState(null) // update being edited

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,info,status').order('id')
      if (Array.isArray(cs)) { setClients(cs); setSel((s) => s || (cs[0] && cs[0].id) || null) }
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      setVendors(st?.data?.vendors || [])
    })()
  }, [])

  const client = clients.find((c) => c.id === sel)
  const linkedIds = client?.info?.vendorIds || []
  const linked = activeVendors(vendors).filter((v) => linkedIds.includes(v.id))
  const available = activeVendors(vendors).filter((v) => !linkedIds.includes(v.id))
  const allUpdates = client?.info?.vendorUpdates || []
  const updates = [...allUpdates].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const lastFor = (vid) => allUpdates.filter((u) => u.vendorId === vid).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]

  async function patchClient(patchObj) {
    if (!client) return
    const info = { ...(client.info || {}), ...patchObj }
    setClients((cs) => cs.map((x) => (x.id === sel ? { ...x, info } : x)))
    await supabase.from('clients').update({ info, updated_at: new Date().toISOString() }).eq('id', sel)
  }
  const linkVendor = (vid) => { patchClient({ vendorIds: [...linkedIds, vid] }); setLinkMenu(false) }
  const unlinkVendor = (vid) => { const v = vendorById(vendors, vid); if (!window.confirm('Unlink ' + (v?.name || 'this vendor') + ' from ' + client.name + '? Past updates stay in the log.')) return; patchClient({ vendorIds: linkedIds.filter((x) => x !== vid) }) }
  const addUpdate = () => { if (!form.vendorId || !form.text.trim()) return; patchClient({ vendorUpdates: [...allUpdates, { id: uid(), vendorId: form.vendorId, date: form.date, text: form.text.trim(), createdAt: new Date().toISOString() }] }); setForm({ vendorId: '', date: today(), text: '' }); setAdding(false) }
  const saveEdit = () => { if (!editing.text.trim()) return; patchClient({ vendorUpdates: allUpdates.map((u) => (u.id === editing.id ? { ...u, vendorId: editing.vendorId, date: editing.date, text: editing.text.trim() } : u)) }); setEditing(null) }
  const deleteUpdate = (u) => { if (!window.confirm('Delete this update?')) return; patchClient({ vendorUpdates: allUpdates.filter((x) => x.id !== u.id) }) }

  const vChip = (v, extra) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#fff', background: v.color || NAVY, borderRadius: 999, padding: '2px 10px' }}>{v.name}{extra}</span>

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Vendor Updates" back="/" right={
        <select value={sel || ''} onChange={(e) => setSel(parseInt(e.target.value))} style={{ height: 32, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', cursor: 'pointer' }}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      } />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 20px 60px' }}>
        {!client ? <div style={{ textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' }}>Loading…</div> : (
          <>
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
                <span style={secTitle}>Latest updates</span>
                {linked.length > 0 && <button onClick={() => { setAdding((o) => !o); setForm({ vendorId: linked[0]?.id || '', date: today(), text: '' }) }} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Add update</button>}
              </div>

              {adding && (
                <div style={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 11, padding: 13, marginBottom: 14, background: '#fbfbfa' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                    <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} style={inp}>
                      <option value="">Which vendor…</option>
                      {linked.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
                  </div>
                  <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="What's the update? (e.g. launched new All-on-4 campaign; +12 backlinks, traffic up 18%)" style={{ ...inp, width: '100%', minHeight: 60, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 9 }}>
                    <button onClick={() => setAdding(false)} style={btnGhost}>Cancel</button>
                    <button onClick={addUpdate} style={btnPrimary}>Save update</button>
                  </div>
                </div>
              )}

              {updates.length === 0 && !adding && <div style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>No updates logged yet. Click “+ Add update” to log what a vendor has reported.</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {updates.map((u) => { const v = vendorById(vendors, u.vendorId) || { name: 'Unknown vendor', color: '#9a9a96' }
                  if (editing && editing.id === u.id) return (
                    <div key={u.id} style={{ border: '0.5px solid ' + NAVY, borderRadius: 11, padding: 13, background: '#fbfcff' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                        <select value={editing.vendorId} onChange={(e) => setEditing({ ...editing, vendorId: e.target.value })} style={inp}>{linked.map((lv) => <option key={lv.id} value={lv.id}>{lv.name}</option>)}</select>
                        <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
                      </div>
                      <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} style={{ ...inp, width: '100%', minHeight: 60, resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 9 }}><button onClick={() => setEditing(null)} style={btnGhost}>Cancel</button><button onClick={saveEdit} style={btnPrimary}>Save</button></div>
                    </div>
                  )
                  return (
                    <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, padding: '12px 14px', background: '#fff' }}>
                      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: v.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>{vChip(v)}<span style={{ fontSize: 11.5, color: MUTED }}>{fmtDate(u.date)}</span></div>
                        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{u.text}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setEditing({ id: u.id, vendorId: u.vendorId, date: u.date, text: u.text })} title="Edit" style={iconBtn}>✎</button>
                        <button onClick={() => deleteUpdate(u)} title="Delete" style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: '16px 18px' }
const secTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }
const btnPrimary = { height: 32, padding: '0 14px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnSoft = { height: 30, padding: '0 12px', borderRadius: 8, border: '0.5px solid rgba(11,29,94,0.16)', background: 'rgba(11,29,94,0.055)', color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost = { height: 32, padding: '0 14px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: TEXT, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn = { background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 5px' }
const inp = { height: 34, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', color: TEXT, fontFamily: 'inherit', boxSizing: 'border-box' }
const menu = { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 230, background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 11, boxShadow: '0 12px 30px rgba(0,0,0,0.16)', padding: 6, zIndex: 30 }
const menuItem = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', color: TEXT }
