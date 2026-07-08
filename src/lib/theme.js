// ─────────────────────────────────────────────────────────────────────
// Full-Arch Authority — shared design tokens.
// Change a brand color or style HERE and it updates across every page.
// This is the "one blueprint in a drawer" — no more copy-pasting.
// ─────────────────────────────────────────────────────────────────────

export const NAVY = '#0b1d5e'
export const GOLD = '#bc9762'
export const BG = '#f5f5f4'
export const BORDER = 'rgba(0,0,0,0.1)'
export const TEXT = '#1a1a1a'
export const MUTED = '#888786'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

// Shared input / card / button styles used across forms and pages.
export const INP = {
  width: '100%', padding: '10px 14px', borderRadius: 8, background: '#f9f9f8',
  border: '0.5px solid rgba(0,0,0,0.15)', color: TEXT, fontSize: 14,
  outline: 'none', fontFamily: FONT, boxSizing: 'border-box',
}
export const CARD = {
  background: '#fff', borderRadius: 12,
  border: '0.5px solid rgba(0,0,0,0.1)', padding: '20px 24px',
}
export const BTNP = {
  padding: '9px 20px', borderRadius: 8, border: 'none', background: NAVY,
  color: GOLD, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  fontFamily: FONT, letterSpacing: '0.01em',
}
export const BTNS = {
  padding: '8px 16px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)',
  background: 'transparent', color: TEXT, cursor: 'pointer', fontSize: 13,
  fontFamily: FONT,
}
