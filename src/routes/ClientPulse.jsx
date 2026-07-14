import { useState, useEffect } from 'react'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { health as calcHealth } from '../lib/successMap.js'
import { getClientTiers } from '../lib/tiers.js'

// ─────────────────────────────────────────────────────────────────────
// Client Pulse — a shared review desk between you and your assistant.
// She drops in docs/links to review and plain-language "heads up" email
// summaries; you check them off and leave a note on what to do. Priority
// triages the board. Notes stay in sync with the client profile. All of it
// lives on each client's `info` blob — no schema change.
// ─────────────────────────────────────────────────────────────────────

const PRIOS = [['high', 'High priority', '#ef4444'], ['medium', 'Needs a look', '#f59e0b'], ['low', 'Steady', '#22c55e']]
const PRIO_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
const STATUSES = [['on_track', 'On track', '#18734a', 'rgba(24,168,102,0.12)'], ['watch', 'Watch', '#92600b', 'rgba(245,158,11,0.16)'], ['at_risk', 'At risk', '#b91c1c', 'rgba(239,68,68,0.1)']]
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
const loadSnaps = () => { try { return JSON.parse(localStorage.getItem('faa_success_snapshots')) || {} } catch { return {} } }
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '' } }
const sd = (iso) => { try { const d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2) } catch { return '' } }

export default function ClientPulse() {
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [snaps] = useState(loadSnaps)
  const [sel, setSel] = useState(null)
  const [filter, setFilter] = useState('consulting')

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,info,status').order('id')
      if (Array.isArray(cs)) setClients(cs)
      const { data: ts } = await supabase.from('tasks').select('id,status,client_id')
      if (Array.isArray(ts)) setTasks(ts)
    })()
  }, [])

  async function patchClient(id, patchObj) {
    const c = clients.find((x) => x.id === id)
    const info = { ...(c?.info || {}), ...patchObj }
    setClients((cs) => cs.map((x) => (x.id === id ? { ...x, info } : x)))
    await supabase.from('clients').update({ info, updated_at: new Date().toISOString() }).eq('id', id)
  }
  const updateItem = (id, key, itemId, changes) => { const c = clients.find((x) => x.id === id); patchClient(id, { [key]: (c.info?.[key] || []).map((it) => (it.id === itemId ? { ...it, ...changes } : it)) }) }
  const addItem = (id, key, item) => { const c = clients.find((x) => x.id === id); patchClient(id, { [key]: [...(c.info?.[key] || []), item] }) }
  const removeItem = (id, key, itemId) => { const c = clients.find((x) => x.id === id); patchClient(id, { [key]: (c.info?.[key] || []).filter((it) => it.id !== itemId) }) }

  const openTasks = (id) => tasks.filter((t) => t.client_id === id && t.status !== 'done').length
  const clientHealth = (id) => { const s = snaps[id]; if (!Array.isArray(s) || !s.length) return null; return calcHealth(s[s.length - 1].scores) }
  const reviewOpen = (c) => (c.info?.reviewItems || []).filter((i) => !i.done).length
  const fyiOpen = (c) => (c.info?.headsUp || []).filter((i) => !i.seen).length

  const isConsulting = (c) => { const t = getClientTiers(c); return t.length === 0 || t.includes('consulting') }
  const shown = clients.filter((c) => filter === 'all' || isConsulting(c))
  const selClient = sel != null ? clients.find((c) => c.id === sel) : null

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Pulse" back="/" />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 60px' }}>
        {selClient ? (
          <Individual c={selClient} onBack={() => setSel(null)} openTasks={openTasks(selClient.id)} healthPct={clientHealth(selClient.id)}
            patchClient={patchClient} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />
        ) : (
          <Overview groups={PRIOS.map(([key, label, color]) => ({ key, label, color, items: shown.filter((c) => (c.info?.priority || 'medium') === key) }))}
            filter={filter} setFilter={setFilter} onOpen={setSel} openTasks={openTasks} clientHealth={clientHealth} reviewOpen={reviewOpen} fyiOpen={fyiOpen} />
        )}
      </div>
    </div>
  )
}

