import { TEXT } from '../lib/theme.js'

// Slim page top bar. Navigation + brand + account now live in the Sidebar,
// so this is the page title on the left and the page's own controls on the
// right. A `back` node (e.g. "← All clients") sits on the far left, where the
// eye looks to go back. Legacy string `back` values (old "← Home" routes) are
// ignored — the sidebar covers that now. Sticks to the top while scrolling.
export default function Header({ sub, back, right }) {
  const title = String(sub || '').replace(/^[·—\-\s]+/, '')
  const backNode = back && typeof back !== 'string' ? back : null
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.09)', minHeight: 58, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px' }}>
      {backNode}
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, whiteSpace: 'nowrap' }}>{title}</h1>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{right}</div>}
    </div>
  )
}
