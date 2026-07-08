import { useState } from 'react'
import { NAVY, GOLD, BG, BORDER, TEXT, MUTED, INP, CARD, BTNP, BTNS } from '../lib/theme.js'
import { DSEC } from '../lib/onboardingSections.js'
import { SUPABASE_URL, SB_HEADERS } from '../lib/supabase.js'

// Public intake form for prospects. Migrated from onboarding.html — same
// behavior, but now sharing the theme, the questions, and the DB connection
// with the rest of the app instead of its own private copies.
export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [ans, setAns] = useState({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const sec = DSEC[step]
  const upd = (id, v) => setAns((a) => ({ ...a, [id]: v }))
  const toggleCb = (fid, opt) => {
    const cur = ans[fid] || []
    upd(fid, cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt])
  }

  const Hdr = () => (
    <div style={{ background: NAVY, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: GOLD, letterSpacing: '0.01em', lineHeight: 1.2 }}>Full-Arch Authority</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Client Onboarding</div>
      </div>
    </div>
  )

  const submit = async () => {
    if (!ans.email || !ans.practiceName || !ans.doctorName) {
      setErr('Please fill in Practice Name, Doctor Name, and Email before submitting.')
      return
    }
    setSubmitting(true)
    setErr('')
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/onboarding_submissions', {
        method: 'POST',
        headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({
          email: ans.email,
          practice_name: ans.practiceName,
          answers: ans,
          submitted_at: new Date().toISOString(),
          reviewed: false,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setDone(true)
    } catch (e) {
      setErr('Something went wrong. Please try again.')
      console.error(e)
    }
    setSubmitting(false)
  }

  const next = () => {
    const required = sec.fields.filter((f) => f.required)
    const missing = required.filter((f) => {
      const v = ans[f.id]
      return !v || String(v).trim() === '' || (Array.isArray(v) && v.length === 0)
    })
    if (missing.length > 0) {
      setErr('Please fill in: ' + missing.map((f) => f.label).join(', '))
      return
    }
    if (ans.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ans.email)) {
      setErr('Please enter a valid email address.')
      return
    }
    setErr('')
    if (step < DSEC.length - 1) setStep((s) => s + 1)
    else submit()
  }

  if (done) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Hdr />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ ...CARD, maxWidth: 480, textAlign: 'center', padding: '48px 40px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22, color: '#22c55e', fontWeight: 700 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: TEXT, marginBottom: 10 }}>Form Submitted!</h2>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>Thank you. Your onboarding form has been received. Our consultant will review your information and reach out shortly to schedule your initial assessment.</p>
            <p style={{ fontSize: 12, color: MUTED }}>You can close this tab.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <Hdr />
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)' }}>
        <div style={{ height: '100%', width: ((step + 1) / DSEC.length) * 100 + '%', background: GOLD, transition: 'width 0.4s' }} />
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {DSEC.map((_, i) => (
              <div key={i} style={{ width: i === step ? 16 : 5, height: 5, borderRadius: 3, background: i < step ? GOLD : i === step ? NAVY : 'rgba(0,0,0,0.12)', transition: 'all 0.3s' }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: MUTED }}>Step {step + 1} of {DSEC.length}</span>
        </div>
        <div style={{ ...CARD, padding: '32px 36px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{sec.title}</h1>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 28 }}>{sec.sub}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sec.fields.map((f) => (
              <div key={f.id}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 8 }}>
                  {f.label}{f.required && <span style={{ color: GOLD }}> *</span>}
                </label>
                {f.type === 'checkbox' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(f.options || []).map((opt) => {
                      const chk = (ans[f.id] || []).includes(opt)
                      return (
                        <label key={opt} onClick={() => toggleCb(f.id, opt)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '9px 12px', borderRadius: 8, border: '0.5px solid ' + (chk ? NAVY : BORDER), background: chk ? 'rgba(11,29,94,0.04)' : '#fff', transition: 'all 0.15s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid ' + (chk ? NAVY : '#c0c6d8'), background: chk ? NAVY : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {chk && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 13, color: chk ? NAVY : TEXT }}>{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : f.type === 'textarea' ? (
                  <textarea value={ans[f.id] || ''} onChange={(e) => upd(f.id, e.target.value)} placeholder={f.placeholder} rows={4} style={{ ...INP, resize: 'vertical', lineHeight: 1.6, height: 'auto', padding: '10px 14px' }} />
                ) : (
                  <input type={f.id === 'email' ? 'email' : 'text'} value={ans[f.id] || ''} onChange={(e) => upd(f.id, e.target.value)} placeholder={f.placeholder || ''} style={INP} />
                )}
              </div>
            ))}
          </div>
          {err && <div style={{ marginTop: 16, padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid rgba(163,45,45,0.2)', borderRadius: 8, fontSize: 13, color: '#A32D2D' }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '0.5px solid rgba(0,0,0,0.1)' }}>
            <button onClick={() => step > 0 && setStep((s) => s - 1)} style={{ ...BTNS, opacity: step === 0 ? 0.4 : 1, cursor: step === 0 ? 'not-allowed' : 'pointer' }}>← Back</button>
            <button onClick={next} disabled={submitting} style={{ ...BTNP, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting...' : step === DSEC.length - 1 ? 'Submit →' : 'Next →'}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>Full-Arch Authority · Confidential</div>
      </div>
    </div>
  )
}
