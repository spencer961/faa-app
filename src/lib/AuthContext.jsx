import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { setAuthRole } from './auth.js'

// ─────────────────────────────────────────────────────────────────────
// Auth foundation (Phase 1 — internal logins).
//
// Owns the Supabase session + the logged-in user's profile (role, name).
// Everything reads it through useAuth(). The role is also pushed into
// auth.js's cache so the plain isAdmin()/isSuperAdmin() helpers stay real
// without every call site needing the hook.
//
// NOTE: this gates the interface, not the data. The database is still
// reachable with the public anon key until Row Level Security lands
// (Phase 2). A login screen alone is not data security.
// ─────────────────────────────────────────────────────────────────────

const AuthCtx = createContext({ user: null, profile: null, role: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // `active` guards against setState after unmount — React 18 StrictMode
    // mounts effects twice in dev, and getSession()/the profile fetch are async.
    let active = true

    const loadProfile = async (u) => {
      if (!u) { if (active) { setProfile(null); setAuthRole(null) } return }
      const { data } = await supabase.from('profiles').select('role, display_name, client_id').eq('id', u.id).maybeSingle()
      if (!active) return
      setProfile(data || null)
      setAuthRole(data?.role ?? null)
    }

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setUser(session?.user ?? null)
      await loadProfile(session?.user ?? null)
      if (active) setLoading(false)
    })()

    // Fires on sign-in, sign-out, and token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      loadProfile(u)
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <AuthCtx.Provider value={{ user, profile, role: profile?.role ?? null, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
