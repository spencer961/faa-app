import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, MUTED, TEXT } from '../lib/theme.js'

// Client-facing portal — migrated from client.html. Still a preview of
// what clients will see; the real modules get built in a later step.
const MODULES = [
  { name: 'Success Map', desc: 'View monthly progress scores and consultant notes', tag: 'Coming soon', tagBg: '#EAF3DE', tagColor: '#27500A' },
  { name: 'Metrics Tracker', desc: 'Enter daily leads, consults, and revenue data', tag: 'Coming soon', tagBg: '#EAF3DE', tagColor: '#27500A' },
  { name: 'Training Library', desc: 'Guides, videos, and newsletters for members', tag: 'Planned', tagBg: '#F1EFE8', tagColor: '#888786' },
]

export default function ClientPortal() {
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Client Portal" back="/" />
      <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 20, fontWeight: 700, color: GOLD }}>FA</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 10, background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 500, marginBottom: 24 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            In development
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: TEXT, marginBottom: 10 }}>Client Portal</h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 24, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            Once ready, your clients and members will log in here to view their Success Map results, track their metrics, and access their training library.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 24, textAlign: 'left' }}>
            {MODULES.map((m) => (
              <div key={m.name} style={{ padding: 14, border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#f9f9f8' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 3 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{m.desc}</div>
                <span style={{ display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 8, marginTop: 5, fontWeight: 500, background: m.tagBg, color: m.tagColor }}>{m.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
