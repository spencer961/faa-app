// ─────────────────────────────────────────────────────────────────────
// Metrics definitions + math — ONE canonical copy.
// The Metrics page uses this, and the dashboard's client cards will reuse
// the exact same calculations so the numbers can never disagree.
// ─────────────────────────────────────────────────────────────────────

// Math helpers
export function pct(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round((av / bv) * 100) }
export function add(a, b) { const av = parseFloat(a) || 0, bv = parseFloat(b) || 0; return av + bv || null }
export function divide(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round(av / bv) }

// The metric list — order matches the original spreadsheet exactly.
// `label` is the full/official name; `short` is the friendly name shown on the
// entry form, with `label` kept underneath as the clarifying helper line.
export const METRICS = [
  { id: 'leads', label: 'Lead Contact Attempts', short: 'Leads worked', section: 'Lead Activity', resp: '', hint: 'Total leads you contacted or worked' },
  { id: 'lead_phone_convos', label: 'Lead Phone Conversations', short: 'Phone conversations', section: 'Lead Activity', resp: '' },
  { id: 'consults_scheduled', label: 'Consults Scheduled (regardless of when)', short: 'Consults scheduled', section: 'Lead Activity', resp: '', hint: 'Booked regardless of the appointment date' },
  { id: 'booking_rate', label: 'Lead Schedule Rate', short: 'Booking rate', section: 'Lead Activity', calc: (d) => pct(d.consults_scheduled, d.leads), bench: { low: 15, high: 30 }, benchLabel: 'Benchmark: 15–30%' },
  { id: 'rescheduled', label: 'Rescheduled to a different day', short: 'Rescheduled', section: 'Lead Activity', resp: '' },
  { id: 'cancelled', label: 'Cancellations', short: 'Cancellations', section: 'Lead Activity', resp: '' },
  { id: 'consults_on_schedule', label: 'Consults on the Schedule (from marketing)', short: 'Consults on schedule', section: 'Show Rate', resp: '', hint: 'From marketing' },
  { id: 'presented_treatment', label: 'Presented Treatment (Held Consultations from marketing)', short: 'Presented treatment', section: 'Show Rate', resp: '', hint: 'Held consultations from marketing' },
  { id: 'show_rate', label: 'Consult Show Rate', short: 'Show rate', section: 'Show Rate', calc: (d) => pct(d.presented_treatment, d.consults_on_schedule), bench: { low: 60 }, benchLabel: 'Benchmark: 60%+' },
  { id: 'internal_closed_tx', label: 'Internal Closed Treatment', short: 'Internal closed tx', section: 'Closing', resp: '', hint: 'Pre-existing patients starting implant treatment' },
  { id: 'internal_closed_arches', label: 'Internal Closed Arches', short: 'Internal arches', section: 'Closing', resp: '', hint: 'Arches, not # of patients' },
  { id: 'marketing_closed_tx', label: 'Marketing Closed Treatment', short: 'Marketing closed tx', section: 'Closing', resp: '', hint: 'First-time patients closed from marketing' },
  { id: 'marketing_closed_arches', label: 'Marketing Closed Arches', short: 'Marketing arches', section: 'Closing', resp: '', hint: 'Arches, not # of patients' },
  { id: 'total_closed_tx', label: 'Total Closed Treatment', short: 'Total closed tx', section: 'Closing', calc: (d) => add(d.internal_closed_tx, d.marketing_closed_tx) },
  { id: 'total_closed_arches', label: 'Total Closed Arches', short: 'Total arches', section: 'Closing', calc: (d) => add(d.internal_closed_arches, d.marketing_closed_arches) },
  { id: 'close_rate', label: 'Close Rate', short: 'Close rate', section: 'Closing', calc: (d) => pct(d.marketing_closed_tx, d.presented_treatment), bench: { low: 25 }, benchLabel: 'Benchmark: 25%+' },
  { id: 'internal_revenue', label: 'Internal Closed Revenue', short: 'Internal revenue', section: 'Revenue', resp: '', dollar: true },
  { id: 'marketing_revenue', label: 'Marketing Closed Revenue', short: 'Marketing revenue', section: 'Revenue', resp: '', dollar: true },
  { id: 'total_revenue', label: 'Total Closed Revenue', short: 'Total revenue', section: 'Revenue', calc: (d) => add(d.internal_revenue, d.marketing_revenue), dollar: true },
  { id: 'marketing_spend', label: 'Total Marketing Budget/Spend', short: 'Marketing spend', section: 'Marketing ROI', resp: '', dollar: true },
  { id: 'cpl', label: 'Cost Per Lead (CPL)', short: 'Cost per lead', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.leads), dollar: true },
  { id: 'cost_per_consult', label: 'Cost Per Consult', short: 'Cost per consult', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.consults_on_schedule), dollar: true },
  { id: 'cost_per_tx', label: 'Cost Per Treatment Start', short: 'Cost per tx start', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.marketing_closed_tx), dollar: true },
  { id: 'roas', label: 'Return on Ad Spend (ROAS)', short: 'ROAS', section: 'Marketing ROI', calc: (d) => divide(d.marketing_revenue, d.marketing_spend), roas: true },
]

export const KEY_METRICS = ['booking_rate', 'show_rate', 'close_rate', 'total_revenue']
export const INPUT_METRICS = METRICS.filter((m) => !m.calc)

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

// Sum a set of daily entries and add the calculated fields.
export function aggregate(entries) {
  const agg = {}
  entries.forEach((d) => {
    INPUT_METRICS.forEach((m) => { if (d[m.id] !== undefined) agg[m.id] = (agg[m.id] || 0) + (parseFloat(d[m.id]) || 0) })
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
    INPUT_METRICS.forEach((m) => { if (data[m.id] !== undefined) buckets[key][m.id] = (buckets[key][m.id] || 0) + (parseFloat(data[m.id]) || 0) })
  })
  Object.keys(buckets).forEach((k) => { METRICS.filter((m) => m.calc).forEach((m) => { buckets[k][m.id] = m.calc(buckets[k]) }) })
  return buckets
}
