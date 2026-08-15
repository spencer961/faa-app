import { useState, useEffect } from 'react'
import Header from '../components/Header.jsx'
import { NAVY, GOLD, BG, TEXT, MUTED, CARD, INP, BTNP, BTNS } from '../lib/theme.js'
import { supabase } from '../lib/supabase.js'
import { uid, CAT_PALETTE, GUIDES_BUCKET } from '../lib/content.js'

// ─────────────────────────────────────────────────────────────────────
// Content Library (admin) — where videos + guides live. Videos are external
// links (Vimeo/YouTube); guides are files uploaded to the private `guides`
// bucket. Each item is tagged with categories so packages/tiers can be built
// from them later. Category defs live in app_state.data.contentCategories.
// Client-facing access + buying come with logins (Phase 3) + payments.
// ─────────────────────────────────────────────────────────────────────

const STATE_ID = 'gmj_main'

export default function ContentLibrary() {
  const [appData, setAppData] = useState({})
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null) // item, {} for new, or null
  const [newCat, setNewCat] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: st } = await supabase.from('app_state').select('data').eq('id', STATE_ID).maybeSingle()
      const d = st?.data || {}
      setAppData(d)
      setCats(Array.isArray(d.contentCategories) ? d.contentCategories : [])
      const { data: its } = await supabase.from('content_items').select('*').order('created_at', { ascending: false })
      if (Array.isArray(its)) setItems(its)
      setLoading(false)
    })()
  }, [])

  const saveCats = async (next) => {
    setCats(next)
    const data = { ...appData, contentCategories: next }
    setAppData(data)
    await supabase.from('app_state').upsert({ id: STATE_ID, data, updated_at: new Date().toISOString() })
  }
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
    const payload = { type: row.type, title: row.title, description: row.description || null, url: row.url || null, file_path, categories: row.categories || [], updated_at: new Date().toISOString() }
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

  const shown = filter === 'all' ? items : items.filter((it) => (it.categories || []).includes(filter))

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
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '0.5px solid rgba(0,0,0,0.14)', borderRadius: 999, padding: '5px 6px 5px 11px', fontSize: 12.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
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

        {/* Filter */}
        {cats.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilter('all')} style={fpill(filter === 'all')}>All ({items.length})</button>
            {cats.map((c) => { const n = items.filter((it) => (it.categories || []).includes(c.id)).length; return <button key={c.id} onClick={() => setFilter(c.id)} style={fpill(filter === c.id)}>{c.name} ({n})</button> })}
          </div>
        )}

        {/* Items */}
        {loading ? <div style={{ textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' }}>Loading…</div>
          : shown.length === 0 ? <div style={{ ...CARD, textAlign: 'center', padding: 40, color: MUTED }}>{items.length ? 'Nothing in this category yet.' : 'No content yet — add your first video or guide.'}</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shown.map((it) => (
                  <div key={it.id} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: it.type === 'video' ? 'rgba(24,127,212,0.12)' : 'rgba(188,151,98,0.16)', color: it.type === 'video' ? '#185fa5' : '#8a6a3c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {it.type === 'video'
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 9l5 3-5 3V9z" /></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: TEXT }}>{it.title}</div>
                      {it.description && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                        {(it.categories || []).map((cid) => { const c = catById(cid); return c ? <span key={cid} style={{ fontSize: 10.5, color: '#fff', background: c.color, borderRadius: 20, padding: '1px 8px' }}>{c.name}</span> : null })}
                        {(!it.categories || it.categories.length === 0) && <span style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>uncategorized</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openItem(it)} style={{ ...BTNS, padding: '6px 12px', fontSize: 12 }}>Open ↗</button>
                      <button onClick={() => setEditing(it)} style={{ ...BTNS, padding: '6px 12px', fontSize: 12 }}>Edit</button>
                      <button onClick={() => deleteItem(it)} title="Delete" style={{ ...BTNS, padding: '6px 10px', fontSize: 12, color: '#A32D2D', borderColor: 'rgba(163,45,45,0.3)' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      {editing && <ItemModal item={editing} cats={cats} onClose={() => setEditing(null)} onSave={upsertItem} />}
    </div>
  )
}

function ItemModal({ item, cats, onClose, onSave }) {
  const [f, setF] = useState({ type: item.type || 'video', title: item.title || '', description: item.description || '', url: item.url || '', categories: item.categories || [], id: item.id, file_path: item.file_path || null })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const toggleCat = (id) => set('categories', f.categories.includes(id) ? f.categories.filter((x) => x !== id) : [...f.categories, id])
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
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: '4px 0 7px' }}>Categories</div>
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

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>{children}</div>
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }
const fpill = (on) => ({ padding: '5px 12px', borderRadius: 999, border: '0.5px solid ' + (on ? NAVY : 'rgba(0,0,0,0.15)'), background: on ? NAVY : '#fff', color: on ? '#fff' : MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
