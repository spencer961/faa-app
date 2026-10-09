// ─────────────────────────────────────────────────────────────────────
// Shared vendor directory. Vendors (marketing companies, SEO companies,
// etc.) are GLOBAL and shared across clients — the same "TIE" is one entity
// everywhere, so a client links to vendors rather than retyping names. Stored
// in app_state.data.vendors (same pattern as tiers / content categories), so
// no dedicated table is needed. Used by the weekly metrics by-company
// breakdown and (later) the vendor communications hub.
// Vendors are ARCHIVED, never hard-deleted, so past numbers keep their label.
// ─────────────────────────────────────────────────────────────────────

export const uid = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export const VENDOR_TYPES = [
  { id: 'marketing', name: 'Marketing' },
  { id: 'seo', name: 'SEO' },
  { id: 'web', name: 'Website' },
  { id: 'other', name: 'Other' },
]
export const vendorTypeName = (id) => (VENDOR_TYPES.find((t) => t.id === id) || {}).name || 'Other'

export const VENDOR_PALETTE = ['#7f77dd', '#18a866', '#0891b2', '#e07b0a', '#d4537e', '#b45309', '#0b1d5e', '#9333ea']

// Helpers — vendors is app_state.data.vendors = [{ id, name, type, color, archived }]
export const activeVendors = (vendors) => (vendors || []).filter((v) => !v.archived)
export const vendorById = (vendors, id) => (vendors || []).find((v) => v.id === id)
// The vendors a client uses — ids stored on client.info.vendorIds.
export const clientVendors = (vendors, client) => {
  const ids = client?.info?.vendorIds || []
  return activeVendors(vendors).filter((v) => ids.includes(v.id))
}
