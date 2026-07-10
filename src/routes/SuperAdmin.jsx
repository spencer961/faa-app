import { useState, useEffect } from 'react'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED } from '../lib/theme.js'
import { supabase, SUPABASE_URL, SB_HEADERS } from '../lib/supabase.js'
import { isSuperAdmin } from '../lib/auth.js'
import { DEFAULT_TIERS, TIER_PALETTE, MODULES, DEFAULT_TIER_ACCESS } from '../lib/tiers.js'

// ─────────────────────────────────────────────────────────────────────
// Super Admin — the owner's control panel for running and scaling the
// business. Some sections are LIVE (tiers, access, pricing, branding,
// backup export). Others are laid out now as a PLANNED scaffold so we can
// see the shape of what we'll need when we add logins, Stripe, and the
// guide store. No login gate yet — isSuperAdmin() is a placeholder.
// ─────────────────────────────────────────────────────────────────────

const STATE_ID = 'gmj_main'
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function SuperAdmin() {
  const [data, setData] = useState(null)
  const [clients, setClients] = useState([])
  const [toast, setToast] = useState('')
  const [newTier, setNewTier] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).single()
      setData(st?.data || {})
      const { data: cs } = await supabase.from('clients').select('id,name,info,status')
      if (Array.isArray(cs)) setClients(cs)
    })()
  }, [])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const tiers = (data?.tiers && data.tiers.length ? data.tiers : DEFAULT_TIERS)
  const tierAccess = { ...DEFAULT_TIER_ACCESS, ...(data?.tierAccess || {}) }
  const pricing = data?.pricing || {}
  const branding = data?.branding || {}

  async function patch(next) {
    const merged = { ...(data || {}), ...next }
    setData(merged)
    await supabase.from('app_state').upsert({ id: STATE_ID, data: merged, updated_at: new Date().toISOString() })
    showToast('Saved ✓')
  }

  const addTier = () => {
    const name = newTier.trim(); if (!name) return
    const id = slug(name) || ('tier' + tiers.length)
    if (tiers.some((t) => t.id === id)) { showToast('That tier already exists'); return }
    patch({ tiers: [...tiers, { id, name, color: TIER_PALETTE[tiers.length % TIER_PALETTE.length] }] }); setNewTier('')
  }
  const editTier = (id, fields) => patch({ tiers: tiers.map((t) => (t.id === id ? { ...t, ...fields } : t)) })
  const deleteTier = (id) => patch({ tiers: tiers.filter((t) => t.id !== id) })
  const toggleAccess = (tid, mid) => patch({ tierAccess: { ...tierAccess, [tid]: { ...(tierAccess[tid] || {}), [mid]: !(tierAccess[tid] || {})[mid] } } })

  async function exportBackup() {
    const { data: cs } = await supabase.from('clients').select('*')
    const { data: mt } = await supabase.from('metrics_tracker').select('*')
    const { data: st } = await supabase.from('app_state').select('*')
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), clients: cs, metrics_tracker: mt, app_state: st }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'faa-backup-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click(); URL.revokeObjectURL(a.href)
    showToast('Backup downloaded ✓')
  }

  if (!isSuperAdmin()) return <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Super admin only.</div>
  if (!data) return <div style={{ minHeight: '100vh', background: BG }}><Header sub="Super Admin" back="/" /><div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Loading…</div></div>

  const priceRow = (key, label, hint) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{hint}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: MUTED, fontSize: 14 }}>$</span>
        <input defaultValue={pricing[key] || ''} onBlur={(e) => patch({ pricing: { ...pricing, [key]: e.target.value } })} placeholder="0" style={{ width: 110, height: 34, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 14, textAlign: 'right', background: '#fff', fontFamily: 'inherit' }} />
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Super Admin" back="/" />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: TEXT, margin: 0 }}>Super Admin</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>Your control panel for running the business and offering new services. Sections marked <Badge tone="live">Live</Badge> work now; <Badge tone="planned">Planned</Badge> ones show what we’ll wire up with logins, payments, and the guide store.</p>
        </div>

        {/* Membership tiers — LIVE */}
        <Section title="Membership tiers" tone="live" desc="The categories a client can belong to. Used across the dashboard (tagging) and the client portal (what they can see).">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tiers.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff' }}>
                <input type="color" value={t.color} onChange={(e) => editTier(t.id, { color: e.target.value })} style={{ width: 26, height: 26, border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }} />
                <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && editTier(t.id, { name: e.target.value.trim() })} style={{ flex: 1, height: 32, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: '0 10px', fontSize: 13, background: '#fff', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>{t.id}</span>
                <button onClick={() => deleteTier(t.id)} title="Delete tier" style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={newTier} onChange={(e) => setNewTier(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTier()} placeholder="Add a tier (e.g. VIP, Course Level 2)" style={{ flex: 1, height: 36, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#fff', fontFamily: 'inherit' }} />
            <button onClick={addTier} style={btnP}>Add tier</button>
          </div>
        </Section>

        {/* Access matrix — LIVE */}
        <Section title="What each tier can access" tone="live" desc="Turn modules on or off per tier. A client sees a module if any of their tiers unlocks it.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tier</th>
                  {MODULES.map((m) => <th key={m.id} style={{ padding: '6px 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>{m.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: '8px', fontSize: 13, color: TEXT }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color }} />{t.name}</span></td>
                    {MODULES.map((m) => (
                      <td key={m.id} style={{ padding: '8px', textAlign: 'center' }}>
                        <input type="checkbox" checked={!!(tierAccess[t.id] || {})[m.id]} onChange={() => toggleAccess(t.id, m.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Pricing — LIVE (stored, not yet charged) */}
        <Section title="Pricing" tone="live" desc="Your standard rates. These are reference figures for now — they’ll feed Stripe checkout once payments are wired up.">
          {priceRow('consulting', '1-on-1 Consulting', 'Per month')}
          {priceRow('community', 'Community membership', 'Per month')}
          {priceRow('lifetime', 'Lifetime All-Access', 'One-time')}
          {priceRow('guide', 'Single guide (default)', 'One-time unlock')}
        </Section>

        {/* Guides / products — PLANNED */}
        <Section title="Guides & products" tone="planned" desc="The catalogue you sell — courses, guides, and add-ons. Each will have a price, the tiers that include it, and whether unlocking it needs your approval.">
          <PlannedList items={[
            ['Full-Arch Playbook', 'Included in Lifetime · $499 standalone'],
            ['Metrics Mastery Course', 'Community add-on · needs approval'],
            ['Team Onboarding Kit', '$149 one-time unlock'],
          ]} />
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>We’ll build this into a real product manager when the guide store goes in.</div>
        </Section>

        {/* Team & roles — PLANNED */}
        <Section title="Team & roles" tone="planned" desc="Who can log in and what they can do. Activates when we add real logins.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RoleRow name="You" role="Super admin" note="Full control — everything on this page" />
            <RoleRow name="Regular admin" role="Admin" note="Manage clients & content, but big changes need your approval" />
            <RoleRow name="Client login" role="Client" note="Sees only their own portal — never these settings" />
          </div>
        </Section>

        {/* Approvals — PLANNED */}
        <Section title="Approvals & permissions" tone="planned" desc="What a regular admin can do on their own vs. what needs a super-admin sign-off.">
          <PlannedToggle label="Unlocking a paid guide for a client" on />
          <PlannedToggle label="Giving a discount over 15%" on />
          <PlannedToggle label="Deleting a client" on />
          <PlannedToggle label="Editing records older than 7 days" />
        </Section>

        {/* Integrations — PLANNED */}
        <Section title="Integrations" tone="planned" desc="Connect the outside tools the business runs on.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            <IntegrationCard name="Stripe" desc="Payments & subscriptions" />
            <IntegrationCard name="Email marketing" desc="Nurture buyers & prospects" />
            <IntegrationCard name="Google Drive" desc="Auto-create client folders" />
            <IntegrationCard name="Calendar" desc="Consult scheduling" />
          </div>
        </Section>

        {/* Data & backups — export is LIVE */}
        <Section title="Data & backups" tone="live" desc="Download a full snapshot of your data. Weekly automatic backups and one-click restore come with the database hardening step.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={exportBackup} style={btnP}>↓ Export backup (.json)</button>
            <button disabled style={{ ...btnS, opacity: 0.5, cursor: 'not-allowed' }}>Import / restore (planned)</button>
            <span style={{ fontSize: 12, color: MUTED }}>{clients.length} clients in the database</span>
          </div>
        </Section>

        {/* Branding — LIVE */}
        <Section title="Branding" tone="live" desc="How the app presents itself.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT }}>
              Business name
              <input defaultValue={branding.name || 'Full-Arch Authority'} onBlur={(e) => patch({ branding: { ...branding, name: e.target.value } })} style={{ height: 34, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#fff', fontFamily: 'inherit', width: 220 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT }}>
              Accent color
              <input type="color" defaultValue={branding.accent || GOLD} onChange={(e) => patch({ branding: { ...branding, accent: e.target.value } })} style={{ width: 34, height: 34, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
            </label>
          </div>
        </Section>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', fontSize: 12, padding: '8px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>}
    </div>
  )
}

const btnP = { padding: '9px 18px', borderRadius: 8, border: 'none', background: NAVY, color: GOLD, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnS = { padding: '9px 16px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: TEXT, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }

function Badge({ tone, children }) {
  const live = tone === 'live'
  return <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 6, background: live ? 'rgba(24,168,102,0.12)' : 'rgba(188,151,98,0.14)', color: live ? '#18734a' : '#8a6a3c' }}>{children}</span>
}

function Section({ title, tone, desc, children }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: 0 }}>{title}</h2>
        <Badge tone={tone}>{tone === 'live' ? 'Live' : 'Planned'}</Badge>
      </div>
      {desc && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 14px', lineHeight: 1.5 }}>{desc}</p>}
      {children}
    </div>
  )
}

function PlannedList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(([name, meta], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f9f9f8', borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{name}</span>
          <span style={{ fontSize: 12, color: MUTED }}>{meta}</span>
        </div>
      ))}
    </div>
  )
}

function RoleRow({ name, role, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: '#f9f9f8', borderRadius: 8 }}>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, minWidth: 110 }}>{name}</span>
      <span style={{ fontSize: 11, color: NAVY, background: 'rgba(11,29,94,0.06)', padding: '2px 8px', borderRadius: 6, fontWeight: 500 }}>{role}</span>
      <span style={{ fontSize: 12, color: MUTED, flex: 1 }}>{note}</span>
    </div>
  )
}

function PlannedToggle({ label, on }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize: 13, color: TEXT }}>{label}</span>
      <span style={{ fontSize: 11, color: on ? '#18734a' : MUTED, fontWeight: 500 }}>{on ? 'Needs approval' : 'Allowed'}</span>
    </div>
  )
}

function IntegrationCard({ name, desc }) {
  return (
    <div style={{ border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{name}</div>
      <div style={{ fontSize: 11, color: MUTED, margin: '2px 0 10px' }}>{desc}</div>
      <button disabled style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: MUTED, cursor: 'not-allowed' }}>Connect (planned)</button>
    </div>
  )
}
