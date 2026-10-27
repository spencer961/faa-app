// ─────────────────────────────────────────────────────────────────────
// Metrics definitions + math — ONE canonical copy.
// The Metrics page uses this, and the dashboard's client cards will reuse
// the exact same calculations so the numbers can never disagree.
// ─────────────────────────────────────────────────────────────────────

// Math helpers
export function pct(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round((av / bv) * 100) }
export function add(a, b) { const av = parseFloat(a) || 0, bv = parseFloat(b) || 0; return av + bv || null }
export function divide(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round(av / bv) }

// The metric list — mirrors the client "Metrics Scorecard" Daily tab (Layer 1).
// Entered daily; weekly/monthly roll up automatically. `label` is the row name;
// `hint` is the small clarifier the sheet shows under a name.
// Layer 2 (lead sources by channel: Google Ads, Google, Social, etc., grouped by
// marketing company e.g. TIE/DDS) and Layer 3 (patient-level closed-case log:
// names, surgery dates, financing) are separate builds — not here yet.
// `scope` controls which entry screen a row appears on:
//   'daily'  — internal daily activity log only (not part of the weekly review)
//   'weekly' — only entered/shown at the weekly review (leads + the rates)
//   (none)   — shared: entered daily, rolls up into the weekly review
export const METRICS = [
  // Lead activity
  { id: 'contact_attempts', label: 'Lead Contact Attempts', section: 'Lead Activity', scope: 'daily', hint: '“# of Leads Worked” — internal: is staff working the leads?' },
  { id: 'lead_phone_convos', label: 'Lead Phone Conversations', section: 'Lead Activity', scope: 'daily' },
  { id: 'leads', label: 'Leads', section: 'Lead Activity', scope: 'weekly', hint: '(ad clicks that didn’t book — counted weekly)' },
  { id: 'consults_scheduled', label: 'Appointments Scheduled', section: 'Lead Activity', hint: '(regardless of date)' },
  { id: 'booking_rate', label: 'Booking Rate', section: 'Lead Activity', scope: 'weekly', calc: (d) => pct(d.consults_scheduled, d.leads), bench: { low: 15, high: 30 }, benchLabel: 'Benchmark: 15–30%' },
  { id: 'rescheduled', label: 'Rescheduled', section: 'Lead Activity', hint: '(regardless of when scheduled)' },
  { id: 'cancelled', label: 'Cancelled NC/NS', section: 'Lead Activity', hint: '(regardless of when scheduled)' },
  // Show rate
  { id: 'consults_on_schedule', label: 'Consults on the Schedule', section: 'Show Rate' },
  { id: 'presented_treatment', label: 'Presented Treatment (Held Consultations)', section: 'Show Rate' },
  { id: 'show_rate', label: 'Consult Show Rate', section: 'Show Rate', scope: 'weekly', calc: (d) => pct(d.presented_treatment, d.consults_on_schedule), bench: { low: 60 }, benchLabel: 'Benchmark: 60%+' },
  // Closing
  { id: 'patients_closed', label: '# of Patients Closed', section: 'Closing', hint: '(regardless of consult date)' },
  { id: 'fixed_arches', label: '# of Full-FIXED Arches Closed', section: 'Closing', hint: '(# of arches, not patients)' },
  { id: 'removable_arches', label: '# of Full-REMOVABLE Arches Closed', section: 'Closing', hint: '(# of arches, not patients)' },
  { id: 'total_arches', label: 'Total Arches Closed', section: 'Closing', calc: (d) => add(d.fixed_arches, d.removable_arches) },
  { id: 'close_rate', label: 'Close Rate', section: 'Closing', scope: 'weekly', calc: (d) => pct(d.patients_closed, d.presented_treatment), bench: { low: 25 }, benchLabel: 'Benchmark: 25%+' },
  // Revenue
  { id: 'closed_value', label: 'Total Closed $ Value', section: 'Revenue', dollar: true },
]

export const KEY_METRICS = ['booking_rate', 'show_rate', 'close_rate', 'closed_value']
export const INPUT_METRICS = METRICS.filter((m) => !m.calc)

