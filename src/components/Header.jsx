import { TEXT } from '../lib/theme.js'

// Slim page top bar. Navigation + brand + account now live in the Sidebar,
// so this is just the page title on the left and the page's own controls on
// the right. Sticks to the top while the page scrolls.
export default function Header({ sub, right }) {
  const title = String(sub || '').replace(/^[·—\-\s]+/, '')
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.09)', minHeight: 58, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, whiteSpace: 'nowrap' }}>{title}</h1>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{right}</div>}
    </div>
  )
}
