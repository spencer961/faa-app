// ─────────────────────────────────────────────────────────────────────
// Metrics definitions + math — ONE canonical copy.
// The Metrics page uses this, and the dashboard's client cards will reuse
// the exact same calculations so the numbers can never disagree.
// ─────────────────────────────────────────────────────────────────────

// Math helpers
export function pct(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round((av / bv) * 100) }
export function add(a, b) { const av = parseFloat(a) || 0, bv = parseFloat(b) || 0; return av + bv || null }
export function divide(a, b) { const av = parseFloat(a), bv = parseFloat(b); if (!av || !bv || bv === 0) return null; return Math.round(av / bv) }

// The metric list — labels match the client's spreadsheet EXACTLY (column B).
// `label` is the official row name; `hint` holds the clarifier note the sheet
// shows beneath a name, displayed as a small helper line on the entry form.
export const METRICS = [
  { id: 'leads', label: 'Lead Contact Attempts', section: 'Lead Activity', resp: '', hint: '"# of Leads Worked"' },
  { id: 'lead_phone_convos', label: 'Lead Phone Conversations', section: 'Lead Activity', resp: '' },
  { id: 'consults_scheduled', label: 'Consults Scheduled (Regardless of when)', section: 'Lead Activity', resp: '' },
  { id: 'booking_rate', label: 'Lead Schedule Rate', section: 'Lead Activity', calc: (d) => pct(d.consults_scheduled, d.leads), bench: { low: 15, high: 30 }, benchLabel: 'Benchmark: 15–30%' },
  { id: 'rescheduled', label: 'Rescheduled to a different day', section: 'Lead Activity', resp: '' },
  { id: 'cancelled', label: 'Cancellations', section: 'Lead Activity', resp: '' },
  { id: 'consults_on_schedule', label: 'Consults on the Schedule (from marketing)', section: 'Show Rate', resp: '' },
  { id: 'presented_treatment', label: 'Presented Treatment (Held Consultations from marketing)', section: 'Show Rate', resp: '' },
  { id: 'show_rate', label: 'Consult Show Rate', section: 'Show Rate', calc: (d) => pct(d.presented_treatment, d.consults_on_schedule), bench: { low: 60 }, benchLabel: 'Benchmark: 60%+' },
  { id: 'internal_closed_tx', label: 'INTERNAL Closed Treatment', section: 'Closing', resp: '', hint: '(# of pre-existing patients starting some form of implant treatment)' },
  { id: 'internal_closed_arches', label: 'Internal Closed Arches', section: 'Closing', resp: '', hint: '(Not the # of patients)' },
  { id: 'marketing_closed_tx', label: 'MARKETING Closed Treatment', section: 'Closing', resp: '', hint: '(# of 1st time patients closed from marketing regardless of consult date)' },
  { id: 'marketing_closed_arches', label: 'Marketing Closed Arches', section: 'Closing', resp: '', hint: '(Not the # of patients)' },
  { id: 'total_closed_tx', label: 'Total Closed Treatment', section: 'Closing', calc: (d) => add(d.internal_closed_tx, d.marketing_closed_tx) },
  { id: 'total_closed_arches', label: 'Total Closed Arches', section: 'Closing', calc: (d) => add(d.internal_closed_arches, d.marketing_closed_arches) },
  { id: 'close_rate', label: 'Close Rate', section: 'Closing', calc: (d) => pct(d.marketing_closed_tx, d.presented_treatment), bench: { low: 25 }, benchLabel: 'Benchmark: 25%+' },
  { id: 'internal_revenue', label: 'Internal Closed Revenue', section: 'Revenue', resp: '', dollar: true },
  { id: 'marketing_revenue', label: 'Marketing Closed Revenue', section: 'Revenue', resp: '', dollar: true },
  { id: 'total_revenue', label: 'Total Closed Revenue', section: 'Revenue', calc: (d) => add(d.internal_revenue, d.marketing_revenue), dollar: true },
  { id: 'marketing_spend', label: 'Total Marketing Budget/Spend', section: 'Marketing ROI', resp: '', dollar: true },
  { id: 'cpl', label: 'Cost Per Lead (CPL)', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.leads), dollar: true },
  { id: 'cost_per_consult', label: 'Cost Per Consult', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.consults_on_schedule), dollar: true },
  { id: 'cost_per_tx', label: 'Cost Per Treatment Start', section: 'Marketing ROI', calc: (d) => divide(d.marketing_spend, d.marketing_closed_tx), dollar: true },
  { id: 'roas', label: 'Return on Ad Spend (ROAS)', section: 'Marketing ROI', calc: (d) => divide(d.marketing_revenue, d.marketing_spend), roas: true },
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