// ── Lead sources (Layer 2 — per-client ROI breakdown) ──────────────────
// A client's leads/consults/closed-$ can be split by where they came from
// (a marketing company like TIE, or a plain channel like "Referral"). The
// list of sources is editable PER CLIENT and stored on the client profile:
//   client.info.leadSources = [{ id, label, vendorId, archived }]
// `vendorId` optionally links to the shared vendor directory (so "TIE" is the
// same TIE everywhere); `label` is used when it's not a directory vendor.
// Sources are ARCHIVED, never deleted, so past weeks keep their numbers.
// Per-source values live on the normal metric entries as flat, prefixed keys
// ("src:<sourceId>:<metricId>") so saving/aggregation/paste all keep working.
// Which metrics can be split by source:
export const SOURCE_METRICS = ['leads', 'consults_scheduled', 'closed_value']
// Only LEADS rolls its per-source rows up into the overall total — every lead
// has exactly one source, and leads are never entered as a separate daily
// total. Consults/closed-$ already have authoritative totals (from daily or the
// weekly single entry); their per-source numbers are ROI attribution shown
// alongside, so folding them would double-count.
export const SOURCE_FOLD = ['leads']
export const uidSource = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
export const srcKey = (sid, mid) => 'src:' + sid + ':' + mid
export const isSrcKey = (k) => typeof k === 'string' && k.startsWith('src:')
export const parseSrcKey = (k) => { const p = k.split(':'); return { sid: p[1], mid: p[2] } }
export const clientSources = (client) => (client?.info?.leadSources || [])
export const activeSources = (client) => clientSources(client).filter((s) => !s.archived)
export const sourceLabel = (src, vendors) => {
  if (src?.vendorId && Array.isArray(vendors)) { const v = vendors.find((x) => x.id === src.vendorId); if (v) return v.name }
  return src?.label || 'Source'
}
// Sum every per-source value in a bag of entries into { sid: { mid: total } }.
export function aggregateSources(entries) {
  const out = {}
  entries.forEach((d) => Object.keys(d || {}).forEach((k) => {
    if (!isSrcKey(k)) return
    const { sid, mid } = parseSrcKey(k)
    out[sid] = out[sid] || {}
    out[sid][mid] = (out[sid][mid] || 0) + (parseFloat(d[k]) || 0)
  }))
  return out
}

export function fmtVal(m, v, short = false) {
  if (v === null || v === undefined || v === '') return '—'
  if (m.roas) return Math.round(v * 10) / 10 + 'x'
  if (m.dollar) {
    const n = Number(v)
    if (short) {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
      if (n >= 1000) return '$' + Math.round(n / 1000) + 'k'
      return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (m.calc && !m.dollar && !m.roas) return Math.round(v) + '%'
  return v
}

export function benchClass(m, v) {
  if (!m.bench || v === null || v === undefined) return 'neutral'
  if (m.bench.high !== undefined) { if (v >= m.bench.low && v <= m.bench.high) return 'good'; if (v < m.bench.low) return 'bad'; return 'warn' }
  if (v >= m.bench.low) return 'good'; if (v >= m.bench.low * 0.75) return 'warn'; return 'bad'
}

// Fold a single entry's per-source rows into the metrics in SOURCE_FOLD, so a
// week with per-source leads reports leads = sum of its sources (overriding any
// stray direct total for that same entry). Done PER ENTRY — before summing —
// so a history that mixes direct-total weeks and per-source weeks adds up right.
export function effectiveEntry(d) {
  let out = d, cloned = false
  SOURCE_FOLD.forEach((mid) => {
    const keys = Object.keys(d || {}).filter((k) => isSrcKey(k) && parseSrcKey(k).mid === mid)
    if (!keys.length) return
    const sum = keys.reduce((t, k) => t + (parseFloat(d[k]) || 0), 0)
    if (!cloned) { out = { ...d }; cloned = true }
    out[mid] = sum
  })
  return out
}

// Sum a set of daily entries and add the calculated fields.
export function aggregate(entries) {
  const agg = {}
  entries.forEach((d) => {
    const eff = effectiveEntry(d)
    INPUT_METRICS.forEach((m) => { if (eff[m.id] !== undefined) agg[m.id] = (agg[m.id] || 0) + (parseFloat(eff[m.id]) || 0) })
    Object.keys(d || {}).forEach((k) => { if (isSrcKey(k)) agg[k] = (agg[k] || 0) + (parseFloat(d[k]) || 0) })
  })
  METRICS.forEach((m) => { if (m.calc) agg[m.id] = m.calc(agg) })
  return agg
}

// Week-ending Friday for a date (week = Mon–Fri).
export function getWeekEnding(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  let daysToFri
  if (day === 0) daysToFri = 5
  else if (day === 6) daysToFri = 6
  else daysToFri = 5 - day
  const fri = new Date(d)
  fri.setDate(fri.getDate() + daysToFri)
  return fri.toISOString().split('T')[0]
}

export const getMonthKey = (dateStr) => dateStr.slice(0, 7)

// Bucket a client's daily data by week or month, with calcs per bucket.
export function bucketDaily(daily, period) {
  const buckets = {}
  Object.entries(daily || {}).forEach(([dk, data]) => {
    const key = period === 'weekly' ? getWeekEnding(dk) : getMonthKey(dk)
    if (!buckets[key]) buckets[key] = {}
    const eff = effectiveEntry(data)
    INPUT_METRICS.forEach((m) => { if (eff[m.id] !== undefined) buckets[key][m.id] = (buckets[key][m.id] || 0) + (parseFloat(eff[m.id]) || 0) })
    Object.keys(data || {}).forEach((kk) => { if (isSrcKey(kk)) buckets[key][kk] = (buckets[key][kk] || 0) + (parseFloat(data[kk]) || 0) })
  })
  Object.keys(buckets).forEach((k) => { METRICS.filter((m) => m.calc).forEach((m) => { buckets[k][m.id] = m.calc(buckets[k]) }) })
  return buckets
}
