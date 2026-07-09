import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NAVY, GOLD, TEXT, MUTED } from '../lib/theme.js'

// The navy/gold top bar — written once, used on every page.
export default function Header({ sub, back, right }) {
  return (
    <div style={{ background: NAVY, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {back && (
          <Link to={back} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textDecoration: 'none' }}>← Home</Link>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: GOLD, letterSpacing: '0.01em', lineHeight: 1.2 }}>
            Full-Arch Authority
          </div>
          {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {right}
        <NavMenu />
      </div>
    </div>
  )
}

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/success-map', label: 'Success Map' },
  { to: '/metrics', label: 'Metrics Tracker' },
  { to: '/tasks', label: 'To-Do Lists' },
  { to: '/onboarding', label: 'Onboarding Form' },
  { to: '/portal', label: 'Client Portal' },
]

function NavMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)} title="Menu" aria-label="Menu" style={{ width: 34, height: 34, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.25)', background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.16)', minWidth: 196, overflow: 'hidden', zIndex: 2000 }}>
          <div style={{ padding: '7px 14px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, background: '#f7f6f4', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>Go to</div>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f2f4f8' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
              style={{ display: 'block', padding: '10px 14px', fontSize: 13, color: TEXT, textDecoration: 'none', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
