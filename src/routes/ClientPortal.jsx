import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED, CARD } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { aggregate, METRICS, fmtVal } from '../lib/metrics.js'
import { health, leafIds, CATS } from '../lib/successMap.js'
import { getClientMode } from '../lib/clientMode.js'
import { DEFAULT_TIERS, getClientTiers, MODULES, DEFAULT_TIER_ACCESS, accessForClient } from '../lib/tiers.js'
import { isAdmin } from '../lib/auth.js'
import { isArchived } from '../lib/archive.js'

// Client Portal — the client's-eye view. As admin you pick a client and
// preview their portal; later, logins drop each client straight onto
// their own. Shows an at-a-glance summary + quick links into each tool.

const SL = { not_started: 'Not Started', in_progress: 'In Progress', waiting: 'Waiting', done: 'Done' }
const SC = { not_started: '#888786', in_progress: '#1a7fd4', waiting: '#e07b0a', done: '#18a866' }
const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
const loadSnaps = () => { try { return JSON.parse(localStorage.getItem('faa_success_snapshots')) || {} } catch { return {} } }
const pill = (active) => ({ padding: '5px 14px', border: '0.5px solid ' + (active ? GOLD : 'rgba(0,0,0,0.15)'), borderRadius: 999, background: active ? NAVY : '#fff', color: active ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' })

export default function ClientPortal() {
  const [searchParams] = useSearchParams()
  const locked = (searchParams.get('client') ? parseInt(searchParams.get('client')) : null) || getClientMode()
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [metricsByClient, setMetricsByClient] = useState({})
  const [snaps] = useState(loadSnaps)
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [tierFilter, setTierFilter] = useState('all')
  const [appData, setAppData] = useState({})
  const [tierAccess, setTierAccess] = useState(DEFAULT_TIER_ACCESS)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
      const { data: st } = await supabase.from('app_state').select('data').eq('id', 'gmj_main').maybeSingle()
      if (st?.data) {
        setAppData(st.data)
        if (Array.isArray(st.data.tiers) && st.data.tiers.length) setTiers(st.data.tiers)
        if (st.data.tierAccess) setTierAccess({ ...DEFAULT_TIER_ACCESS, ...st.data.tierAccess })
      }
    })()
  }, [])

  const persistAccess = async (next) => {
    setTierAccess(next)
    const data = { ...appData, tierAccess: next }
    setAppData(data)
    await supabase.from('app_state').upsert({ id: 'gmj_main', data, updated_at: new Date().toISOString() })
  }
  const latestHealth = (id) => { const s = snaps[id] || []; if (!s.length) return null; const l = [...s].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-1)[0]; return health(l.scores) }
  const client = clients.find((c) => c.id === selId)

  // Admin picker — hidden once logins scope a client to their own portal.
  if (!client) {
    return (
      <div style={{ minHeight: '100vh', background: BG }}>
        <Header sub="Client Portal" back="/" right={isAdmin() ? (
          <button onClick={() => setSettingsOpen(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>⚙ Access settings</button>
        ) : null} />
        {isAdmin() && settingsOpen && <AccessSettingsModal tiers={tiers} access={tierAccess} onSave={persistAccess} onClose={() => setSettingsOpen(false)} />}
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Client Portals</h1>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>Everyone across your memberships. Pick a client to preview the portal they see on their end.</p>
          {tiers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
              <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membership</span>
              <button onClick={() => setTierFilter('all')} style={pill(tierFilter === 'all')}>All</button>
              {tiers.map((t) => <button key={t.id} onClick={() => setTierFilter(t.id)} style={pill(tierFilter === t.id)}>{t.name}</button>)}
            </div>
          )}
          {!clients.length && <div style={{ color: MUTED, fontStyle: 'italic' }}>Loading clients…</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
            {clients.filter((c) => !isArchived(c) && (tierFilter === 'all' || getClientTiers(c).includes(tierFilter))).map((c) => {
              const hp = latestHealth(c.id)
              const ct = getClientTiers(c)
              return (
                <button key={c.id} onClick={() => setSelId(c.id)} style={{ ...CARD, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{ini(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{hp === null ? 'Not assessed' : hp + '% progress'}</div>
                    {ct.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {ct.map((id) => { const t = tiers.find((x) => x.id === id); if (!t) return null; return <span key={id} style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: t.color + '1a', color: t.color }}>{t.name}</span> })}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>View →</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return <PortalView client={client} tasks={tasks} snaps={snaps} metricsByClient={metricsByClient} tierAccess={tierAccess} adminBack={locked ? null : () => setSelId(null)} />
}

function PortalView({ client, tasks, snaps, metricsByClient, tierAccess, adminBack }) {
  const M = (id) => METRICS.find((m) => m.id === id)
  const access = accessForClient(client, tierAccess)
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

  const tools = [
    access.success_map && { to: link('/success-map'), name: 'Success Map', desc: 'See your progress & consultant notes' },
    access.metrics && { to: link('/metrics'), name: 'Metrics', desc: 'Track your leads, consults & revenue' },
    access.tasks && { to: link('/tasks'), name: 'To-Do List', desc: 'Your action items' },
  ].filter(Boolean)
  const nothing = !access.success_map && !access.metrics && !access.tasks && !access.guides

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

        {nothing && <div style={{ ...CARD, textAlign: 'center', padding: 40, color: MUTED }}>No tools are enabled for this membership yet. Set what they can see under <strong style={{ color: TEXT }}>Access settings</strong>.</div>}

        {access.success_map && (
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
        )}

        {(access.metrics || access.tasks) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 16 }}>
            {access.metrics && (
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
            )}
            {access.tasks && (
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
            )}
          </div>
        )}

        {access.guides && (
          <div style={{ ...CARD, marginBottom: 16, borderLeft: '4px solid ' + GOLD }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>Guides &amp; training</div>
            <div style={{ fontSize: 12, color: MUTED }}>Your library of guides and training videos will appear here.</div>
          </div>
        )}

        {tools.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Your tools</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              {tools.map((t) => (
                <Link key={t.to} to={t.to} target="_blank" rel="noopener" style={{ ...CARD, display: 'block', borderLeft: '4px solid ' + GOLD }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 3 }}>{t.name} →</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{t.desc}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AccessSettingsModal({ tiers, access, onSave, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(access || {})))
  const toggle = (tierId, modId) => setDraft((d) => ({ ...d, [tierId]: { ...(d[tierId] || {}), [modId]: !(d[tierId] || {})[modId] } }))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 660, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 4 }}>Access settings</h3>
        <p style={{ fontSize: 12, color: MUTED, marginBottom: 18 }}>Choose what each membership tier can see in their portal. A client sees everything their tiers unlock.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tier</th>
                {MODULES.map((m) => <th key={m.id} style={{ padding: '8px 10px', fontSize: 11, color: MUTED, fontWeight: 600, textAlign: 'center' }}>{m.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <td style={{ padding: '10px', fontSize: 13, fontWeight: 500, color: t.color, whiteSpace: 'nowrap' }}>{t.name}</td>
                  {MODULES.map((m) => { const on = !!(draft[t.id] || {})[m.id]; return (
                    <td key={m.id} style={{ padding: '10px', textAlign: 'center' }}>
                      <button onClick={() => toggle(t.id, m.id)} title={t.name + ' · ' + m.name} style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', border: '0.5px solid ' + (on ? '#18a866' : 'rgba(0,0,0,0.18)'), background: on ? '#18a866' : '#fff', color: '#fff', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</button>
                    </td>
                  )})}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose() }} style={{ height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: NAVY, color: GOLD, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
        </div>
      </div>
    </div>
  )
}
