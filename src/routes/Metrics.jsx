import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Chart from 'chart.js/auto'
import Header from '../components/Header.jsx'
import { supabase, SUPABASE_URL, SB_HEADERS } from '../lib/supabase.js'
import { getClientMode } from '../lib/clientMode.js'
import {
  METRICS, KEY_METRICS, INPUT_METRICS, fmtVal, benchClass, aggregate, bucketDaily, getWeekEnding, getMonthKey,
} from '../lib/metrics.js'

// Metrics tracker — migrated from metrics.html. Three views:
//   Your view  — per-client performance table
//   Client     — daily data entry + weekly/monthly aggregate (read-only)
//   Trends     — summary stats + 4 charts
// Deferred from the original: Google-Sheet backup sync and auto-save
// (replaced with an explicit Save button).

const ENTRY_SECTIONS = [
  { label: 'Lead Activity', desc: 'Leads and how many turned into booked consults', bg: '#E6F1FB', tc: '#0C447C', accent: '#0C447C', metrics: ['leads', 'lead_phone_convos', 'consults_scheduled', 'rescheduled', 'cancelled'], calcs: ['booking_rate'] },
  { label: 'Show Rate', desc: 'Who actually showed up for their consult', bg: '#EEEDFE', tc: '#3C3489', accent: '#3C3489', metrics: ['consults_on_schedule', 'presented_treatment'], calcs: ['show_rate'] },
  { label: 'Closing', desc: 'Treatment starts and arches closed', bg: '#E1F5EE', tc: '#085041', accent: '#085041', metrics: ['internal_closed_tx', 'internal_closed_arches', 'marketing_closed_tx', 'marketing_closed_arches'], calcs: ['total_closed_tx', 'total_closed_arches', 'close_rate'] },
  { label: 'Revenue & Marketing', desc: 'Dollars in, dollars spent, and your return', bg: '#FAEEDA', tc: '#633806', accent: '#633806', metrics: ['internal_revenue', 'marketing_revenue', 'marketing_spend'], calcs: ['total_revenue', 'cpl', 'cost_per_consult', 'cost_per_tx', 'roas'] },
]
const M = (id) => METRICS.find((m) => m.id === id)
const SEC_LABEL = { 'Lead Activity': 'Lead activity', 'Show Rate': 'Show rate', 'Closing': 'Closing', 'Revenue': 'Revenue', 'Marketing ROI': 'Marketing ROI' }
const today = () => new Date().toISOString().split('T')[0]
const shiftDate = (d, days) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days); return dt.toISOString().split('T')[0] }
const fmtWeekLabel = (fri) => { const f = new Date(fri + 'T12:00:00'); const mon = new Date(f); mon.setDate(mon.getDate() - 4); const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); return fmt(mon) + ' – ' + fmt(f) }
const mkLabel = (k, period) => period === 'monthly' ? new Date(k + '-01T12:00:00').toLocaleString('default', { month: 'short', year: '2-digit' }) : new Date(k + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function Metrics() {
  const [clients, setClients] = useState([])
  const [data, setData] = useState({}) // {clientId:{period:{dateKey:{metricId:value}}}}
  const [searchParams] = useSearchParams()
  const cm = (searchParams.get('client') ? parseInt(searchParams.get('client')) : null) || getClientMode()
  const [mainView, setMainView] = useState(cm ? 'trends' : 'yours')
  const visibleClients = cm ? clients.filter((c) => c.id === cm) : clients

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,doctor,email,status,info').order('id')
      if (Array.isArray(cs)) setClients(cs)
      const { data: rows } = await supabase.from('metrics_tracker').select('*')
      if (Array.isArray(rows)) {
        const md = {}
        rows.forEach((r) => {
          md[r.client_id] = md[r.client_id] || {}
          md[r.client_id][r.period] = md[r.client_id][r.period] || {}
          md[r.client_id][r.period][r.date_key] = r.data || {}
        })
        setData(md)
      }
    })()
  }, [])

  return (
    <div className="mx">
      <style>{CSS}</style>
      <Header
        sub="· Metrics Tracker"
        back="/"
        right={
          <div className="tabs">
            {[['yours', 'Your view'], ['client', 'Client view'], ['trends', 'Trends']].map(([v, label]) => (
              <button key={v} className={'tab' + (mainView === v ? ' active' : '')} onClick={() => setMainView(v)}>{label}</button>
            ))}
          </div>
        }
      />
      <div className="main">
        {mainView === 'yours' && <YoursView clients={visibleClients} data={data} />}
        {mainView === 'client' && <ClientView clients={visibleClients} data={data} setData={setData} />}
        {mainView === 'trends' && <TrendsView clients={visibleClients} data={data} />}
      </div>
    </div>
  )
}

