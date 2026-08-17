import { useState, useEffect } from 'react'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED, CARD, INP, BTNP, BTNS } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { uid, CAT_PALETTE, GUIDES_BUCKET, PILLARS, ROLES, pillarById, roleById, SEED_ITEMS } from '../lib/content.js'

// ─────────────────────────────────────────────────────────────────────
// Content Library (admin) — where videos + guides live. Videos are external
// links (Vimeo/YouTube); guides are files uploaded to the private `guides`
// bucket. Each item is tagged with categories so packages/tiers can be built
// from them later. Category defs live in app_state.data.contentCategories.
// Client-facing access + buying come with logins (Phase 3) + payments.
// ─────────────────────────────────────────────────────────────────────

const STATE_ID = 'gmj_main'
// Module-level guard so React 18 StrictMode's double-effect can't double-seed.
let seedGuard = false

export default function ContentLibrary() {
  const [appData, setAppData] = useState({})
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [filterMode, setFilterMode] = useState('pillar') // 'pillar' | 'role'
  const [openPillars, setOpenPillars] = useState({}) // {pillarId: true} when expanded
  const [view, setView] = useState('grid') // 'grid' | 'list'
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'video' | 'guide'
  const [editing, setEditing] = useState(null) // item, {} for new, or null
  const [newCat, setNewCat] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      let d = st?.data || {}
      // One-time seed of placeholder content so the library is populated to
      // visualise. Real rows — editable/deletable. A marker stops it re-seeding.
      if (!d.contentSeeded && !seedGuard) {
        seedGuard = true
        const now = Date.now()
        const rows = SEED_ITEMS.map((s, i) => ({ type: s.type, title: s.title, description: s.description, url: s.url, file_path: null, pillar: s.pillar, roles: s.roles, categories: [], created_at: new Date(now + i).toISOString(), updated_at: new Date(now + i).toISOString() }))
        const { error } = await supabase.from('content_items').insert(rows)
        if (!error) { d = { ...d, contentSeeded: true }; await supabase.from('app_state').upsert({ id: STATE_ID, data: d, updated_at: new Date().toISOString() }) }
      }
      setAppData(d)
      setCats(Array.isArray(d.contentCategories) ? d.contentCategories : [])
      const { data: its } = await supabase.from('content_items').select('*').order('created_at', { ascending: false })
      if (Array.isArray(its)) setItems(its)
      setLoading(false)
    })()
  }, [])

  const persistCats = async (next) => {
    const data = { ...appData, contentCategories: next }
    setAppData(data)
    await supabase.from('app_state').upsert({ id: STATE_ID, data, updated_at: new Date().toISOString() })
  }
  const saveCats = async (next) => { setCats(next); await persistCats(next) }
  // Live-update a category color while the picker is open; persist on close (blur).
  const setCatColor = (id, color, persist) => { const next = cats.map((x) => (x.id === id ? { ...x, color } : x)); setCats(next); if (persist) persistCats(next) }
  const addCat = () => {
    const name = newCat.trim(); if (!name) return
    saveCats([...cats, { id: uid(), name, color: CAT_PALETTE[cats.length % CAT_PALETTE.length] }])
    setNewCat('')
  }
  const renameCat = (id) => { const c = cats.find((x) => x.id === id); const name = window.prompt('Rename category', c?.name); if (name && name.trim()) saveCats(cats.map((x) => (x.id === id ? { ...x, name: name.trim() } : x))) }
  const deleteCat = (id) => {
    if (!window.confirm('Delete this category? Items keep their other tags.')) return
    saveCats(cats.filter((x) => x.id !== id))
    // untag it from any items (local + db)
    items.forEach((it) => { if ((it.categories || []).includes(id)) supabase.from('content_items').update({ categories: (it.categories || []).filter((x) => x !== id) }).eq('id', it.id) })
    setItems((is) => is.map((it) => ({ ...it, categories: (it.categories || []).filter((x) => x !== id) })))
  }
  const catById = (id) => cats.find((c) => c.id === id)

  const upsertItem = async (row, file) => {
    let file_path = row.file_path || null
    if (file) {
      const path = 'g/' + Date.now().toString(36) + '_' + file.name.replace(/[^a-z0-9._-]/gi, '_')
      const { error } = await supabase.storage.from(GUIDES_BUCKET).upload(path, file)
      if (error) { alert('Upload failed: ' + error.message); return false }
      file_path = path
    }
    const payload = { type: row.type, title: row.title, description: row.description || null, url: row.url || null, file_path, pillar: row.pillar || null, roles: row.roles || [], categories: row.categories || [], updated_at: new Date().toISOString() }
    if (row.id) {
      await supabase.from('content_items').update(payload).eq('id', row.id)
      setItems((is) => is.map((it) => (it.id === row.id ? { ...it, ...payload } : it)))
    } else {
      const { data } = await supabase.from('content_items').insert(payload).select()
      if (data?.[0]) setItems((is) => [data[0], ...is])
    }
    return true
  }
  const deleteItem = async (it) => {
    if (!window.confirm('Delete "' + it.title + '"?')) return
    if (it.file_path) await supabase.storage.from(GUIDES_BUCKET).remove([it.file_path])
    await supabase.from('content_items').delete().eq('id', it.id)
    setItems((is) => is.filter((x) => x.id !== it.id))
  }
  const openItem = async (it) => {
    if (it.file_path) {
      const { data, error } = await supabase.storage.from(GUIDES_BUCKET).createSignedUrl(it.file_path, 3600)
      if (error) { alert('Could not open file: ' + error.message); return }
      window.open(data.signedUrl, '_blank', 'noopener')
    } else if (it.url) {
      window.open(it.url, '_blank', 'noopener')
    }
  }
  // Inline label edit from the label-manager view — patch one field & persist.
  const patchItem = async (it, patch) => {
    setItems((is) => is.map((x) => (x.id === it.id ? { ...x, ...patch } : x)))
    await supabase.from('content_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', it.id)
  }

  const typed = typeFilter === 'all' ? items : items.filter((it) => it.type === typeFilter)
  const shown = filter === 'all' ? typed : typed.filter((it) => filterMode === 'pillar' ? it.pillar === filter : (it.roles || []).includes(filter))
  const togglePillar = (id) => setOpenPillars((o) => ({ ...o, [id]: !o[id] }))
  const groupByPillar = filterMode === 'pillar' && filter === 'all'
  const pillarGroups = [...PILLARS, { id: '__none', name: 'No pillar', color: '#9a9a96' }]
    .map((p) => ({ p, list: typed.filter((it) => (p.id === '__none' ? !it.pillar : it.pillar === p.id)) }))
    .filter((g) => g.list.length)
  const allOpen = pillarGroups.length > 0 && pillarGroups.every((g) => openPillars[g.p.id])
  const setAllPillars = (open) => { const next = {}; if (open) pillarGroups.forEach((g) => { next[g.p.id] = true }); setOpenPillars(next) }

  const renderItem = (it) => (
    <div key={it.id} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: it.type === 'video' ? 'rgba(24,127,212,0.12)' : 'rgba(188,151,98,0.16)', color: it.type === 'video' ? '#185fa5' : '#8a6a3c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {it.type === 'video'
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 9l5 3-5 3V9z" /></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: TEXT }}>{it.title}</div>
        {it.description && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
          {(() => { const p = pillarById(it.pillar); return p ? <span style={{ fontSize: 10.5, color: '#fff', background: p.color, borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>{p.name}</span> : <span style={{ fontSize: 10.5, color: MUTED, fontStyle: 'italic' }}>no pillar</span> })()}
          {(it.roles || []).map((rid) => { const r = roleById(rid); return r ? <span key={rid} style={{ fontSize: 10.5, color: MUTED, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 20, padding: '1px 8px' }}>{r.name}</span> : null })}
          {(it.categories || []).map((cid) => { const c = catById(cid); return c ? <span key={cid} style={{ fontSize: 10.5, color: '#fff', background: c.color, borderRadius: 20, padding: '1px 8px' }}>{c.name}</span> : null })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => openItem(it)} style={{ ...BTNS, padding: '6px 12px', fontSize: 12 }}>Open ↗</button>
        <button onClick={() => setEditing(it)} style={{ ...BTNS, padding: '6px 12px', fontSize: 12 }}>Edit</button>
        <button onClick={() => deleteItem(it)} title="Delete" style={{ ...BTNS, padding: '6px 10px', fontSize: 12, color: '#A32D2D', borderColor: 'rgba(163,45,45,0.3)' }}>×</button>
      </div>
    </div>
  )

  // Thumbnail card for the grid view.
  const renderCard = (it) => {
    const p = pillarById(it.pillar)
    return (
      <div key={it.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div onClick={() => openItem(it)} title="Open" style={{ height: 116, background: p ? p.color : '#9a9a96', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {it.type === 'video'
            ? <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1c1c1a" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" /></svg></span>
            : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6" /></svg>}
        </div>
        <div style={{ padding: '11px 13px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT }}>{it.title}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
            {p && <span style={{ fontSize: 10.5, color: '#fff', background: p.color, borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>{p.name.split(' ')[0]}</span>}
            <span style={{ fontSize: 10.5, color: MUTED }}>{it.type === 'video' ? 'Video' : 'Guide'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 11 }}>
            <button onClick={() => openItem(it)} style={{ ...BTNS, padding: '5px 10px', fontSize: 11.5 }}>Open ↗</button>
            <button onClick={() => setEditing(it)} style={{ ...BTNS, padding: '5px 10px', fontSize: 11.5 }}>Edit</button>
            <button onClick={() => deleteItem(it)} title="Delete" style={{ ...BTNS, padding: '5px 9px', fontSize: 11.5, color: '#A32D2D', borderColor: 'rgba(163,45,45,0.3)', marginLeft: 'auto' }}>×</button>
          </div>
        </div>
      </div>
    )
  }
  const gridWrap = (list) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>{list.map(renderCard)}</div>

  // Label-manager row: thumbnail + name + description on the left; pillar / team
  // / package pickers on the right. Every change saves inline (patchItem).
  const renderManageRow = (it) => {
    const p = pillarById(it.pillar)
    return (
      <div key={it.id} style={{ ...CARD, display: 'flex', gap: 14, padding: '12px 14px', alignItems: 'flex-start' }}>
        <div onClick={() => openItem(it)} title="Open" style={{ width: 66, height: 50, borderRadius: 8, background: p ? p.color : '#9a9a96', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          {it.type === 'video'
            ? <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#1c1c1a" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" /></svg></span>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6" /></svg>}
        </div>
        <div style={{ width: 210, flexShrink: 0, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT }}>{it.title} <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>· {it.type === 'video' ? 'Video' : 'Guide'}</span></div>
          {it.description && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{it.description}</div>}
          <button onClick={() => setEditing(it)} style={{ background: 'none', border: 'none', color: NAVY, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0 0' }}>Edit details</button>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <LabelRow label="Pillar">
            <select value={it.pillar || ''} onChange={(e) => patchItem(it, { pillar: e.target.value || null })} style={SELECT}>
              <option value="">— none —</option>
              {PILLARS.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
            </select>
          </LabelRow>
          <LabelRow label="Team">
            <ChipAdder options={ROLES} selected={it.roles || []} nameOf={(id) => roleById(id)?.name} color="#0f6e56"
              onAdd={(id) => patchItem(it, { roles: [...(it.roles || []), id] })} onRemove={(id) => patchItem(it, { roles: (it.roles || []).filter((x) => x !== id) })} />
          </LabelRow>
          <LabelRow label="Packages">
            <ChipAdder options={cats} selected={it.categories || []} nameOf={(id) => catById(id)?.name} colorOf={(id) => catById(id)?.color}
              onAdd={(id) => patchItem(it, { categories: [...(it.categories || []), id] })} onRemove={(id) => patchItem(it, { categories: (it.categories || []).filter((x) => x !== id) })}
              empty="No packages yet — add them above." />
          </LabelRow>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <Header sub="Content Library" right={<><button onClick={() => setEditing({ type: 'video' })} style={{ ...BTNS, height: 32, padding: '0 13px', fontSize: 12.5 }}>+ Video</button><button onClick={() => setEditing({ type: 'guide' })} style={{ ...BTNP, height: 32, padding: '0 14px', fontSize: 12.5 }}>+ Guide</button></>} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Categories */}
        <div style={{ ...CARD, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Categories</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Tag each video or guide with one or more categories. Later you’ll bundle categories into packages and tiers.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {cats.map((c) => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '0.5px solid rgba(0,0,0,0.14)', borderRadius: 999, padding: '5px 6px 5px 7px', fontSize: 12.5 }}>
                <input type="color" value={c.color} title="Change color" onChange={(e) => setCatColor(c.id, e.target.value, false)} onBlur={(e) => setCatColor(c.id, e.target.value, true)} style={{ width: 16, height: 16, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }} />
                <span onClick={() => renameCat(c.id)} title="Rename" style={{ cursor: 'pointer', color: TEXT }}>{c.name}</span>
                <button onClick={() => deleteCat(c.id)} title="Delete category" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
              </span>
            ))}
            {cats.length === 0 && <span style={{ fontSize: 12.5, color: MUTED, fontStyle: 'italic' }}>No categories yet —</span>}
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="New category…" style={{ ...INP, width: 150, height: 32, padding: '0 10px' }} />
              <button onClick={addCat} style={{ ...BTNS, height: 32, padding: '0 12px' }}>Add</button>
            </span>
          </div>
        </div>

        {/* Toolbar — display options grouped and labeled, then the filter pills */}
        {items.length > 0 && (
          <div style={{ ...CARD, padding: '12px 15px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={ctlGroup}>
                <span style={ctlLabel}>View</span>
                <div style={track}>
                  <button onClick={() => setView('grid')} title="Grid view" style={segIcon(view === 'grid')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.6" /><rect x="13" y="3" width="8" height="8" rx="1.6" /><rect x="3" y="13" width="8" height="8" rx="1.6" /><rect x="13" y="13" width="8" height="8" rx="1.6" /></svg>
                  </button>
                  <button onClick={() => setView('list')} title="List view" style={segIcon(view === 'list')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                  </button>
                  <button onClick={() => setView('manage')} title="Label manager — set pillar, team & packages inline" style={segIcon(view === 'manage')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><circle cx="15" cy="7" r="2.4" fill="currentColor" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="17" r="2.4" fill="currentColor" /></svg>
                  </button>
                </div>
              </div>
              <div style={ctlGroup}>
                <span style={ctlLabel}>Show</span>
                <div style={track}>
                  {[['all', 'All'], ['video', 'Videos'], ['guide', 'Guides']].map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} style={seg(typeFilter === v)}>{l}</button>)}
                </div>
              </div>
              <div style={ctlGroup}>
                <span style={ctlLabel}>Group by</span>
                <div style={track}>
                  {[['pillar', 'Pillar'], ['role', 'Role']].map(([v, l]) => (
                    <button key={v} onClick={() => { setFilterMode(v); setFilter('all') }} style={seg(filterMode === v)}>{l}</button>
                  ))}
                </div>
              </div>
              {groupByPillar && view !== 'manage' && <button onClick={() => setAllPillars(!allOpen)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>{allOpen ? 'Collapse all' : 'Expand all'}</button>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
              <button onClick={() => setFilter('all')} style={fpill(filter === 'all')}>All ({typed.length})</button>
              {(filterMode === 'pillar' ? PILLARS : ROLES).map((o) => { const n = typed.filter((it) => filterMode === 'pillar' ? it.pillar === o.id : (it.roles || []).includes(o.id)).length; return <button key={o.id} onClick={() => setFilter(o.id)} style={fpill(filter === o.id)}>{o.name} ({n})</button> })}
            </div>
          </div>
        )}

        {/* Items — Grid (thumbnails) or List; grouped by pillar when viewing all pillars */}
        {loading ? <div style={{ textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' }}>Loading…</div>
          : items.length === 0 ? <div style={{ ...CARD, textAlign: 'center', padding: 40, color: MUTED }}>No content yet — add your first video or guide.</div>
            : view === 'manage' ? (
              shown.length === 0 ? <div style={{ ...CARD, textAlign: 'center', padding: 40, color: MUTED }}>Nothing here yet.</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 2 }}>Set the <b style={{ color: TEXT }}>pillar</b>, <b style={{ color: TEXT }}>team</b> and <b style={{ color: TEXT }}>packages</b> for each item — changes save automatically.</div>
                    {shown.map(renderManageRow)}
                  </div>
            ) : groupByPillar ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pillarGroups.map(({ p, list }) => { const open = !!openPillars[p.id]; return (
                  <div key={p.id}>
                    <div onClick={() => togglePillar(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '11px 15px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10 }}>
                      <span style={{ color: MUTED, fontSize: 12, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                      <span style={{ width: 11, height: 11, borderRadius: 4, background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{list.length} item{list.length !== 1 ? 's' : ''}</span>
                    </div>
                    {open && <div style={{ marginTop: 12 }}>{view === 'grid' ? gridWrap(list) : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 12 }}>{list.map(renderItem)}</div>}</div>}
                  </div>
                ) })}
              </div>
            ) : shown.length === 0 ? <div style={{ ...CARD, textAlign: 'center', padding: 40, color: MUTED }}>Nothing here yet.</div>
              : view === 'grid' ? gridWrap(shown) : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{shown.map(renderItem)}</div>}
      </div>

      {editing && <ItemModal item={editing} cats={cats} onClose={() => setEditing(null)} onSave={upsertItem} />}
    </div>
  )
}

function ItemModal({ item, cats, onClose, onSave }) {
  const [f, setF] = useState({ type: item.type || 'video', title: item.title || '', description: item.description || '', url: item.url || '', pillar: item.pillar || '', roles: item.roles || [], categories: item.categories || [], id: item.id, file_path: item.file_path || null })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const toggleCat = (id) => set('categories', f.categories.includes(id) ? f.categories.filter((x) => x !== id) : [...f.categories, id])
  const toggleRole = (id) => set('roles', f.roles.includes(id) ? f.roles.filter((x) => x !== id) : [...f.roles, id])
  const chip = (on, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, border: '0.5px solid ' + (on ? (color || NAVY) : 'rgba(0,0,0,0.15)'), background: on ? (color || NAVY) : '#fff', color: on ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' })
  const submit = async () => {
    if (!f.title.trim()) return alert('Give it a title.')
    if (f.type === 'video' && !f.url.trim()) return alert('Paste the video link.')
    if (f.type === 'guide' && !file && !f.file_path && !f.url.trim()) return alert('Upload a file or paste a link.')
    setBusy(true)
    const ok = await onSave({ ...f, title: f.title.trim(), url: f.url.trim() }, file)
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '100%', padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 16 }}>{f.id ? 'Edit' : 'Add'} {f.type}</div>
        <div style={{ display: 'inline-flex', gap: 3, background: '#eeece8', borderRadius: 999, padding: 3, marginBottom: 14 }}>
          {[['video', 'Video'], ['guide', 'Guide']].map(([v, l]) => (
            <button key={v} onClick={() => set('type', v)} style={{ padding: '5px 16px', borderRadius: 999, border: 'none', background: f.type === v ? '#fff' : 'transparent', color: f.type === v ? NAVY : MUTED, fontSize: 12.5, fontWeight: f.type === v ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: f.type === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{l}</button>
          ))}
        </div>
        <Field label="Title"><input value={f.title} onChange={(e) => set('title', e.target.value)} style={INP} autoFocus /></Field>
        <Field label="Description (optional)"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} style={{ ...INP, minHeight: 52, resize: 'vertical' }} /></Field>
        {f.type === 'video'
          ? <Field label="Video link (Vimeo / YouTube)"><input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://vimeo.com/…" style={INP} /></Field>
          : <>
            <Field label={f.file_path ? 'Replace file (optional)' : 'Upload file (PDF, etc.)'}><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} /></Field>
            {f.file_path && !file && <div style={{ fontSize: 11.5, color: MUTED, marginTop: -8, marginBottom: 12 }}>Current file kept unless you choose a new one.</div>}
            <Field label="…or a link instead (optional)"><input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://drive.google.com/…" style={INP} /></Field>
          </>}
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: '4px 0 7px' }}>Pillar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {PILLARS.map((p) => { const on = f.pillar === p.id; return <button key={p.id} onClick={() => set('pillar', on ? '' : p.id)} style={chip(on, p.color)}>{on && <span style={{ fontSize: 11 }}>✓</span>}{p.name}</button> })}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: '4px 0 3px' }}>Intended for</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 7 }}>Which team roles this training is for (the owner always sees everything).</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {ROLES.map((r) => { const on = f.roles.includes(r.id); return <button key={r.id} onClick={() => toggleRole(r.id)} style={chip(on, '#0f6e56')}>{on && <span style={{ fontSize: 11 }}>✓</span>}{r.name}</button> })}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: '4px 0 7px' }}>Access packages (optional)</div>
        {cats.length === 0 ? <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginBottom: 8 }}>Add a category first to tag this.</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
            {cats.map((c) => { const on = f.categories.includes(c.id); return (
              <button key={c.id} onClick={() => toggleCat(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, border: '0.5px solid ' + (on ? c.color : 'rgba(0,0,0,0.15)'), background: on ? c.color : '#fff', color: on ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {on && <span style={{ fontSize: 11 }}>✓</span>}{c.name}
              </button>
            ) })}
          </div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={BTNS}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...BTNP, opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// One labeled control line in the label-manager row.
function LabelRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ width: 62, flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: MUTED, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// Selected labels as removable chips + a dropdown to add more (many-to-many).
function ChipAdder({ options, selected, nameOf, colorOf, color, onAdd, onRemove, empty }) {
  const avail = options.filter((o) => !selected.includes(o.id))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 26 }}>
      {selected.map((id) => {
        const bg = colorOf ? (colorOf(id) || '#777') : (color || '#777')
        return (
          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#fff', background: bg, borderRadius: 20, padding: '2px 4px 2px 9px' }}>
            {nameOf(id) || '—'}
            <button onClick={() => onRemove(id)} title="Remove" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        )
      })}
      {avail.length > 0
        ? <select value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value) }} style={MINISELECT}><option value="">＋ add</option>{avail.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        : selected.length === 0 && <span style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>{empty || 'none'}</span>}
    </div>
  )
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>{children}</div>
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }
const fpill = (on) => ({ padding: '5px 12px', borderRadius: 999, border: '0.5px solid ' + (on ? NAVY : 'rgba(0,0,0,0.15)'), background: on ? NAVY : '#fff', color: on ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const seg = (on) => ({ padding: '5px 13px', borderRadius: 999, border: 'none', background: on ? '#fff' : 'transparent', color: on ? NAVY : MUTED, fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' })
const segIcon = (on) => ({ ...seg(on), padding: '5px 9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })
const track = { display: 'inline-flex', gap: 3, background: '#eeece8', borderRadius: 999, padding: 3 }
const ctlGroup = { display: 'inline-flex', alignItems: 'center', gap: 8 }
const ctlLabel = { fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED }
const SELECT = { width: '100%', maxWidth: 220, height: 30, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.18)', background: '#fff', color: TEXT, fontSize: 12.5, fontFamily: 'inherit', padding: '0 8px', cursor: 'pointer' }
const MINISELECT = { height: 24, borderRadius: 20, border: '0.5px dashed rgba(0,0,0,0.3)', background: '#fff', color: MUTED, fontSize: 11, fontFamily: 'inherit', padding: '0 6px', cursor: 'pointer' }
