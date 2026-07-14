// ─────────────────────────────────────────────────────────────────────
// Per-client identity color. Every client gets a distinct color derived
// from their name by default (so they're recognizable everywhere without
// any setup), overridable in the profile via `info.color`. Used across the
// app — avatars and the Client Pulse row accents.
// ─────────────────────────────────────────────────────────────────────

export const CLIENT_PALETTE = [
  '#0b1d5e', '#1a7fd4', '#18a866', '#bc9762', '#d4537e',
  '#7f77dd', '#e07b0a', '#0f6e56', '#993c1d', '#0891b2',
  '#9333ea', '#b45309',
]

export const clientColor = (c) => {
  if (c?.info?.color) return c.info.color
  const name = String(c?.name || '')
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CLIENT_PALETTE[h % CLIENT_PALETTE.length]
}
