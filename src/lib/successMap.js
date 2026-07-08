// ─────────────────────────────────────────────────────────────────────
// Success Map scoring taxonomy + health math — ONE canonical copy.
// The Success Map page uses this, and the dashboard's progress bar will
// reuse health() so the "how close to graduating" number always matches.
// ─────────────────────────────────────────────────────────────────────

export const SC = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }
export const CYCLE = { red: 'yellow', yellow: 'green', green: 'red' }

export const CATS = [
  { id: 'clinical', name: 'Clinical Excellence', items: [
    { id: 'implant_trained', name: 'Implant Trained' }, { id: 'full_arch_trained', name: 'Full-Arch Trained' }, { id: 'zygos_trained', name: 'Zygos & Pterygoids Trained' },
  ]},
  { id: 'operational', name: 'Operational Excellence', items: [
    { id: 'mindset', name: 'Mindset' }, { id: 'leadership', name: 'Leadership' }, { id: 'profitability', name: 'Profitability' },
  ]},
  { id: 'brand', name: 'Brand Messaging', items: [
    { id: 'uvp', name: 'Unique Value Proposition', subs: [
      { id: 'uvp_primary', name: 'Create a Primary UVP' }, { id: 'uvp_secondary', name: 'Create Secondary UVPs' },
      { id: 'uvp_marketing', name: 'Disseminate UVP(s) in Marketing' }, { id: 'uvp_appt_script', name: 'Disseminate UVP(s) in Appointment Setting Script' },
      { id: 'uvp_consult_script', name: 'Disseminate UVP(s) in Consultation Script' },
    ]},
    { id: 'video_testimonials', name: 'Video Testimonials / Smile Reveals', subs: [
      { id: 'vt_created', name: 'Videos created & system in place' }, { id: 'vt_disseminated', name: 'Disseminated in marketing' },
    ]},
    { id: 'before_after', name: 'Before & After Photos', subs: [
      { id: 'ba_created', name: 'Photos created & system in place' }, { id: 'ba_disseminated', name: 'Disseminated in marketing' },
    ]},
    { id: 'reviews', name: 'Online Ratings & Reviews', subs: [
      { id: 'rev_automated', name: 'Automated Email & Text System' }, { id: 'rev_inoffice', name: 'In-Office Reviews System' },
    ]},
    { id: 'educational_videos', name: 'Educational Videos', subs: [
      { id: 'ev_created', name: 'Videos created & system in place' }, { id: 'ev_disseminated', name: 'Disseminated in marketing' },
    ]},
  ]},
  { id: 'closing', name: 'Closing System', items: [
    { id: 'team', name: 'The Team', subs: [
      { id: 'team_appt_setter', name: 'Appointment Setter' }, { id: 'team_tc', name: 'Treatment Coordinator' }, { id: 'team_doctor', name: 'Doctor' },
    ]},
    { id: 'training_system', name: 'Training System' },
    { id: 'accountability', name: 'Accountability System', subs: [
      { id: 'acct_metrics', name: 'Metrics Tracking' }, { id: 'acct_huddle', name: 'Daily Huddle / Personal Reporting' },
    ]},
    { id: 'closing_metrics', name: 'Closing Metrics', subs: [
      { id: 'booking_rate', name: 'Booking Rate' }, { id: 'show_rate', name: 'Show Rate' }, { id: 'close_rate', name: 'Close Rate' },
    ]},
    { id: 'incentivization', name: 'Incentivization System', subs: [
      { id: 'inc_appt', name: 'Appointment Setter Reward System' }, { id: 'inc_tc', name: 'Treatment Coordinator Reward System' },
    ]},
    { id: 'financing', name: 'Financing Companies' },
  ]},
  { id: 'marketing', name: 'Marketing System', items: [
    { id: 'patient_db', name: 'Patient Database Marketing' }, { id: 'ppc', name: 'Pay-Per-Click (PPC)' }, { id: 'lead_db', name: 'Lead Database Marketing' },
    { id: 'website', name: 'Website' }, { id: 'seo', name: 'SEO' }, { id: 'ottctv', name: 'OTT / Connected TV' },
    { id: 'tv_commercials', name: 'TV Commercials' }, { id: 'tv_block', name: 'TV Block Programming' }, { id: 'radio', name: 'Radio' },
    { id: 'grassroots', name: 'Grassroots Marketing', subs: [{ id: 'grass_social', name: 'Social Posting' }, { id: 'grass_other', name: 'Other Grassroots' }] },
    { id: 'roi_tracking', name: 'Metric / ROI Tracking' },
  ]},
]

export const leafIds = (cats) => cats.flatMap((c) => (c.items || []).flatMap((i) => (i.subs ? i.subs.map((s) => s.id) : [i.id])))

// A parent item is green only if all subs are green, red only if all red, else yellow.
export const pScore = (sc, item) => {
  if (!item.subs) return sc[item.id] || 'red'
  const v = item.subs.map((s) => sc[s.id] || 'red')
  if (v.every((x) => x === 'green')) return 'green'
  if (v.every((x) => x === 'red')) return 'red'
  return 'yellow'
}

// Health = % of all leaf items that are green.
export const health = (sc) => {
  const ids = leafIds(CATS)
  const g = ids.filter((id) => (sc[id] || 'red') === 'green').length
  return Math.round((g / ids.length) * 100)
}

export const initScores = () => {
  const s = {}
  leafIds(CATS).forEach((id) => { s[id] = 'red' })
  return s
}
