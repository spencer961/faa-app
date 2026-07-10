import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, BORDER, TEXT, MUTED, CARD, INP, BTNP, BTNS } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { CATS, SC, CYCLE, leafIds, pScore, health, initScores } from '../lib/successMap.js'
import { DSEC } from '../lib/onboardingSections.js'
import { getClientMode } from '../lib/clientMode.js'

// Success Map — migrated from portal.html. Consultant scores each client
// red/yellow/green across categories; health % = share of green items.
// Snapshots are saved to this browser for now (a bridge); permanent
// database saving is part of the planned database step.
// Left out from the original: fake login gate + demo-data testing panel.

const STORE_KEY = 'faa_success_snapshots'
const loadSnaps = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {} } catch { return {} } }
const saveSnaps = (s) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch { /* ignore */ } }

export default function SuccessMap() {
  const [clients, setClients] = useState([])
  const [snaps, setSnaps] = useState(loadSnaps) // {clientId: [{id,label,date,scores,notes}]}
  const [view, setView] = useState('home') // home | client | assessment | form
  const [selId, setSelId] = useState(null)
  const [selM, setSelM] = useState(null)
  const [exp, setExp] = useState({})
  const [ass, setAss] = useState({ scores: {}, label: '', notes: '' })
  const [searchParams] = useSearchParams()
  const cm = (searchParams.get('client') ? parseInt(searchParams.get('client')) : null) || getClientMode()

  useEffect(() => {
    supabase.from('clients').select('id,name,doctor,email,status,info').order('id').then(({ data }) => {
      if (Array.isArray(data)) setClients(data.map((r) => ({ ...r, answers: r.info || {} })))
    })
  }, [])

  // Client Mode: lock straight to that client's map.
  useEffect(() => { if (cm) { setSelId(cm); setView('client') } }, [cm])

  const client = clients.find((c) => c.id === selId)
  const clientSnaps = (id) => [...(snaps[id] || [])].sort((a, b) => new Date(a.date) - new Date(b.date))

  const startAssessment = (id, prefill) => {
    setSelId(id)
    const latest = clientSnaps(id).slice(-1)[0]
    setAss({ scores: prefill || latest?.scores || initScores(), label: new Date().toLocaleString('default', { month: 'short', year: 'numeric' }), notes: '' })
    setView('assessment')
  }
  const cycleScore = (id) => setAss((a) => ({ ...a, scores: { ...a.scores, [id]: CYCLE[a.scores[id] || 'red'] } }))
  const publish = () => {
    if (!ass.label.trim()) return
    const snap = { id: 's' + Date.now(), label: ass.label, date: new Date().toISOString(), scores: { ...ass.scores }, notes: ass.notes }
    const next = { ...snaps, [selId]: [...(snaps[selId] || []), snap] }
    setSnaps(next); saveSnaps(next)
    setSelM(snap.id); setView('client')
  }

  if (view === 'assessment' && client) return <Assessment client={client} ass={ass} setAss={setAss} cycleScore={cycleScore} onCancel={() => setView(clientSnaps(selId).length ? 'client' : 'home')} onPublish={publish} />
  if (view === 'form' && client) return <FormReview client={client} snaps={clientSnaps(selId)} onBack={() => setView('home')} onAssess={() => startAssessment(selId)} />
  if (view === 'client' && client) return <ClientMap client={client} snaps={clientSnaps(selId)} selM={selM} setSelM={setSelM} exp={exp} setExp={setExp} onBack={() => { setView('home'); setSelM(null) }} onAssess={(prefill) => startAssessment(selId, prefill)} onForm={() => setView('form')} />
  return <HomeView clients={cm ? clients.filter((c) => c.id === cm) : clients} snaps={snaps} onOpen={(id) => { setSelId(id); setSelM(null); setView('client') }} onForm={(id) => { setSelId(id); setView('form') }} onAssess={startAssessment} />
}

