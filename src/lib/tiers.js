// Membership tiers — shared by the dashboard (tagging) and the client
// portal (filtering). The catalog is seeded from here and can be extended
// (stored in app_state). Each client's tier ids live at info.tiers.
export const DEFAULT_TIERS = [
  { id: 'consulting', name: '1-on-1 Consulting', color: '#0b1d5e' },
  { id: 'community', name: 'Community', color: '#18a866' },
  { id: 'lifetime', name: 'Lifetime All-Access', color: '#bc9762' },
  { id: 'guides', name: 'Guides', color: '#9B7FE8' },
  { id: 'prospect', name: 'Prospect', color: '#888786' },
]
export const TIER_PALETTE = ['#1a7fd4', '#e07b0a', '#18a866', '#f0359a', '#9B7FE8', '#4a9e12', '#d42020', '#00b4d8', '#bc6c25']
export const getClientTiers = (c) => (Array.isArray(c?.info?.tiers) ? c.info.tiers : [])

// Modules a client can see in their portal. Which ones each tier unlocks is
// configured by the admin (stored in app_state.tierAccess).
export const MODULES = [
  { id: 'success_map', name: 'Success Map', desc: 'Progress scores & consultant notes' },
  { id: 'metrics', name: 'Metrics', desc: 'Leads, consults & revenue' },
  { id: 'tasks', name: 'To-Do List', desc: 'Their action items' },
  { id: 'guides', name: 'Guides & Training', desc: 'Content library' },
]

// Sensible starting point — the admin can change any of this.
export const DEFAULT_TIER_ACCESS = {
  consulting: { success_map: true, metrics: true, tasks: true, guides: false },
  community: { success_map: false, metrics: false, tasks: false, guides: true },
  lifetime: { success_map: true, metrics: true, tasks: true, guides: true },
  guides: { success_map: false, metrics: false, tasks: false, guides: true },
  prospect: { success_map: false, metrics: false, tasks: false, guides: false },
}

// What a specific client can see = the union of what all their tiers unlock.
// Untagged clients default to consulting access.
export const accessForClient = (client, tierAccess) => {
  const t = getClientTiers(client)
  const eff = t.length ? t : ['consulting']
  const out = {}
  MODULES.forEach((m) => { out[m.id] = eff.some((tid) => (tierAccess?.[tid] || {})[m.id]) })
  return out
}
