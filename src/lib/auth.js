// ─────────────────────────────────────────────────────────────────────
// Role gate. The logged-in user's role is cached here by AuthProvider
// (via setAuthRole) so these plain helpers stay real without every call
// site needing the useAuth() hook — important because Header builds its
// nav list at import time, outside any component render.
//
// Roles: 'super_admin' (owner + assistant today) | 'consultant' |
// 'assistant' | 'client'. Client logins (Phase 3) get 'client' and will
// only ever see their own portal — every admin-only control is wrapped in
// isAdmin()/isSuperAdmin() and disappears for them automatically.
// ─────────────────────────────────────────────────────────────────────

let _role = null

// Called by AuthProvider whenever the profile (and therefore role) changes.
export const setAuthRole = (role) => { _role = role }

// Any internal staff member.
export const isAdmin = () => ['super_admin', 'consultant', 'assistant'].includes(_role)

// The owner tier — tiers, pricing, guides, team, integrations, backups.
export const isSuperAdmin = () => _role === 'super_admin'
