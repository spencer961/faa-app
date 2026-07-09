import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED, CARD } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { aggregate, METRICS, fmtVal } from '../lib/metrics.js'
import { health, leafIds, CATS } from '../lib/successMap.js'
import { getClientMode } from '../lib/clientMode.js'

// Client Portal — the client's-eye view. As admin you pick a client and
// preview their portal; later, logins drop each client straight onto
// their own. Shows an at-a-glance summary + quick links into each tool.

const SL = { not_started: 'Not Started', in_progress: 'In Progress', waiting: 'Waiting', done: 'Done' }
const SC = { not_started: '#888786', in_progress: '#1a7fd4', waiting: '#e07b0a', done: '#18a866' }
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
const loadSnaps = () => { try { return JSON.parse(localStorage.getItem('faa_success_snapshots')) || {} } catch { return {} } }

export default function ClientPortal() {
  const [searchParams] = useSearchParams()
  const locked = (searchParams.get('client') ? parseInt(searchParams.get('client')) : null) || getClientMode()
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [metricsByClient, setMetricsByClient] = useState({})
  const [snaps] = useState(loadSnaps)
  const [selId, setSelId] = useState(locked)

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,doctor,email,status,info').order('id')
      if (Array.isArray(cs)) setClients(cs)
      const { data: ts } = await supabase.from('tasks').select('id,title,status,client_id')
      if (Array.isArray(ts)) setTasks(ts)
      const { data: mrows } = await supabase.from('metrics_tracker').select('client_id,period,date_key,data')
      if (Array.isArray(mrows)) {
        const by = {}
        mrows.filter((r) => r.period === 'daily').forEach((r) => { by[r.client_id] = by[r.client_id] || {}; by[r.client_id][r.date_key] = r.data || {} })
        setMetricsByClient(by)
      }
    })()
  }, [])

  const latestHealth = (id) => { const s = snaps[id] || []; if (!s.length) return null; const l = [...s].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-1)[0]; return health(l.scores) }
  const client = clients.find((c) => c.id === selId)

  // Admin picker — hidden once logins scope a client to their own portal.
  if (!client) {
    return (
      <div style={{ minHeight: '100vh', background: BG }}>
        <Header sub="Client Portal" back="/" />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Client Portals</h1>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>Pick a client to preview the portal they see on their end.</p>
          {!clients.length && <div style={{ color: MUTED, fontStyle: 'italic' }}>Loading clients…</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
            {clients.map((c) => {
              const hp = latestHealth(c.id)
              return (
                <button key={c.id} onClick={() => setSelId(c.id)} style={{ ...CARD, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{ini(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{hp === null ? 'Not assessed' : hp + '% progress'}</div>
                  </div>
                  <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, flexShrink: 0 }}>View →</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return <PortalView client={client} tasks={tasks} snaps={snaps} metricsByClient={metricsByClient} adminBack={locked ? null : () => setSelId(null)} />
}

function PortalView({ client, tasks, snaps, metricsByClient, adminBack }) {
  const M = (id) => METRICS.find((m) => m.id === id)
  const snapList = [...(snaps[client.id] || [])].sort((a, b) => new Date(a.date) - new Date(b.date))
  const latest = snapList[snapList.length - 1]
  const hp = latest ? health(latest.scores) : null
  const totalAreas = leafIds(CATS).length
  const greenCount = latest ? leafIds(CATS).filter((id) => (latest.scores[id] || 'red') === 'green').length : 0

  const daily = metricsByClient[client.id] || {}
  const keys = Object.keys(daily).sort().slice(-7)
  const wk = keys.length ? aggregate(keys.map((k) => daily[k])) : null

  const openTasks = tasks.filter((t) => t.client_id === client.id && t.status !== 'done')

  const link = (path) => `${path}?client=${client.id}`

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Portal" back="/" right={adminBack && (
        <button onClick={adminBack} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>← All portals</button>
      )} />
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Welcome</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT, marginTop: 2 }}>{client.name}</h1>
        </div>

        {/* Progress hero */}
        <div style={{ ...CARD, padding: '24px 26px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Your Success Map progress</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{hp === null ? 'Your consultant will complete your first assessment soon.' : `${greenCount} of ${totalAreas} areas fully optimized`}</div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: hp === null ? MUTED : GOLD, lineHeight: 1 }}>{hp === null ? '—' : hp + '%'}</div>
          </div>
          <div style={{ height: 10, background: '#eceae7', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (hp || 0) + '%', background: GOLD, borderRadius: 5, transition: 'width .5s' }} />
          </div>
        </div>

        {/* This week + To-dos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>This week</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Last 7 days of activity</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['Leads', wk ? wk.leads : '—'], ['Closed', wk ? wk.total_closed_tx || 0 : '—'], ['Revenue', wk ? fmtVal(M('total_revenue'), wk.total_revenue, true) : '—']].map(([l, v]) => (
                <div key={l} style={{ flex: 1, background: BG, borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Your to-do list</div>
              {openTasks.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#8a6a3c', background: 'rgba(188,151,98,0.15)', borderRadius: 999, padding: '2px 8px' }}>{openTasks.length} open</span>}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>What's on your plate</div>
            {openTasks.length === 0 ? (
              <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', padding: '8px 0' }}>You're all caught up 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {openTasks.slice(0, 5).map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: SC[t.status] || SC.not_started, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: TEXT, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    <span style={{ fontSize: 10, color: SC[t.status] || SC.not_started, flexShrink: 0 }}>{SL[t.status] || 'To do'}</span>
                  </div>
                ))}
                {openTasks.length > 5 && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>+ {openTasks.length - 5} more</div>}
              </div>
            )}
          </div>
        </div>

        {/* Quick tool links */}
        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Your tools</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {[
            { to: link('/success-map'), name: 'Success Map', desc: 'See your progress & consultant notes' },
            { to: link('/metrics'), name: 'Metrics', desc: 'Track your leads, consults & revenue' },
            { to: link('/tasks'), name: 'To-Do List', desc: 'Your action items' },
          ].map((t) => (
            <Link key={t.to} to={t.to} style={{ ...CARD, display: 'block', borderLeft: '4px solid ' + GOLD }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 3 }}>{t.name} →</div>
              <div style={{ fontSize: 12, color: MUTED }}>{t.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