// ── HOME ────────────────────────────────────────────────────────────────
function HomeView({ clients, snaps, onOpen, onForm, onAssess }) {
  const latestH = (id) => { const s = (snaps[id] || []); return s.length ? health(s[s.length - 1].scores) : null }
  const scored = clients.filter((c) => latestH(c.id) !== null)
  const avg = scored.length ? Math.round(scored.reduce((a, c) => a + latestH(c.id), 0) / scored.length) : 0
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Success Map — Consultant view" back="/" />
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[['Total Clients', clients.length, NAVY], ['Assessed', scored.length, '#22c55e'], ['Avg Health', avg + '%', '#3b82f6']].map(([l, n, c]) => (
            <div key={l} style={{ ...CARD, padding: '16px 20px' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }}>{n}</div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 14 }}>Clients</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {clients.map((c) => {
            const s = clientSnapsSorted(snaps[c.id])
            const lat = s[s.length - 1], fst = s[0]
            const latH = lat ? health(lat.scores) : 0
            const gain = lat && fst ? latH - health(fst.scores) : 0
            return (
              <div key={c.id} style={{ ...CARD, cursor: 'pointer' }} onClick={() => onOpen(c.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{c.doctor || c.answers.doctorName || '—'}</div>
                  </div>
                  {lat ? <HealthBadge h={latH} /> : <span style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Not assessed</span>}
                </div>
                {lat && (
                  <div>
                    <CatBar scores={lat.scores} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 10 }}>
                      <span>{s.length} month{s.length !== 1 ? 's' : ''} tracked</span>
                      {s.length > 1 && <span style={{ color: gain >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{gain >= 0 ? '+' : ''}{gain}% since start</span>}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid ' + BORDER }}>
                  <button onClick={(e) => { e.stopPropagation(); onForm(c.id) }} style={{ ...BTNS, flex: 1, padding: '6px', fontSize: 11, textAlign: 'center' }}>View Form</button>
                  <button onClick={(e) => { e.stopPropagation(); onAssess(c.id, lat ? { ...lat.scores } : undefined) }} style={{ ...BTNP, flex: 1, padding: '6px', fontSize: 11, textAlign: 'center' }}>{lat ? 'New Month +' : 'Assess +'}</button>
                </div>
              </div>
            )
          })}
          {!clients.length && <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', gridColumn: '1/-1', color: MUTED, fontSize: 14 }}>Loading clients…</div>}
        </div>
      </div>
    </div>
  )
}
const clientSnapsSorted = (arr) => [...(arr || [])].sort((a, b) => new Date(a.date) - new Date(b.date))

// Friendly, client-facing status words + colors for the report.
const SMAP = { green: ['#22c55e', 'Strong'], yellow: ['#f59e0b', 'Building'], red: ['#ef4444', 'Needs attention'] }
// Shared layout for the scoring-panel screens: 20% left / 25% right page margins
// on desktop, dropped on tablet + mobile.
const SM_GRID_CSS = `.sm-assess-grid{padding:0 25% 0 20%;}@media(max-width:1024px){.sm-assess-grid{padding:0;}}`
// A one-word, plain-language read on the overall health score.
function healthSummary(h) {
  if (h >= 70) return 'Thriving'
  if (h >= 40) return 'On track'
  if (h >= 20) return 'Building'
  return 'Early stage'
}

// ── CLIENT MAP ────────────────────────────────────────────────────────
function ClientMap({ client, snaps, selM, setSelM, exp, setExp, onBack, onAssess, onForm }) {
  if (!snaps.length) {
    return (
      <div style={{ minHeight: '100vh', background: BG }}>
        <Header sub={client.name} back="/" right={<HdrBtn onClick={onBack}>← All clients</HdrBtn>} />
        <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px' }}>
          <div style={{ ...CARD, textAlign: 'center', padding: '48px 40px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 10 }}>No assessment yet</h2>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>Score this practice across the Success Map to see their health and track progress over time.</p>
            <button onClick={() => onAssess()} style={{ ...BTNP, background: GOLD, color: NAVY }}>Start Initial Assessment →</button>
          </div>
        </div>
      </div>
    )
  }
  const det = snaps.find((s) => s.id === selM) || snaps[snaps.length - 1]
  const ds = det.scores
  const DL = leafIds(CATS)
  const counts = { g: DL.filter((id) => (ds[id] || 'red') === 'green').length, y: DL.filter((id) => (ds[id] || 'red') === 'yellow').length, r: DL.filter((id) => (ds[id] || 'red') === 'red').length }
  const dh = health(ds)
  const hs = healthSummary(dh)
  const si = snaps.findIndex((s) => s.id === det.id)
  const prev = si > 0 ? snaps[si - 1] : null
  const delta = prev ? dh - health(prev.scores) : null
  const redItems = CATS.map((cat) => ({ cat: cat.name, items: cat.items.filter((i) => pScore(ds, i) === 'red') })).filter((x) => x.items.length)

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub={det.label} back="/" right={<div style={{ display: 'flex', gap: 8 }}>
        <HdrBtn onClick={onForm}>View Form</HdrBtn>
        <HdrBtn onClick={onBack}>← All clients</HdrBtn>
        <button onClick={() => onAssess({ ...snaps[snaps.length - 1].scores })} style={{ ...BTNP, background: GOLD, color: NAVY, fontSize: 12, padding: '7px 14px' }}>+ New Month</button>
      </div>} />
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{det.label} — Monthly Report</div><div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{client.name}</div></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{snaps.map((s) => (
            <button key={s.id} onClick={() => setSelM(s.id)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid ' + (s.id === det.id ? NAVY : BORDER), background: s.id === det.id ? NAVY : '#fff', color: s.id === det.id ? '#fff' : TEXT, fontSize: 12, cursor: 'pointer', fontWeight: s.id === det.id ? 600 : 400 }}>{s.label}</button>
          ))}</div>
        </div>
        {det.notes && <div style={{ ...CARD, marginBottom: 16, borderLeft: '3px solid ' + GOLD }}><div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Consultant Notes</div><div style={{ fontSize: 13, color: MUTED, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{det.notes}</div></div>}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{dh}<span style={{ fontSize: 20 }}>%</span></div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: dh >= 70 ? '#15803d' : '#92600b', background: dh >= 70 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.14)', borderRadius: 999, padding: '3px 11px' }}>{hs}</span>
                {delta !== null && <span style={{ fontSize: 12, fontWeight: 600, color: delta >= 0 ? '#16a34a' : '#dc2626' }}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts since {prev.label}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
            {counts.g > 0 && <div style={{ flex: counts.g, background: '#22c55e' }} />}
            {counts.y > 0 && <div style={{ flex: counts.y, background: '#f59e0b' }} />}
            {counts.r > 0 && <div style={{ flex: counts.r, background: '#ef4444' }} />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: MUTED, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle', marginRight: 5 }} />{counts.g} strong</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', verticalAlign: 'middle', marginRight: 5 }} />{counts.y} building</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', verticalAlign: 'middle', marginRight: 5 }} />{counts.r} need attention</span>
          </div>
        </div>
        {redItems.length > 0 && (
          <div style={{ ...CARD, border: '1.5px solid ' + NAVY, marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Focus here next</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>{(() => { const n = redItems.reduce((a, x) => a + x.items.length, 0); return n + ' area' + (n !== 1 ? 's' : '') + ' that need attention most this month' })()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {redItems.flatMap((x) => x.items.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1 }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{x.cat}</span>
                </div>
              )))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>By area</span>
          {(() => { const allOpen = CATS.every((c) => exp[c.id]); return (
            <button onClick={() => setExp(allOpen ? {} : Object.fromEntries(CATS.map((c) => [c.id, true])))} style={{ background: 'none', border: 'none', color: NAVY, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' }}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
          ) })()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {CATS.map((cat) => {
            const g = cat.items.filter((i) => pScore(ds, i) === 'green').length
            const r = cat.items.filter((i) => pScore(ds, i) === 'red').length
            const pct = Math.round((g / cat.items.length) * 100), io = exp[cat.id]
            return (
              <div key={cat.id} style={{ background: '#fff', border: '0.5px solid ' + BORDER, borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setExp((e) => ({ ...e, [cat.id]: !e[cat.id] }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: TEXT }}>{cat.name}</span>
                      {r > 0 && <span style={{ fontSize: 11, color: '#b91c1c', background: 'rgba(239,68,68,0.1)', borderRadius: 999, padding: '1px 8px' }}>{r} need attention</span>}
                    </div>
                    <div style={{ height: 6, background: BG, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: '#22c55e', borderRadius: 3 }} /></div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>{g} of {cat.items.length} strong</div>
                  <span style={{ color: '#c0c6d8', fontSize: 10 }}>{io ? '▲' : '▼'}</span>
                </div>
                {io && <div style={{ borderTop: '0.5px solid ' + BORDER, padding: '2px 14px 6px' }}>
                  {cat.items.map((item, ii) => { const sm = SMAP[pScore(ds, item)]; return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: ii < cat.items.length - 1 ? '0.5px solid ' + BORDER : 'none' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm[0], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: TEXT, flex: 1 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>{sm[1]}</span>
                    </div>
                  )})}
                </div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── ASSESSMENT ──────────────────────────────────────────────────────────
function Assessment({ client, ass, setAss, cycleScore, onCancel, onPublish }) {
  const ALL = leafIds(CATS)
  const gc = ALL.filter((id) => (ass.scores[id] || 'red') === 'green').length
  const yc = ALL.filter((id) => (ass.scores[id] || 'red') === 'yellow').length
  const rc = ALL.filter((id) => (ass.scores[id] || 'red') === 'red').length
  const hp = Math.round((gc / ALL.length) * 100)
  return (
    <div style={{ background: BG, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header sub="Assessment" right={<div style={{ display: 'flex', gap: 8 }}>
        <HdrBtn onClick={onCancel}>← Cancel</HdrBtn>
        <button onClick={onPublish} disabled={!ass.label.trim()} style={{ ...BTNP, background: GOLD, color: NAVY, opacity: ass.label.trim() ? 1 : 0.5 }}>Publish Assessment →</button>
      </div>} />
      <style>{SM_GRID_CSS}</style>
      <div className="sm-assess-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', flex: 1, overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', padding: 20 }}>
          <div style={{ ...CARD, marginBottom: 16, borderLeft: '3px solid ' + GOLD }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Assessment Details — {client.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Month Label</label>
                <input value={ass.label} onChange={(e) => setAss((a) => ({ ...a, label: e.target.value }))} placeholder="e.g. Jun 2025" style={INP} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 24 }}>
                {[[gc, 'Strong', '#22c55e'], [yc, 'In Progress', '#f59e0b'], [rc, 'Needs Work', '#ef4444'], [hp + '%', 'Health', NAVY]].map(([n, l, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>{n}</div><div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div></div>
                ))}
              </div>
            </div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Consultant Notes</div>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>These notes will be visible to the client after publishing.</p>
            <textarea value={ass.notes} onChange={(e) => setAss((a) => ({ ...a, notes: e.target.value }))} placeholder="Add your assessment, priorities, and action plan for this month..." rows={8} style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ height: 40 }} />
        </div>
        <ScoringPanel scores={ass.scores} onCycle={cycleScore} fillCell />
      </div>
    </div>
  )
}

// ── FORM REVIEW (read-only) ───────────────────────────────────────────
function FormReview({ client, snaps, onBack, onAssess }) {
  const a = client.answers || {}
  return (
    <div style={{ background: BG, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header sub="Form Review" right={<div style={{ display: 'flex', gap: 8 }}>
        <HdrBtn onClick={onBack}>← All clients</HdrBtn>
        <button onClick={onAssess} style={{ ...BTNP, background: GOLD, color: NAVY }}>{snaps.length ? 'New Assessment →' : 'Start Assessment →'}</button>
      </div>} />
      <style>{SM_GRID_CSS}</style>
      <div className="sm-assess-grid" style={{ display: 'grid', gridTemplateColumns: snaps.length ? '1.3fr 1fr' : '1fr', flex: 1, overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Onboarding Form</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{client.name}</div>
            </div>
            {DSEC.map((sec) => (
              <div key={sec.id} style={{ ...CARD, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{sec.title}</div>
                {sec.fields.map((f, fi) => { const val = a[f.id]; return (
                  <div key={f.id} style={{ marginBottom: fi < sec.fields.length - 1 ? 14 : 0, paddingBottom: fi < sec.fields.length - 1 ? 14 : 0, borderBottom: fi < sec.fields.length - 1 ? '1px solid ' + BORDER : 'none' }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 5 }}>{f.label}</div>
                    {!val || (Array.isArray(val) && !val.length)
                      ? <div style={{ fontSize: 12, color: '#c0c6d8', fontStyle: 'italic' }}>Not answered</div>
                      : Array.isArray(val)
                        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{val.map((v) => <span key={v} style={{ padding: '3px 9px', borderRadius: 20, background: 'rgba(11,29,94,0.07)', border: '1px solid rgba(11,29,94,0.12)', fontSize: 12, color: NAVY, fontWeight: 500 }}>{v}</span>)}</div>
                        : <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{val}</div>}
                  </div>
                )})}
              </div>
            ))}
            <div style={{ height: 40 }} />
          </div>
        </div>
        {snaps.length > 0 && <ScoringPanel scores={snaps[snaps.length - 1].scores} onCycle={null} fillCell />}
      </div>
    </div>
  )
}

// ── SHARED BITS ───────────────────────────────────────────────────────
function Dot({ s, size = 26 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: SC[s], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 22 ? 11 : 10, color: '#fff', fontWeight: 700, flexShrink: 0, boxShadow: '0 0 8px ' + SC[s] + '55' }}>{s === 'green' ? '✓' : s === 'yellow' ? '~' : '!'}</div>
}
function HealthBadge({ h }) {
  const col = h >= 70 ? '#22c55e' : h >= 40 ? '#f59e0b' : '#ef4444'
  const bg = h >= 70 ? 'rgba(34,197,94,0.08)' : h >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'
  return <span style={{ padding: '3px 9px', borderRadius: 20, background: bg, border: '1px solid ' + col + '33', fontSize: 12, fontWeight: 700, color: col }}>{h}%</span>
}
function CatBar({ scores }) {
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
      {CATS.map((cat) => { const g = cat.items.filter((i) => pScore(scores, i) === 'green').length, y = cat.items.filter((i) => pScore(scores, i) === 'yellow').length, r = cat.items.filter((i) => pScore(scores, i) === 'red').length, t = cat.items.length; return (
        <span key={cat.id} style={{ display: 'flex', flex: 1, gap: 1 }}>
          {g > 0 && <span style={{ flex: g / t, background: '#22c55e', minWidth: 2 }} />}
          {y > 0 && <span style={{ flex: y / t, background: '#f59e0b', minWidth: 2 }} />}
          {r > 0 && <span style={{ flex: r / t, background: '#ef4444', minWidth: 2 }} />}
        </span>
      )})}
    </div>
  )
}
function HdrBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{children}</button>
}
function ScoringPanel({ scores, onCycle, fillCell }) {
  const ALL = leafIds(CATS)
  const hp = Math.round((ALL.filter((id) => (scores[id] || 'red') === 'green').length / ALL.length) * 100)
  return (
    <div style={{ background: '#fff', borderLeft: '1px solid ' + BORDER, overflowY: 'auto', padding: '18px 16px', width: fillCell ? '100%' : 408, flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Success Map Scoring</div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>{onCycle ? 'Click any dot to cycle: Red → Yellow → Green' : 'Latest scores'}</div>
      <div style={{ padding: '12px 16px', background: BG, borderRadius: 10, border: '0.5px solid ' + BORDER, marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{hp}%</span><span style={{ fontSize: 12, color: MUTED }}>overall health</span>
      </div>
      {CATS.map((cat, ci) => {
        const catP = Math.round((cat.items.filter((i) => pScore(scores, i) === 'green').length / cat.items.length) * 100)
        return (
          <div key={cat.id}>
            {ci > 0 && <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '4px 4px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{cat.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: catP >= 70 ? '#22c55e' : catP >= 40 ? '#f59e0b' : '#ef4444' }}>{catP}%</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cat.items.map((item) => {
                const ps = pScore(scores, item)
                if (!item.subs) return (
                  <div key={item.id} onClick={() => onCycle && onCycle(item.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 8, cursor: onCycle ? 'pointer' : 'default', background: '#f4f5f9' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{item.name}</span><Dot s={ps} size={26} />
                  </div>
                )
                return (
                  <div key={item.id} style={{ background: '#f4f5f9', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, padding: '9px 10px 6px 12px' }}>{item.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {item.subs.map((sub) => { const ss = scores[sub.id] || 'red'; return (
                        <div key={sub.id} onClick={() => onCycle && onCycle(sub.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 8px 20px', cursor: onCycle ? 'pointer' : 'default', background: '#eceef4', borderTop: '1px solid #e0e2ea' }}>
                          <span style={{ fontSize: 12, color: MUTED }}>{sub.name}</span><Dot s={ss} size={22} />
                        </div>
                      )})}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