// ── YOUR VIEW ──────────────────────────────────────────────────────────
function YoursView({ clients, data }) {
  const [period, setPeriod] = useState('weekly')
  const [filter, setFilter] = useState('all')

  const cutoff = new Date()
  if (period === 'weekly') cutoff.setDate(cutoff.getDate() - 7)
  else cutoff.setMonth(cutoff.getMonth() - 1)
  const cutStr = cutoff.toISOString().split('T')[0]
  const shown = filter === 'all' ? clients : clients.filter((c) => c.id === filter)

  const badge = (id, v) => {
    const m = M(id); const bc = benchClass(m, v)
    const sym = bc === 'good' ? '✓' : bc === 'warn' ? '⚠' : '✗'
    return <span className={'badge badge-' + bc}>{sym} {fmtVal(m, v)}</span>
  }

  return (
    <>
      <div className="seg-ctrl" style={{ marginBottom: 12 }}>
        <button className={'seg-btn' + (period === 'weekly' ? ' active' : '')} onClick={() => setPeriod('weekly')}>Weekly</button>
        <button className={'seg-btn' + (period === 'monthly' ? ' active' : '')} onClick={() => setPeriod('monthly')}>Monthly</button>
      </div>
      <div className="client-filter">
        <button className={'cf-btn' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>All clients</button>
        {clients.map((c) => <button key={c.id} className={'cf-btn' + (filter === c.id ? ' active' : '')} onClick={() => setFilter(c.id)}>{c.name}</button>)}
      </div>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Performance overview</span>
          <span style={{ fontSize: 11, color: '#888786' }}>
            <span className="badge badge-good">✓ Above</span> <span className="badge badge-warn">⚠ Watch</span> <span className="badge badge-bad">✗ Below</span>
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="perf-table">
            <thead><tr><th>Client</th><th>Booking rate</th><th>Show rate</th><th>Close rate</th><th>Total revenue</th><th>Last entry</th></tr></thead>
            <tbody>
              {shown.map((c) => {
                const daily = data[c.id]?.daily || {}
                const allDates = Object.keys(daily).sort()
                const periodDates = allDates.filter((d) => d >= cutStr)
                const agg = aggregate((periodDates.length ? periodDates : allDates).map((dk) => daily[dk] || {}))
                const noData = !allDates.length
                const last = allDates.length ? new Date(allDates[allDates.length - 1] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>{noData ? <span style={{ color: '#888786', fontStyle: 'italic' }}>No data</span> : badge('booking_rate', agg.booking_rate)}</td>
                    <td>{noData ? '' : badge('show_rate', agg.show_rate)}</td>
                    <td>{noData ? '' : badge('close_rate', agg.close_rate)}</td>
                    <td style={{ fontWeight: 500 }}>{noData ? '—' : fmtVal(M('total_revenue'), agg.total_revenue)}</td>
                    <td style={{ color: '#888786' }}>{last}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── CLIENT VIEW ────────────────────────────────────────────────────────
function ClientView({ clients, data, setData }) {
  const [cid, setCid] = useState(null)
  const [period, setPeriod] = useState('daily')
  const [date, setDate] = useState(today())
  const [form, setForm] = useState({})
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { if (!cid && clients.length) setCid(clients[0].id) }, [clients, cid])
  useEffect(() => { setForm({ ...(data[cid]?.daily?.[date] || {}) }); setDirty(false) }, [cid, date, data])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const setField = (id, v) => { setForm((f) => ({ ...f, [id]: v })); setDirty(true) }

  // live-calc from current form
  const calcVals = aggregate([Object.fromEntries(INPUT_METRICS.map((m) => [m.id, parseFloat(form[m.id]) || 0]))])

  async function save() {
    if (!cid) return
    const client = clients.find((c) => c.id === cid)
    const clean = {}
    INPUT_METRICS.forEach((m) => { if (form[m.id] !== '' && form[m.id] !== undefined && form[m.id] !== null) clean[m.id] = parseFloat(form[m.id]) || 0 })
    await fetch(`${SUPABASE_URL}/rest/v1/metrics_tracker`, {
      method: 'POST',
      headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ client_id: cid, client_name: client?.name || '', period: 'daily', date_key: date, data: clean, responsible: {}, updated_at: new Date().toISOString() }),
    })
    setData((md) => ({ ...md, [cid]: { ...(md[cid] || {}), daily: { ...(md[cid]?.daily || {}), [date]: clean } } }))
    setDirty(false)
    showToast('Saved ✓')
  }

  const isToday = date === today()
  const filled = INPUT_METRICS.filter((m) => form[m.id] !== '' && form[m.id] !== undefined && form[m.id] !== null).length
  const totalInputs = INPUT_METRICS.length
  // Enter or ↓ jumps to the next number field for fast keyboard entry.
  const onKey = (e) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const inputs = [...e.currentTarget.closest('.entry-card').querySelectorAll('input.metric-input')]
    const i = inputs.indexOf(e.currentTarget)
    const next = e.key === 'ArrowUp' ? inputs[i - 1] : inputs[i + 1]
    if (next) { e.preventDefault(); next.focus(); next.select() }
  }

  return (
    <>
      <div className="cv-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888786' }}>Client:</span>
          <select className="slim" value={cid || ''} onChange={(e) => setCid(parseInt(e.target.value))}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="seg-ctrl">
            {[['daily', 'Daily'], ['monthsheet', 'Month sheet'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([p, label]) => <button key={p} className={'seg-btn' + (period === p ? ' active' : '')} onClick={() => setPeriod(p)}>{label}</button>)}
          </div>
        </div>
      </div>

      {period === 'daily' ? (
        <div className="entry-card narrow">
          <div className="entry-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="nav-btn" onClick={() => setDate(shiftDate(date, -1))} title="Previous day">‹</button>
              <input type="date" className="slim" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="nav-btn" onClick={() => !isToday && setDate(shiftDate(date, 1))} disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }} title="Next day">›</button>
              {isToday && <span className="today-pill">Today</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="progress-wrap" title={filled + ' of ' + totalInputs + ' fields entered'}>
                <div className="progress-bar"><div className="progress-fill" style={{ width: (filled / totalInputs * 100) + '%' }} /></div>
                <span className="progress-txt">{filled}/{totalInputs}</span>
              </div>
              <button className="btn-primary" onClick={save} disabled={!dirty}>{dirty ? 'Save' : 'Saved ✓'}</button>
            </div>
          </div>
          <div className="sheet-tip">Tip: press <kbd>Tab</kbd> to jump to the next field.</div>
          <div className="sheet-list">
            {METRICS.map((m) => m.calc ? (
              <div className="sheet-row gold" key={m.id}>
                <span className="sheet-name">{m.label}</span>
                <span className="sheet-out">{fmtVal(m, calcVals[m.id])}</span>
              </div>
            ) : (
              <div className="sheet-row" key={m.id}>
                <span className="sheet-name">{m.label}{m.hint && <span className="sheet-hint">{m.hint}</span>}</span>
                <span className="sheet-input-wrap">{m.dollar && <span className="ds">$</span>}<input className="metric-input sheet-input" type="number" min="0" inputMode="decimal" value={form[m.id] ?? ''} placeholder="0" onChange={(e) => setField(m.id, e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={onKey} /></span>
              </div>
            ))}
          </div>
        </div>
      ) : period === 'monthsheet' ? (
        <MonthGrid cid={cid} clients={clients} data={data} setData={setData} />
      ) : (
        <AggView daily={data[cid]?.daily || {}} period={period} />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  )
}

// ── MONTH SHEET ────────────────────────────────────────────────────────
// Full month as a spreadsheet: metrics down the left, weekdays across the top.
// Built for bulk entry — paste a block straight from the client's Google Sheet
// and it drops into the matching cells (computed gold rows are left untouched).
const monthShift = (mk, delta) => { const [y, mo] = mk.split('-').map(Number); const dt = new Date(y, mo - 1 + delta, 1); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') }
const weekdaysOf = (mk) => { const [y, mo] = mk.split('-').map(Number); const last = new Date(y, mo, 0).getDate(); const out = []; for (let d = 1; d <= last; d++) { const dt = new Date(y, mo - 1, d); const wd = dt.getDay(); if (wd >= 1 && wd <= 5) out.push(mk + '-' + String(d).padStart(2, '0')) } return out }
const dayHdr = (dk) => new Date(dk + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function MonthGrid({ cid, clients, data, setData }) {
  const [monthKey, setMonthKey] = useState(today().slice(0, 7))
  const [grid, setGrid] = useState({})
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const days = weekdaysOf(monthKey)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const daily = data[cid]?.daily || {}
    const g = {}
    weekdaysOf(monthKey).forEach((dk) => { g[dk] = { ...(daily[dk] || {}) } })
    setGrid(g); setDirty(false)
  }, [cid, monthKey, data])

  const setCell = (dk, mid, v) => { setGrid((g) => ({ ...g, [dk]: { ...(g[dk] || {}), [mid]: v } })); setDirty(true) }

  // Paste a spreadsheet block: rows = metrics, columns = days, anchored at the target cell.
  const onPaste = (e, mIndex, dIndex) => {
    const text = e.clipboardData.getData('text')
    if (!text) return
    e.preventDefault()
    const matrix = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((r) => r.split('\t'))
    setGrid((g) => {
      const ng = { ...g }
      matrix.forEach((rowVals, i) => {
        const metric = METRICS[mIndex + i]
        if (!metric || metric.calc) return // never write into computed gold rows
        rowVals.forEach((raw, j) => {
          const dk = days[dIndex + j]
          if (!dk) return
          const clean = String(raw).trim().replace(/[$,%\s]/g, '')
          ng[dk] = { ...(ng[dk] || {}), [metric.id]: clean }
        })
      })
      return ng
    })
    setDirty(true)
  }

  async function save() {
    const client = clients.find((c) => c.id === cid)
    const rows = []
    Object.entries(grid).forEach(([dk, vals]) => {
      const clean = {}
      INPUT_METRICS.forEach((m) => { const v = vals[m.id]; if (v !== '' && v !== undefined && v !== null) clean[m.id] = parseFloat(v) || 0 })
      if (Object.keys(clean).length) rows.push({ client_id: cid, client_name: client?.name || '', period: 'daily', date_key: dk, data: clean, responsible: {}, updated_at: new Date().toISOString() })
    })
    if (!rows.length) { showToast('Nothing to save'); return }
    await fetch(`${SUPABASE_URL}/rest/v1/metrics_tracker`, { method: 'POST', headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) })
    setData((md) => { const daily = { ...(md[cid]?.daily || {}) }; rows.forEach((r) => { daily[r.date_key] = r.data }); return { ...md, [cid]: { ...(md[cid] || {}), daily } } })
    setDirty(false); showToast('Saved ' + rows.length + ' day' + (rows.length !== 1 ? 's' : '') + ' ✓')
  }

  const bodyRows = []
  let lastSec = null
  METRICS.forEach((m, mi) => {
    if (m.section !== lastSec) { lastSec = m.section; bodyRows.push(<tr key={'sec_' + m.section} className="gt-sec"><td colSpan={days.length + 1}>{SEC_LABEL[m.section] || m.section}</td></tr>) }
    bodyRows.push(
      <tr key={m.id} className={m.calc ? 'gt-gold' : ''}>
        <td className="gt-name" title={m.hint || ''}>{m.label}</td>
        {days.map((dk, di) => m.calc
          ? <td key={dk} className="gt-cell gt-out">{fmtVal(m, m.calc(grid[dk] || {}))}</td>
          : <td key={dk} className="gt-cell"><input className="gt-input" type="number" value={grid[dk]?.[m.id] ?? ''} onChange={(e) => setCell(dk, m.id, e.target.value)} onPaste={(e) => onPaste(e, mi, di)} onFocus={(e) => e.target.select()} /></td>
        )}
      </tr>
    )
  })

  return (
    <div className="entry-card">
      <div className="entry-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="nav-btn" onClick={() => setMonthKey(monthShift(monthKey, -1))} title="Previous month">‹</button>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 130, textAlign: 'center' }}>{new Date(monthKey + '-01T12:00:00').toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <button className="nav-btn" onClick={() => setMonthKey(monthShift(monthKey, 1))} title="Next month">›</button>
        </div>
        <button className="btn-primary" onClick={save} disabled={!dirty}>{dirty ? 'Save all' : 'Saved ✓'}</button>
      </div>
      <div className="gt-note"><span>Paste rows straight from your spreadsheet — click the first day’s cell for a metric, then paste. Gold rows total up automatically.</span></div>
      <div className="gt-scroll">
        <table className="grid-table">
          <thead><tr><th className="gt-name-h">Daily metric</th>{days.map((dk) => <th key={dk} className="gt-day-h">{dayHdr(dk)}</th>)}</tr></thead>
          <tbody>{bodyRows}</tbody>
        </table>
      </div>
      {toast && <div className="toast show">{toast}</div>}
    </div>
  )
}

function AggView({ daily, period }) {
  const buckets = bucketDaily(daily, period)
  const keys = Object.keys(buckets).sort().slice(-12)
  if (!keys.length) return <div className="empty-state">No daily data to aggregate yet.</div>
  const totals = aggregate(keys.map((k) => buckets[k]))
  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        {KEY_METRICS.map((id) => { const m = M(id); const bc = benchClass(m, totals[id]); return (
          <div className="stat" key={id}><div className="stat-label">{m.label}</div><div className={'stat-val ' + bc}>{fmtVal(m, totals[id])}</div><div className={'stat-bench ' + bc}>{m.benchLabel || 'Total'}</div></div>
        )})}
      </div>
      <div className="card">
        <div className="card-head"><span className="card-title">{period === 'weekly' ? 'Weekly' : 'Monthly'} summary — auto-calculated from daily entries</span><span style={{ fontSize: 11, color: '#888786' }}>Read only</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="agg-table">
            <thead><tr><th style={{ textAlign: 'left' }}>Metric</th>{keys.map((k) => <th key={k}>{period === 'weekly' ? fmtWeekLabel(k) : new Date(k + '-01T12:00:00').toLocaleString('default', { month: 'short', year: '2-digit' })}</th>)}</tr></thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.id} className={m.calc ? 'calc-row' : ''}>
                  <td style={{ textAlign: 'left', fontWeight: m.calc && m.bench ? 600 : 400, color: m.calc && m.bench ? '#1a1a1a' : '#888786' }}>{m.label}</td>
                  {keys.map((k) => { const v = buckets[k]?.[m.id]; const bc = m.bench ? benchClass(m, v) : ''; const color = bc === 'good' ? '#27500A' : bc === 'warn' ? '#633806' : bc === 'bad' ? '#791F1F' : 'inherit'; return <td key={k} style={{ color, fontWeight: m.calc && m.bench ? 600 : 400 }}>{fmtVal(m, v)}</td> })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── TRENDS VIEW ────────────────────────────────────────────────────────
function TrendsView({ clients, data }) {
  const [cid, setCid] = useState(null)
  const [period, setPeriod] = useState('weekly')
  const [range, setRange] = useState(12)
  const refs = { leads: useRef(), rates: useRef(), revenue: useRef(), closing: useRef() }
  const charts = useRef({})

  useEffect(() => { if (!cid && clients.length) setCid(clients[0].id) }, [clients, cid])

  const buckets = cid ? bucketDaily(data[cid]?.daily || {}, period) : {}
  let keys = Object.keys(buckets).sort()
  if (range !== 0) { const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - range); const cut = cutoff.toISOString().split('T')[0].slice(0, 7); keys = keys.filter((k) => k >= cut) }
  const totals = aggregate(keys.map((k) => buckets[k]))
  const summary = [
    ['leads', 'Total leads'], ['booking_rate', 'Avg booking rate'], ['show_rate', 'Avg show rate'], ['close_rate', 'Avg close rate'],
    ['marketing_closed_tx', 'Total closed tx'], ['total_revenue', 'Total revenue'], ['total_closed_arches', 'Total arches'], ['roas', 'Avg ROAS'],
  ]

  useEffect(() => {
    const labels = keys.map((k) => mkLabel(k, period))
    const get = (id) => keys.map((k) => buckets[k]?.[id] ?? null)
    const dark = window.matchMedia('(prefers-color-scheme:dark)').matches
    const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const tick = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
    const base = (opts = {}) => ({
      responsive: true, maintainAspectRatio: true, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => { const v = c.raw; if (v == null) return null; if (opts.pct) return c.dataset.label + ': ' + Math.round(v) + '%'; if (opts.dollar) return c.dataset.label + ': $' + Math.round(v).toLocaleString(); return c.dataset.label + ': ' + Math.round(v * 10) / 10 } } } },
      scales: opts.stacked
        ? { x: { stacked: true, grid: { color: grid }, ticks: { color: tick, font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, grid: { color: grid }, ticks: { color: tick, font: { size: 10 }, callback: (v) => '$' + v.toLocaleString() } } }
        : { x: { grid: { color: grid }, ticks: { color: tick, font: { size: 10 }, maxRotation: 45 } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { color: tick, font: { size: 10 }, callback: (v) => opts.pct ? v + '%' : opts.dollar ? '$' + v.toLocaleString() : v }, ...(opts.yMax ? { max: opts.yMax } : {}) } },
    })
    const build = (key, type, datasets, opts) => {
      if (charts.current[key]) charts.current[key].destroy()
      const ctx = refs[key].current?.getContext('2d')
      if (!ctx) return
      charts.current[key] = new Chart(ctx, { type, data: { labels, datasets }, options: base(opts) })
    }
    build('leads', 'bar', [
      { label: 'Leads', data: get('leads'), backgroundColor: 'rgba(11,29,94,0.7)', borderRadius: 3, order: 2 },
      { label: 'Consults scheduled', data: get('consults_scheduled'), backgroundColor: 'rgba(188,151,98,0.7)', borderRadius: 3, order: 3 },
      { label: 'Consults on schedule', data: get('consults_on_schedule'), type: 'line', borderColor: '#5DCAA5', backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 3], pointRadius: 3, pointBackgroundColor: '#5DCAA5', tension: 0.3, order: 1 },
    ])
    build('rates', 'line', [
      { label: 'Booking rate', data: get('booking_rate'), borderColor: '#0b1d5e', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#0b1d5e', tension: 0.3 },
      { label: 'Show rate', data: get('show_rate'), borderColor: '#bc9762', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#bc9762', tension: 0.3 },
      { label: 'Close rate', data: get('close_rate'), borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#22c55e', tension: 0.3 },
    ], { pct: true, yMax: 120 })
    build('revenue', 'bar', [
      { label: 'Marketing revenue', data: get('marketing_revenue'), backgroundColor: 'rgba(11,29,94,0.75)', borderRadius: 3 },
      { label: 'Internal revenue', data: get('internal_revenue'), backgroundColor: 'rgba(188,151,98,0.75)', borderRadius: 3 },
    ], { dollar: true, stacked: true })
    build('closing', 'bar', [
      { label: 'Mktg closed tx', data: get('marketing_closed_tx'), backgroundColor: 'rgba(11,29,94,0.7)', borderRadius: 3, order: 2 },
      { label: 'Total arches', data: get('total_closed_arches'), type: 'line', borderColor: '#5DCAA5', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#5DCAA5', tension: 0.3, order: 1 },
    ])
    return () => { Object.values(charts.current).forEach((c) => c.destroy()); charts.current = {} }
  }, [cid, period, range, data])

  return (
    <>
      <div className="cv-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888786' }}>Client:</span>
          <select className="slim" value={cid || ''} onChange={(e) => setCid(parseInt(e.target.value))}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="seg-ctrl">{['weekly', 'monthly'].map((p) => <button key={p} className={'seg-btn' + (period === p ? ' active' : '')} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>
          <div className="seg-ctrl">{[[3, '3mo'], [6, '6mo'], [12, '1yr'], [0, 'All']].map(([r, l]) => <button key={r} className={'seg-btn' + (range === r ? ' active' : '')} onClick={() => setRange(r)}>{l}</button>)}</div>
        </div>
      </div>
      <div className="stat-grid four" style={{ marginBottom: 12 }}>
        {summary.map(([id, label]) => { const m = M(id); const bc = m?.bench ? benchClass(m, totals[id]) : 'neutral'; return (
          <div className="stat" key={id}><div className="stat-label">{label}</div><div className={'stat-val ' + bc}>{m ? fmtVal(m, totals[id]) : '—'}</div><div className={'stat-bench ' + bc}>{m?.benchLabel || 'This period'}</div></div>
        )})}
      </div>
      {!keys.length && <div className="empty-state">No data in this range yet.</div>}
      <div style={{ display: keys.length ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: 12 }}><div className="card-head"><span className="card-title">Lead volume & consults</span></div><div style={{ padding: 16 }}><canvas ref={refs.leads} height="80" /></div></div>
        <div className="chart-2col">
          <div className="card"><div className="card-head"><span className="card-title">Conversion rates</span></div><div style={{ padding: 16 }}><canvas ref={refs.rates} height="120" /></div></div>
          <div className="card"><div className="card-head"><span className="card-title">Revenue</span></div><div style={{ padding: 16 }}><canvas ref={refs.revenue} height="120" /></div></div>
        </div>
        <div className="card" style={{ marginTop: 12 }}><div className="card-head"><span className="card-title">Closed treatment & arches</span></div><div style={{ padding: 16 }}><canvas ref={refs.closing} height="70" /></div></div>
      </div>
    </>
  )
}

const CSS = `
.mx{min-height:100vh;background:#f5f5f4;color:#1a1a1a;font-size:13px;}
.mx .tabs{display:flex;background:rgba(255,255,255,0.12);border-radius:8px;padding:3px;gap:2px;}
.mx .tab{padding:5px 14px;border-radius:6px;border:none;background:transparent;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;}
.mx .tab.active{background:#fff;color:#0b1d5e;font-weight:600;}
.mx .main{max-width:1100px;margin:0 auto;padding:20px;}
.mx .card{background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:10px;overflow:hidden;}
.mx .card-head{padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:space-between;}
.mx .card-title{font-size:13px;font-weight:500;}
.mx .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
.mx .stat{background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:8px;padding:12px 14px;}
.mx .stat-label{font-size:10px;color:#888786;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;line-height:1.3;}
.mx .stat-val{font-size:18px;font-weight:500;line-height:1.2;word-break:break-word;}
.mx .stat-bench{font-size:10px;margin-top:4px;line-height:1.3;}
.mx .good{color:#27500A;} .mx .warn{color:#633806;} .mx .bad{color:#791F1F;} .mx .neutral{color:#888786;}
.mx .seg-ctrl{display:flex;gap:2px;background:#eceae7;border-radius:6px;padding:2px;}
.mx .seg-btn{padding:4px 12px;border-radius:5px;border:none;cursor:pointer;font-size:11px;background:transparent;color:#888786;}
.mx .seg-btn.active{background:#fff;color:#1a1a1a;font-weight:500;box-shadow:0 0 0 0.5px rgba(0,0,0,0.1);}
.mx .perf-table{width:100%;border-collapse:collapse;}
.mx .perf-table th{padding:8px 12px;font-size:10px;font-weight:600;color:#888786;text-transform:uppercase;letter-spacing:.04em;background:#f9f9f8;border-bottom:0.5px solid rgba(0,0,0,0.08);text-align:left;}
.mx .perf-table td{padding:9px 12px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:12px;}
.mx .perf-table tr:last-child td{border-bottom:none;}
.mx .perf-table tr:hover td{background:#f9f9f8;}
.mx .badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:8px;font-size:11px;font-weight:500;}
.mx .badge-good{background:#EAF3DE;color:#27500A;} .mx .badge-warn{background:#FAEEDA;color:#633806;} .mx .badge-bad{background:#FCEBEB;color:#791F1F;} .mx .badge-neutral{background:#f5f5f4;color:#888786;}
.mx .client-filter{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;}
.mx .cf-btn{padding:4px 12px;border-radius:10px;border:0.5px solid rgba(0,0,0,0.1);background:transparent;color:#888786;font-size:11px;cursor:pointer;}
.mx .cf-btn.active{background:#0b1d5e;color:#bc9762;border-color:#0b1d5e;}
.mx .btn-primary{height:34px;padding:0 18px;border:none;border-radius:8px;background:#0b1d5e;color:#bc9762;font-size:13px;font-weight:500;cursor:pointer;}
.mx .btn-primary:disabled{opacity:.55;cursor:default;}
.mx .slim{height:30px;padding:0 8px;border:0.5px solid rgba(0,0,0,0.12);border-radius:6px;background:#fff;color:#1a1a1a;font-size:12px;}
.mx .cv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;}
.mx .entry-card{background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:10px;overflow:hidden;}
.mx .entry-bar{padding:12px 16px;border-bottom:0.5px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.mx .nav-btn{width:30px;height:30px;border:0.5px solid rgba(0,0,0,0.12);border-radius:6px;background:transparent;cursor:pointer;font-size:16px;line-height:1;color:#1a1a1a;}
.mx .today-pill{padding:2px 10px;border-radius:10px;border:1.5px solid #bc9762;color:#bc9762;font-size:11px;font-weight:600;}
.mx .entry-card.narrow{max-width:576px;}
.mx .sheet-tip{padding:8px 16px;font-size:11px;color:#888786;background:#f9f9f8;border-bottom:0.5px solid rgba(0,0,0,0.06);}
.mx .sheet-tip kbd{font-family:inherit;font-size:10px;background:#fff;border:0.5px solid rgba(0,0,0,0.2);border-radius:4px;padding:1px 5px;color:#1a1a1a;}
.mx .sheet-list{padding:0 0 6px;}
.mx .sheet-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 16px;background:#fff;border-bottom:0.5px solid rgba(0,0,0,0.05);}
.mx .sheet-row.gold{background:#FAEEDA;}
.mx .sheet-name{font-size:13px;color:#1a1a1a;line-height:1.3;display:flex;flex-direction:column;}
.mx .sheet-row.gold .sheet-name{flex-direction:row;align-items:center;gap:7px;color:#633806;}
.mx .sheet-hint{font-size:11px;color:#a0a09e;line-height:1.3;margin-top:1px;}
.mx .sheet-out{font-size:15px;font-weight:600;color:#633806;font-variant-numeric:tabular-nums;min-width:56px;text-align:right;}
.mx .sheet-input-wrap{display:flex;align-items:center;flex-shrink:0;}
.mx .sheet-input-wrap .ds{color:#888786;font-size:14px;margin-right:2px;}
.mx .sheet-input{width:92px;height:34px;border:0.5px solid rgba(0,0,0,0.12);border-radius:7px;background:#fff;text-align:right;font-size:16px;font-weight:600;color:#1a1a1a;padding:0 10px;font-variant-numeric:tabular-nums;}
.mx .sheet-input:focus{border-color:#0b1d5e;outline:none;box-shadow:0 0 0 3px rgba(11,29,94,0.08);}
.mx .sheet-input::placeholder{color:#cfcecb;font-weight:500;}
.mx .gt-note{padding:10px 16px;font-size:12px;color:#888786;background:#f9f9f8;border-bottom:0.5px solid rgba(0,0,0,0.06);line-height:1.4;}
.mx .gt-scroll{overflow-x:auto;}
.mx .grid-table{border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums;}
.mx .grid-table th,.mx .grid-table td{border-bottom:0.5px solid rgba(0,0,0,0.06);border-right:0.5px solid rgba(0,0,0,0.05);}
.mx .gt-name-h,.mx .gt-name{position:sticky;left:0;z-index:2;background:#fff;text-align:left;min-width:210px;max-width:210px;padding:7px 12px;font-size:12px;color:#1a1a1a;}
.mx .gt-name-h{z-index:3;background:#f9f9f8;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#888786;}
.mx .gt-day-h{min-width:64px;padding:7px 6px;font-size:11px;font-weight:600;color:#888786;background:#f9f9f8;text-align:center;white-space:nowrap;position:sticky;top:0;}
.mx .gt-cell{padding:0;text-align:center;height:34px;}
.mx .gt-input{width:64px;height:33px;border:none;background:transparent;text-align:center;font-size:13px;color:#1a1a1a;padding:0 4px;font-variant-numeric:tabular-nums;}
.mx .gt-input:focus{outline:2px solid #0b1d5e;outline-offset:-2px;background:#fbfcff;}
.mx .gt-sec td{background:#f2f1ee;padding:5px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#888786;position:sticky;left:0;}
.mx .gt-gold td{background:#FAEEDA;}
.mx .gt-gold .gt-name{background:#FAEEDA;color:#633806;}
.mx .gt-out{font-size:12px;font-weight:600;color:#633806;padding:0 6px;text-align:center;white-space:nowrap;}
.mx .progress-wrap{display:flex;align-items:center;gap:7px;}
.mx .progress-bar{width:70px;height:6px;border-radius:3px;background:#eceae7;overflow:hidden;}
.mx .progress-fill{height:100%;background:#0b1d5e;border-radius:3px;transition:width .3s;}
.mx .progress-txt{font-size:11px;color:#888786;font-variant-numeric:tabular-nums;}
.mx .entry-sections{padding:14px;display:flex;flex-direction:column;gap:14px;}
.mx .entry-band{background:#fbfbfa;border:0.5px solid rgba(0,0,0,0.08);border-left:3px solid #0b1d5e;border-radius:10px;padding:14px 16px;}
.mx .band-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
.mx .band-tag{display:inline-block;padding:3px 11px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.02em;}
.mx .band-desc{font-size:12px;color:#888786;}
.mx .field-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:10px;}
.mx .field{display:flex;flex-direction:column;background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:9px;padding:9px 11px;transition:border-color .15s,box-shadow .15s;}
.mx .field.filled{border-color:rgba(11,29,94,0.4);background:#fbfcff;}
.mx .field:focus-within{border-color:#0b1d5e;box-shadow:0 0 0 3px rgba(11,29,94,0.08);}
.mx .field label{font-size:12px;font-weight:600;color:#1a1a1a;line-height:1.25;}
.mx .field-hint{font-size:10px;color:#a0a09e;line-height:1.3;margin-top:1px;}
.mx .input-wrap{display:flex;align-items:center;margin-top:7px;}
.mx .input-wrap.dollar .dollar-sign{font-size:16px;color:#888786;margin-right:2px;font-weight:500;}
.mx .metric-input{width:100%;height:38px;border:none;background:transparent;font-size:22px;font-weight:600;color:#1a1a1a;padding:0;font-variant-numeric:tabular-nums;}
.mx .metric-input:focus{outline:none;}
.mx .metric-input::placeholder{color:#cfcecb;font-weight:500;}
.mx .calc-tiles{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:0.5px dashed rgba(0,0,0,0.1);}
.mx .calc-tile{display:flex;flex-direction:column;gap:2px;padding:7px 12px;border-radius:8px;background:#f2f1ee;min-width:96px;}
.mx .calc-tile .calc-label{font-size:10px;color:#888786;text-transform:uppercase;letter-spacing:.03em;}
.mx .calc-tile .calc-value{font-size:16px;font-weight:600;}
.mx .calc-tile.good{background:#EAF3DE;} .mx .calc-tile.good .calc-value{color:#27500A;}
.mx .calc-tile.warn{background:#FAEEDA;} .mx .calc-tile.warn .calc-value{color:#633806;}
.mx .calc-tile.bad{background:#FCEBEB;} .mx .calc-tile.bad .calc-value{color:#791F1F;}
.mx .calc-tile.neutral .calc-value{color:#1a1a1a;}
.mx .agg-table{border-collapse:collapse;width:100%;min-width:600px;}
.mx .agg-table th{padding:7px 10px;font-size:11px;font-weight:600;color:#888786;text-align:center;background:#f9f9f8;white-space:nowrap;}
.mx .agg-table td{padding:6px 10px;text-align:center;font-size:12px;border-top:0.5px solid rgba(0,0,0,0.05);white-space:nowrap;}
.mx .agg-table tr.calc-row td{background:rgba(11,29,94,0.025);}
.mx .empty-state{padding:40px;text-align:center;color:#888786;font-size:13px;font-style:italic;}
.mx .chart-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.mx .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0b1d5e;color:#fff;font-size:12px;padding:8px 18px;border-radius:20px;z-index:999;opacity:0;transition:opacity .2s;pointer-events:none;}
.mx .toast.show{opacity:1;}
@media(max-width:700px){.mx .chart-2col,.mx .stat-grid{grid-template-columns:1fr 1fr;}}
`
