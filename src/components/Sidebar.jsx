import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { NAVY, GOLD } from '../lib/theme.js'
import { isSuperAdmin } from '../lib/auth.js'
import { useAuth } from '../lib/AuthContext.jsx'

// ─────────────────────────────────────────────────────────────────────
// Left navigation rail (replaces the old top hamburger menu). Collapsible
// to an icon-only rail; the choice is remembered. Each page's own layout
// renders untouched to the right of it.
// ─────────────────────────────────────────────────────────────────────

const ini = (n) => String(n || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

// icon = inline SVG path(s); label + route.
const I = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  pulse: <path d="M3 12h4l2 6 4-14 2 8h6" />,
  play: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M10 8l5 3-5 3V8z" /><path d="M8 21h8M12 17v4" /></>,
  map: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  check: <><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
}

const NAV = [
  { to: '/', label: 'Home', icon: I.home, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: I.dash },
  { to: '/pulse', label: 'Client Pulse', icon: I.pulse },
  { to: '/success-map', label: 'Success Map', icon: I.map },
  { to: '/metrics', label: 'Metrics Tracker', icon: I.chart },
  { to: '/tasks', label: 'To-Do Lists', icon: I.check },
  { to: '/content', label: 'Content', icon: I.play },
  { group: 'Intake' },
  { to: '/onboarding', label: 'Onboarding Form', icon: I.file },
  { to: '/portal', label: 'Client Portal', icon: I.users },
]

const Icon = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{children}</svg>
)

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('faa_sb') === '1' } catch { return false } })
  const toggle = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('faa_sb', n ? '1' : '0') } catch {} return n })

  const items = [...NAV]
  if (isSuperAdmin()) items.push({ group: 'Admin' }, { to: '/admin', label: 'Super Admin', icon: I.shield })

  const who = profile?.display_name || user?.email || ''
  const w = collapsed ? 68 : 236

  const link = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11, justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '10px 0' : '9px 10px', margin: '0 10px 1px', borderRadius: 8, position: 'relative',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.72)', background: isActive ? 'rgba(188,151,98,0.16)' : 'transparent',
    fontSize: 13.5, fontWeight: isActive ? 600 : 400, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
  })

  return (
    <aside style={{ width: w, flexShrink: 0, background: NAVY, display: 'flex', flexDirection: 'column', color: 'rgba(255,255,255,0.72)', position: 'relative', transition: 'width 0.18s ease', height: '100%' }}>
      <button onClick={toggle} title={collapsed ? 'Expand menu' : 'Collapse menu'} aria-label="Toggle sidebar" style={{ position: 'absolute', top: 64, right: -12, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.16)', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5, padding: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: collapsed ? '18px 0 16px' : '18px 18px 16px', justifyContent: collapsed ? 'center' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: GOLD, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>FA</div>
        {!collapsed && <div><div style={{ fontWeight: 700, fontSize: 14.5, color: '#fff', lineHeight: 1.15 }}>Full-Arch<br />Authority</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)', marginTop: 1 }}>Internal platform</div></div>}
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {items.map((it, i) => it.group ? (
          !collapsed && <div key={'g' + i} style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', padding: '12px 18px 5px' }}>{it.group}</div>
        ) : (
          <NavLink key={it.to} to={it.to} end={it.end} style={link} title={collapsed ? it.label : undefined}>
            <Icon>{it.icon}</Icon>{!collapsed && <span>{it.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', padding: collapsed ? '12px 0' : 12, display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#7d6cc4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{ini(who)}</div>
        {!collapsed && <><div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)' }}>{isSuperAdmin() ? 'Super admin' : 'Team'}</div></div>
          <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.42)', cursor: 'pointer', flexShrink: 0, padding: 0, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
          </button></>}
      </div>
    </aside>
  )
}
