import Header from './Header.jsx'
import { CARD, MUTED, TEXT, BG } from '../lib/theme.js'

// Temporary stand-in for pages not migrated yet. Each gets replaced by the
// real page in its own step.
export default function Placeholder({ title, note }) {
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub={title} back="/" />
      <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px' }}>
        <div style={{ ...CARD, textAlign: 'center', padding: '48px 40px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: TEXT, marginBottom: 10 }}>{title}</h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7 }}>{note}</p>
        </div>
      </div>
    </div>
  )
}
