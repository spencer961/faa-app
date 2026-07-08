import { Link } from 'react-router-dom'
import { NAVY, GOLD } from '../lib/theme.js'

// The navy/gold top bar — written once, used on every page.
export default function Header({ sub, back, right }) {
  return (
    <div style={{ background: NAVY, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {back && (
          <Link to={back} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>← Home</Link>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: GOLD, letterSpacing: '0.01em', lineHeight: 1.2 }}>
            Full-Arch Authority
          </div>
          {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}
