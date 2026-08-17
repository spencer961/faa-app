// Content library helpers. Videos are external links (Vimeo/YouTube); guides
// are files uploaded to the private `guides` Storage bucket. Each item is
// tagged with 0+ category ids. Category definitions live in app_state.data
// .contentCategories (same pattern as tiers/links) so packages/tiers can be
// assembled from them later.

export const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

// Colors for content categories (distinct from tier colors, same spirit).
export const CAT_PALETTE = ['#bc9762', '#0b1d5e', '#18a866', '#d4537e', '#7f77dd', '#e07b0a', '#0891b2', '#9333ea', '#b45309', '#0f6e56']

export const GUIDES_BUCKET = 'guides'

// The 5 pillars of the Full-Arch Authority framework (ids match successMap.js
// CATS). Every video/guide belongs to one pillar (its topic).
export const PILLARS = [
  { id: 'clinical', name: 'Clinical Excellence', color: '#2f6bb0' },
  { id: 'operational', name: 'Operational Excellence', color: '#18a866' },
  { id: 'brand', name: 'Brand Messaging', color: '#bc9762' },
  { id: 'closing', name: 'Closing System', color: '#d4537e' },
  { id: 'marketing', name: 'Marketing System', color: '#7f77dd' },
]
export const pillarById = (id) => PILLARS.find((p) => p.id === id)

// Audience roles a video/guide is intended for (besides the owner, who sees
// everything). Drives team-member recommendations later (Phase 3).
export const ROLES = [
  { id: 'marketing', name: 'Marketing', desc: 'Brand, messaging & lead generation' },
  { id: 'tc', name: 'Treatment Coordinator', desc: 'Consultations, closing & follow-up' },
  { id: 'setter', name: 'Appointment Setter', desc: 'Phones, scheduling & scripts' },
  { id: 'office', name: 'Office Manager', desc: 'Operations, team & systems' },
]
export const roleById = (id) => ROLES.find((r) => r.id === id)

// Placeholder content seeded once into content_items so the library is
// populated to visualise. Real rows — editable/deletable like any other.
export const SEED_ITEMS = [
  { type: 'video', title: 'Full-Arch Fundamentals', pillar: 'clinical', roles: [], description: 'Core surgical & restorative workflow.', url: 'https://vimeo.com/000000001' },
  { type: 'video', title: 'Zygomatic Case Selection', pillar: 'clinical', roles: [], description: 'When to reach for zygos & pterygoids.', url: 'https://vimeo.com/000000002' },
  { type: 'guide', title: 'Implant Protocols Handbook', pillar: 'clinical', roles: [], description: 'Step-by-step clinical protocols.', url: 'https://drive.google.com/example-implant-protocols' },
  { type: 'video', title: 'Leadership & Team Mindset', pillar: 'operational', roles: ['office'], description: 'Leading the practice & the team.', url: 'https://vimeo.com/000000003' },
  { type: 'guide', title: 'Profitability Playbook', pillar: 'operational', roles: [], description: 'Owner-level margins & pricing.', url: 'https://drive.google.com/example-profitability' },
  { type: 'video', title: 'Crafting Your UVP', pillar: 'brand', roles: ['marketing', 'tc'], description: 'How to stand out in your market.', url: 'https://vimeo.com/000000004' },
  { type: 'video', title: 'The Video Testimonial System', pillar: 'brand', roles: ['marketing'], description: 'Capturing & using patient stories.', url: 'https://vimeo.com/000000005' },
  { type: 'guide', title: 'Before / After Photo SOP', pillar: 'brand', roles: ['marketing'], description: 'A repeatable photo system.', url: 'https://drive.google.com/example-photo-sop' },
  { type: 'video', title: 'The Treatment Coordinator Role', pillar: 'closing', roles: ['tc'], description: 'The TC playbook, start to finish.', url: 'https://vimeo.com/000000006' },
  { type: 'guide', title: 'The Consultation Script', pillar: 'closing', roles: ['tc', 'setter'], description: 'The words that close consults.', url: 'https://drive.google.com/example-consult-script' },
  { type: 'video', title: 'Closing Metrics Explained', pillar: 'closing', roles: ['tc', 'office'], description: 'Booking, show & close rates.', url: 'https://vimeo.com/000000007' },
  { type: 'video', title: 'PPC That Actually Converts', pillar: 'marketing', roles: ['marketing'], description: 'Paid ads that fill the schedule.', url: 'https://vimeo.com/000000008' },
  { type: 'guide', title: 'Website Essentials Checklist', pillar: 'marketing', roles: ['marketing'], description: 'What every practice site needs.', url: 'https://drive.google.com/example-website-checklist' },
]
