// ─────────────────────────────────────────────────────────────────────
// Admin gate — placeholder until real logins are added.
//
// Right now there are no logins, so whoever is using the app is you (the
// admin). Every admin-only control — like the Client Portal's "Access
// settings" — is wrapped in isAdmin(). The moment real authentication is
// added, this becomes a real role check, and all of those controls
// automatically DISAPPEAR for client logins. A client will only ever see
// their own portal, never admin settings.
//
// When wiring auth: return true only for users whose account role is
// 'admin' (e.g. from Supabase Auth), false for client logins.
// ─────────────────────────────────────────────────────────────────────
export const isAdmin = () => {
  // TODO (auth step): replace with the logged-in user's role === 'admin'.
  return true
}

// Super admin — the owner (you). Can manage tiers, pricing, guides, team,
// approvals, integrations, and backups. Regular admins won't see these.
// TODO (auth step): return the logged-in user's role === 'super_admin'.
export const isSuperAdmin = () => true
