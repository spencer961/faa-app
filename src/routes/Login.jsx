import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { NAVY, GOLD, TEXT, MUTED } from '../lib/theme.js'

// ─────────────────────────────────────────────────────────────────────
// Sign-in screen (Phase 1 — internal logins). Email + password only;
// accounts are created by the owner in Supabase, so there's no sign-up.
// On success we do nothing here — AuthProvider's listener updates and the
// gate in App.jsx swaps this out for the app.
// ─────────────────────────────────────────────────────────────────────

const wrap = { minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }
const wordmark = { fontWeight: 700, fontSize: 20, color: GOLD, letterSpacing: '0.01em', textAlign: 'center' }

// Shown while the session is being restored — avoids flashing the login
// screen before we know whether someone is already signed in.
export function Splash() {
  return (
    <div style={wrap}>
      <div style={{ textAlign: 'center' }}>
        <div style={wordmark}>Full-Arch Authority</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 }}>Loading…</div>
      </div>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(/invalid login/i.test(error.message) ? 'Email or password is incorrect.' : error.message)
      setSubmitting(false)
    }
    // On success the auth listener takes over; leave the button disabled.
  }

  const inp = { width: '100%', padding: '11px 13px', borderRadius: 9, background: '#fff', border: '0.5px solid rgba(0,0,0,0.18)', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={wrap}>
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 14, padding: '30px 28px', width: 360, maxWidth: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ ...wordmark, color: NAVY, marginBottom: 4 }}>Full-Arch Authority</div>
        <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginBottom: 22 }}>Sign in to continue</div>

        <label style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" style={{ ...inp, margin: '6px 0 14px' }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={{ ...inp, margin: '6px 0 4px' }} />

        {error && <div style={{ color: '#b91c1c', fontSize: 12.5, margin: '10px 0 0' }}>{error}</div>}

        <button type="submit" disabled={submitting} style={{ width: '100%', marginTop: 18, padding: '11px 0', borderRadius: 9, border: 'none', background: NAVY, color: GOLD, fontSize: 14, fontWeight: 600, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>{submitting ? 'Signing in…' : 'Sign in'}</button>

        {/* Phase 3: wire supabase.auth.resetPasswordForEmail once Resend SMTP is set up. */}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: MUTED, marginTop: 16 }}>Forgot your password? Contact the site owner to reset it.</div>
      </form>
    </div>
  )
}