function Overview({ groups, filter, setFilter, onOpen, openTasks, clientHealth, reviewOpen, fyiOpen }) {
  const [view, setView] = useState('expanded')
  const total = groups.reduce((a, g) => a + g.items.length, 0)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: TEXT, margin: 0 }}>Client Pulse</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>What needs you across your clients — the docs to review and the heads-up your assistant leaves, all in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', gap: 3, background: '#eeece8', borderRadius: 999, padding: 3 }}>
            {[['expanded', 'Expanded'], ['compact', 'Compact']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 999, border: 'none', background: view === v ? '#fff' : 'transparent', color: view === v ? NAVY : MUTED, fontSize: 12, fontWeight: view === v ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['consulting', 'Consulting'], ['all', 'All clients']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} style={pill(filter === v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {total === 0 && <div style={{ textAlign: 'center', color: MUTED, padding: 50, fontStyle: 'italic' }}>No clients here yet.</div>}
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }}>{g.label}</span>
            <span style={{ fontSize: 11, color: MUTED }}>({g.items.length})</span>
          </div>
          {view === 'compact' ? (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, overflow: 'hidden' }}>
              {g.items.map((c, i) => {
                const st = STATUSES.find((s) => s[0] === c.info?.status)
                const rO = reviewOpen(c), fO = fyiOpen(c), h = clientHealth(c.id), ot = openTasks(c.id)
                return (
                  <div key={c.id} onClick={() => onOpen(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderLeft: '3px solid ' + g.color, borderBottom: i < g.items.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{c.name}</span>
                        {st && <span style={{ fontSize: 11, color: st[2], background: st[3], borderRadius: 999, padding: '1px 9px' }}>{st[1]}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: (rO || fO) ? '#8a6a3c' : MUTED, marginTop: 3 }}>
                        {(rO || fO) ? [rO ? rO + ' to review' : null, fO ? fO + ' heads-up' : null].filter(Boolean).join(' · ') : 'All caught up'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
                      <span title="Open to-dos">{ot} to-dos</span>
                      {h !== null && <span title="Success Map health">{h}% health</span>}
                    </div>
                    <span style={{ color: '#c0c6d8', fontSize: 15 }}>›</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 10 }}>
              {g.items.map((c) => <ExpandedCard key={c.id} c={c} color={g.color} onOpen={onOpen} ot={openTasks(c.id)} h={clientHealth(c.id)} />)}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function ExpandedCard({ c, color, onOpen, ot, h }) {
  const st = STATUSES.find((s) => s[0] === c.info?.status)
  const rev = (c.info?.reviewItems || []).filter((i) => !i.done)
  const fyi = (c.info?.headsUp || []).filter((i) => !i.seen)
  const line = (it) => (
    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c0c6d8', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
      {it.kind && <span style={{ fontSize: 10, color: MUTED, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0 5px', flexShrink: 0 }}>{it.kind}</span>}
    </div>
  )
  return (
    <div onClick={() => onOpen(c.id)} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderLeft: '3px solid ' + color, borderRadius: 10, padding: '13px 15px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: (rev.length || fyi.length) ? 10 : 0 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{c.name}</span>
        {st && <span style={{ fontSize: 11, color: st[2], background: st[3], borderRadius: 999, padding: '1px 9px' }}>{st[1]}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
          <span title="Open to-dos">{ot} to-dos</span>{h !== null && <span title="Success Map health">{h}%</span>}
        </span>
      </div>
      {rev.length > 0 && (
        <div style={{ marginBottom: fyi.length ? 10 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8a6a3c', marginBottom: 3 }}>To review ({rev.length})</div>
          {rev.slice(0, 4).map(line)}
          {rev.length > 4 && <div style={{ fontSize: 11, color: MUTED, paddingLeft: 14 }}>+{rev.length - 4} more</div>}
        </div>
      )}
      {fyi.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#92600b', marginBottom: 3 }}>Heads up ({fyi.length})</div>
          {fyi.slice(0, 4).map(line)}
          {fyi.length > 4 && <div style={{ fontSize: 11, color: MUTED, paddingLeft: 14 }}>+{fyi.length - 4} more</div>}
        </div>
      )}
      {rev.length === 0 && fyi.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>All caught up</div>}
    </div>
  )
}

function Individual({ c, onBack, openTasks, healthPct, patchClient, addItem, updateItem, removeItem }) {
  const info = c.info || {}
  const priority = info.priority || 'medium'
  const status = info.status || ''
  const review = info.reviewItems || []
  const heads = info.headsUp || []
  const notes = [...(info.notesLog || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  // Checking an item off logs it to the client notes (so the profile has the
  // full record), the first time it's completed.
  const toggleItem = (key, it, doneKey) => {
    const nowDone = !it[doneKey]
    const changes = { [doneKey]: nowDone }
    const patchObj = {}
    if (nowDone && !it.logged) {
      changes.logged = true
      const verb = key === 'reviewItems' ? 'Reviewed' : 'Noted'
      patchObj.notesLog = [...(info.notesLog || []), { id: 'n' + Date.now(), text: verb + ': ' + it.title + (it.reply ? ' — ' + it.reply : ''), createdAt: new Date().toISOString(), editedAt: null, history: [], source: 'pulse' }]
    }
    patchObj[key] = (info[key] || []).map((x) => (x.id === it.id ? { ...x, ...changes } : x))
    patchClient(c.id, patchObj)
  }
  return (
    <>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: 14 }}>← Back to board</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{ini(c.name)}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{c.name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{openTasks} open to-dos{healthPct !== null ? ' · ' + healthPct + '% health' : ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={fieldLabel}>Priority</div>
          <Segmented options={PRIOS.map((p) => [p[0], p[1]])} value={priority} colorMap={PRIO_COLOR} onChange={(v) => patchClient(c.id, { priority: v })} />
        </div>
        <div>
          <div style={fieldLabel}>Status</div>
          <Segmented options={STATUSES.map((s) => [s[0], s[1]])} value={status} onChange={(v) => patchClient(c.id, { status: v })} />
        </div>
      </div>

      <Section title="To review" count={review.filter((i) => !i.done).length}>
        {review.length === 0 && <Empty>Nothing to review right now.</Empty>}
        {review.map((it) => <ItemRow key={it.id} it={it} doneKey="done" hasLink onToggle={() => toggleItem('reviewItems', it, 'done')} onReply={(v) => updateItem(c.id, 'reviewItems', it.id, { reply: v })} onRemove={() => removeItem(c.id, 'reviewItems', it.id)} />)}
        <ItemComposer hasLink onAdd={(o) => addItem(c.id, 'reviewItems', { id: uid(), done: false, reply: '', createdAt: new Date().toISOString(), ...o })} />
      </Section>

      <Section title="Heads up" count={heads.filter((i) => !i.seen).length}>
        {heads.length === 0 && <Empty>No heads-up items.</Empty>}
        {heads.map((it) => <ItemRow key={it.id} it={it} doneKey="seen" onToggle={() => toggleItem('headsUp', it, 'seen')} onReply={(v) => updateItem(c.id, 'headsUp', it.id, { reply: v })} onRemove={() => removeItem(c.id, 'headsUp', it.id)} />)}
        <ItemComposer onAdd={(o) => addItem(c.id, 'headsUp', { id: uid(), seen: false, reply: '', createdAt: new Date().toISOString(), ...o })} />
      </Section>

      <Section title="Notes" sub="Synced with the client profile">
        <NoteAdd onAdd={(text) => addItem(c.id, 'notesLog', { id: 'n' + Date.now(), text, createdAt: new Date().toISOString(), editedAt: null, history: [] })} />
        {notes.length === 0 && <Empty>No notes yet.</Empty>}
        {notes.map((n, idx) => {
          const lines = (n.text || '').split('\n'); const title = lines[0]; const body = lines.slice(1).join('\n').replace(/^\n+|\n+$/g, '')
          return (
            <div key={n.id} style={{ padding: '8px 0', borderTop: idx > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}><span style={{ color: GOLD }}>{sd(n.createdAt)}</span>&nbsp; {title}</div>
              {body && <div style={{ fontSize: 13, color: '#44443f', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: 2 }}>{body}</div>}
            </div>
          )
        })}
      </Section>
    </>
  )
}

function ItemRow({ it, doneKey, hasLink, onToggle, onReply, onRemove }) {
  const done = it[doneKey]
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '11px 13px', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <button onClick={onToggle} aria-label="Mark done" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (done ? '#18a866' : 'rgba(0,0,0,0.25)'), background: done ? '#18a866' : '#fff', color: '#fff', cursor: 'pointer', marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1, padding: 0 }}>{done ? '✓' : ''}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: done ? 0.55 : 1 }}>
            {hasLink && it.url
              ? <a href={it.url} target="_blank" rel="noopener" style={{ fontSize: 14, color: NAVY, fontWeight: 500, textDecoration: done ? 'line-through' : 'none' }}>{it.title} ↗</a>
              : <span style={{ fontSize: 14, color: TEXT, textDecoration: done ? 'line-through' : 'none' }}>{it.title}</span>}
            {it.kind && <span style={{ fontSize: 10, color: MUTED, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0 6px' }}>{it.kind}</span>}
            <button onClick={onRemove} title="Remove" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {it.note && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4 }}><span style={{ color: '#a0a09e' }}>assistant:</span> {it.note}</div>}
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

function ItemComposer({ hasLink, onAdd }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', url: '', kind: '', note: '' })
  const reset = () => setF({ title: '', url: '', kind: '', note: '' })
  const submit = () => { if (!f.title.trim()) return; onAdd({ title: f.title.trim(), url: f.url.trim() || null, kind: f.kind.trim() || null, note: f.note.trim() || '' }); reset(); setOpen(false) }
  if (!open) return <button onClick={() => setOpen(true)} style={{ marginTop: 10, ...addRow }}>+ Add {hasLink ? 'something to review' : 'a heads-up'}</button>
  return (
    <div style={{ marginTop: 10, border: '0.5px dashed rgba(0,0,0,0.25)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={hasLink ? 'What is it? (e.g. New consult script)' : 'What happened? (e.g. Owner emailed about close rate)'} style={inp} />
      {hasLink && <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link — Google Drive, Doc, sheet… (optional)" style={inp} />}
      {hasLink && <input value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} placeholder="Type — PDF, Doc, Sheet… (optional)" style={inp} />}
      <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note — what this is / what to do with it" style={{ ...inp, minHeight: 48, resize: 'vertical' }} />
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
    <div style={{ display: 'flex', gap: 8 }}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Add a note…" style={{ ...inp, minHeight: 40, resize: 'vertical', flex: 1 }} />
      <button onClick={() => { if (t.trim()) { onAdd(t.trim()); setT('') } }} style={btnPrimary}>Add note</button>
    </div>
  )
}

function Segmented({ options, value, onChange, colorMap }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: '#eeece8', borderRadius: 999, padding: 3 }}>
      {options.map(([v, l]) => { const on = value === v; return (
        <button key={v} onClick={() => onChange(v)} style={{ padding: '5px 14px', borderRadius: 999, border: 'none', background: on ? '#fff' : 'transparent', color: on ? (colorMap?.[v] || NAVY) : MUTED, fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{l}</button>
      ) })}
    </div>
  )
}

function Section({ title, count, sub, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sub ? 2 : 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{title}</span>
        {count > 0 && <span style={{ fontSize: 11, color: '#8a6a3c', background: 'rgba(188,151,98,0.18)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{sub}</div>}
      {children}
    </div>
  )
}

function Empty({ children }) { return <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', padding: '4px 2px' }}>{children}</div> }

const pill = (a) => ({ padding: '5px 14px', border: '0.5px solid ' + (a ? NAVY : 'rgba(0,0,0,0.15)'), borderRadius: 999, background: a ? NAVY : '#fff', color: a ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' })
const fieldLabel = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, marginBottom: 6 }
const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }
const addRow = { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: '0.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, color: MUTED, fontSize: 13, cursor: 'pointer', background: 'none', width: '100%', fontFamily: 'inherit' }
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: TEXT, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary = { padding: '7px 16px', borderRadius: 8, border: 'none', background: NAVY, color: GOLD, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const linkBtn = { background: 'none', border: 'none', color: NAVY, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
