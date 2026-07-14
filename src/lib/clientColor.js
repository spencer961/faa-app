// ─────────────────────────────────────────────────────────────────────
// Per-client identity color. Every client gets a distinct color derived
// from their name by default (so they're recognizable everywhere without
// any setup), overridable in the profile via `info.color`. Used across the
// app — avatars and the Client Pulse row accents.
// ─────────────────────────────────────────────────────────────────────

// Google Calendar's color palette — reds/oranges/yellows, then greens/teals/
// blues, then purples/brown/grey. Used both for the auto-assigned defaults and
// as the swatches in the profile color picker.
export const CLIENT_PALETTE = [
  '#AD1457', '#D81B60', '#E67C73', '#D50000', '#F4511E', '#EF6C00', '#F09300', '#F6BF26',
  '#E4C441', '#C0CA33', '#7CB342', '#33691E', '#0B8043', '#009688', '#039BE5', '#4285F4',
  '#7986CB', '#3F51B5', '#B39DDB', '#8E24AA', '#9C27B0', '#795548', '#616161', '#A79B8E',
]

export const clientColor = (c) => {
  if (c?.info?.color) return c.info.color
  const name = String(c?.name || '')
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CLIENT_PALETTE[h % CLIENT_PALETTE.length]
}
