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
