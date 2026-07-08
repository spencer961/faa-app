import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { CARD, NAVY, MUTED, TEXT, BG } from '../lib/theme.js'

const TOOLS = [
  { to: '/dashboard', name: 'Dashboard', desc: 'Client command center', status: 'migrating' },
  { to: '/success-map', name: 'Success Map', desc: 'Red / yellow / green scoring', status: 'migrating' },
  { to: '/metrics', name: 'Metrics Tracker', desc: 'Leads, closes, revenue', status: 'migrating' },
  { to: '/tasks', name: 'To-Do Lists', desc: 'Personal & per-client tasks', status: 'migrating' },
  { to: '/onboarding', name: 'Onboarding Form', desc: 'Public intake for prospects', status: 'live' },
  { to: '/portal', name: 'Client Portal', desc: 'Client-facing (in progress)', status: 'migrating' },
]

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Internal platform" />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 28 }}>Jump into any tool.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
          {TOOLS.map((t) => (
            <Link key={t.to} to={t.to} style={{ ...CARD, display: 'block', position: 'relative' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{t.desc}</div>
              {t.status === 'live' && (
                <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, fontWeight: 600, color: '#18a866', background: '#e1f5ee', padding: '2px 7px', borderRadius: 8 }}>Live</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
