// Content library helpers. Videos are external links (Vimeo/YouTube); guides
// are files uploaded to the private `guides` Storage bucket. Each item is
// tagged with 0+ category ids. Category definitions live in app_state.data
// .contentCategories (same pattern as tiers/links) so packages/tiers can be
// assembled from them later.

export const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

// Colors for content categories (distinct from tier colors, same spirit).
export const CAT_PALETTE = ['#bc9762', '#0b1d5e', '#18a866', '#d4537e', '#7f77dd', '#e07b0a', '#0891b2', '#9333ea', '#b45309', '#0f6e56']

export const GUIDES_BUCKET = 'guides'
