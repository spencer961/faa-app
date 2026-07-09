import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { supabase } from '../lib/supabase.js'
import { getClientMode } from '../lib/clientMode.js'

// Task manager — migrated from todo.html. Personal + per-client tasks,
// grouped by status / priority / all. Reads clients & tasks from Supabase.
// (The old "DB Health" debug panel and the localStorage staff hack were
// left out — staff now reads straight from the clients table.)

const SL = { not_started: 'Not Started', in_progress: 'In Progress', waiting: 'Waiting', done: 'Done' }
const SC = { not_started: '#888786', in_progress: '#1a7fd4', waiting: '#e07b0a', done: '#18a866' }
const PL = { high: 'High', medium: 'Medium', low: 'Low' }
const PC = { high: '#d42020', medium: '#e07b0a', low: '#18a866' }
const ACCENTS = ['#1a7fd4', '#18a866', '#D4944A', '#f0359a', '#9B7FE8', '#4a9e12', '#ff6b00', '#d42020', '#6b6966']
const STATUSES = ['not_started', 'in_progress', 'waiting', 'done']
const PRIORITIES = ['high', 'medium', 'low']

function getStaff(client) {
  // Staff may live nested at info.info.staff (legacy) or flat at info.staff,
  // and is often a JSON string.
  let s = client?.info?.info?.staff ?? client?.info?.staff
  if (!s) return []
  try {
    if (typeof s === 'string') s = JSON.parse(s)
    return Array.isArray(s) ? s.map((x) => (typeof x === 'object' ? x.name : x)).filter(Boolean) : []
  } catch {
    return []
  }
}

const BLANK = { title: '', status: 'not_started', priority: 'medium', due_date: '', assignee: '', client_id: null, notes: '' }

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const cm = (searchParams.get('client') ? parseInt(searchParams.get('client')) : null) || getClientMode()
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [selId, setSelId] = useState(cm || 'personal')
  const [view, setView] = useState('status')
  const [editing, setEditing] = useState(null) // task object, {} for new, or null when closed
  const [toast, setToast] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: cs } = await supabase.from('clients').select('id,name,info').order('id')
      if (Array.isArray(cs)) setClients(cs)
      const { data: ts } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      if (Array.isArray(ts)) setTasks(ts)
    })()
  }, [])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const filtered = tasks.filter((t) => (selId === 'personal' ? !t.client_id : t.client_id === selId))
  const accent = (c, i) => c?.info?.accentColor || ACCENTS[i % ACCENTS.length]

  async function saveTask(form) {
    const body = {
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assignee: form.assignee.trim() || null,
      client_id: form.client_id ? parseInt(form.client_id) : null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (!body.title) return
    if (form.id) {
      await supabase.from('tasks').update(body).eq('id', form.id)
      setTasks((ts) => ts.map((t) => (t.id === form.id ? { ...t, ...body } : t)))
      showToast('Task updated ✓')
    } else {
      const { data } = await supabase.from('tasks').insert(body).select()
      if (data?.[0]) setTasks((ts) => [data[0], ...ts])
      showToast('Task added ✓')
    }
    setEditing(null)
  }

  async function toggle(id) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const ns = t.status === 'done' ? 'not_started' : 'done'
    await supabase.from('tasks').update({ status: ns, updated_at: new Date().toISOString() }).eq('id', id)
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, status: ns } : x)))
  }

  async function delTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((ts) => ts.filter((t) => t.id !== id))
    setEditing(null)
    showToast('Deleted')
  }

  const openCount = (cid) => tasks.filter((t) => (cid === 'personal' ? !t.client_id : t.client_id === cid) && t.status !== 'done').length
  const title = selId === 'personal' ? 'My Tasks' : clients.find((c) => c.id === selId)?.name || 'Tasks'

  function groups() {
    if (view === 'status') return STATUSES.map((s) => ({ key: s, label: SL[s], color: SC[s], items: filtered.filter((t) => t.status === s) }))
    if (view === 'priority') return PRIORITIES.map((p) => ({ key: p, label: PL[p], color: PC[p], items: filtered.filter((t) => (t.priority || 'medium') === p) }))
    const order = { high: 0, medium: 1, low: 2 }
    return [{ key: 'all', label: null, color: null, items: [...filtered].sort((a, b) => order[a.priority || 'medium'] - order[b.priority || 'medium']) }]
  }

  return (
    <div className="tk">
      <style>{CSS}</style>
      <Header sub="· To-Do Lists" back="/" />
      <div className="layout">
        <div className="sidebar">
          {!cm && (
            <>
              <div className="sb-section">Personal</div>
              <div className={'sb-item' + (selId === 'personal' ? ' active' : '')} onClick={() => setSelId('personal')}>
                <span className="sb-dot" style={{ background: '#bc9762' }} />
                <span className="sb-name">My Tasks</span>
                {openCount('personal') > 0 && <span className="sb-badge">{openCount('personal')}</span>}
              </div>
            </>
          )}
          <div className="sb-section" style={{ marginTop: 4 }}>Clients</div>
          {(cm ? clients.filter((c) => c.id === cm) : clients).map((c, i) => (
            <div key={c.id} className={'sb-item' + (selId === c.id ? ' active' : '')} onClick={() => setSelId(c.id)}>
              <span className="sb-dot" style={{ background: accent(c, i) }} />
              <span className="sb-name">{c.name}</span>
              {openCount(c.id) > 0 && <span className="sb-badge">{openCount(c.id)}</span>}
            </div>
          ))}
        </div>
        <div className="main">
          <div className="main-head">
            <div className="main-title">{title}</div>
            <div className="seg">
              {['status', 'priority', 'all'].map((v) => (
                <button key={v} className={'seg-btn' + (view === v ? ' active' : '')} onClick={() => setView(v)}>
                  {v === 'status' ? 'By Status' : v === 'priority' ? 'By Priority' : 'All Tasks'}
                </button>
              ))}
            </div>
            <button className="add-btn" onClick={() => setEditing({ ...BLANK, client_id: selId !== 'personal' ? selId : null })}>+ Add task</button>
          </div>
          <div className="board">
            {!filtered.length && <div className="empty">No tasks yet — click "+ Add task" to get started.</div>}
            {groups().map((g) => g.items.length === 0 ? null : (
              <div key={g.key}>
                {g.label && (
                  <div className="group-head">
                    <span className="group-dot" style={{ background: g.color }} />
                    <span className="group-label" style={{ color: g.color }}>{g.label}</span>
                    <span className="group-count">{g.items.length}</span>
                  </div>
                )}
                <div className="task-list">
                  {g.items.map((t) => <TaskCard key={t.id} t={t} onToggle={toggle} onOpen={() => setEditing(t)} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {editing && (
        <TaskModal
          task={editing}
          clients={clients}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={delTask}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  )
}

function TaskCard({ t, onToggle, onOpen }) {
  const done = t.status === 'done'
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const due = t.due_date ? new Date(t.due_date + 'T00:00:00') : null
  const ov = due && due < now && !done
  const ds = due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className={'task-card' + (done ? ' done' : '')} onClick={onOpen}>
      <div className="task-row">
        <div className={'tcb' + (done ? ' checked' : '')} onClick={(e) => { e.stopPropagation(); onToggle(t.id) }} />
        <span className={'ttitle' + (done ? ' done' : '')}>{t.title}</span>
      </div>
      <div className="task-meta">
        <span className={'pb p-' + (t.priority || 'medium')}>{PL[t.priority || 'medium']}</span>
        <span className={'sb2 s-' + (t.status || 'not_started')}>{SL[t.status || 'not_started']}</span>
        {ds && <span className={'due' + (ov ? ' ov' : '')}>📅 {ds}{ov ? ' · Overdue' : ''}</span>}
        {t.assignee && <span className="asgn">👤 {t.assignee}</span>}
      </div>
      {t.notes && <div className="tnotes">{t.notes}</div>}
    </div>
  )
}

function TaskModal({ task, clients, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...BLANK, ...task, due_date: task.due_date || '', assignee: task.assignee || '', notes: task.notes || '' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const staff = form.client_id ? getStaff(clients.find((c) => c.id === parseInt(form.client_id))) : []
  const staffOpts = ['Spencer', ...staff.filter((s) => s !== 'Spencer')]

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{task.id ? 'Edit task' : 'New task'}</h3>
        <div className="fg"><div className="fl">Task title *</div>
          <input className="fi" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs to be done?" autoFocus />
        </div>
        <div className="frow">
          <div className="fg"><div className="fl">Status</div>
            <select className="fi" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{SL[s]}</option>)}
            </select>
          </div>
          <div className="fg"><div className="fl">Priority</div>
            <select className="fi" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PL[p]}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <div className="fg"><div className="fl">Due date</div>
            <input className="fi" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </div>
          <div className="fg"><div className="fl">Assignee</div>
            <input className="fi" list="staff-list" value={form.assignee} onChange={(e) => set('assignee', e.target.value)} placeholder="Type or pick…" autoComplete="off" />
            <datalist id="staff-list">{staffOpts.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </div>
        <div className="fg"><div className="fl">Client</div>
          <select className="fi" value={form.client_id || ''} onChange={(e) => set('client_id', e.target.value || null)}>
            <option value="">— My Tasks (personal) —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Leave blank for personal tasks</div>
        </div>
        <div className="fg"><div className="fl">Notes</div>
          <textarea className="fi" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional context…" />
        </div>
        <div className="ma">
          {task.id && <button className="md" onClick={() => onDelete(task.id)}>Delete</button>}
          <button className="mc" onClick={onClose}>Cancel</button>
          <button className="ms" onClick={() => onSave(form)}>Save task</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tk{--navy:#0b1d5e;--gold:#bc9762;--bg:#f5f5f4;--bg2:#fff;--bg3:#efefed;--border:rgba(0,0,0,0.08);--border2:rgba(0,0,0,0.13);--text:#1a1a1a;--text2:#666462;--text3:#999896;--radius:8px;--s-dn:#18a866;height:100vh;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);}
.tk .layout{display:flex;flex:1;overflow:hidden;}
.tk .sidebar{width:220px;background:var(--bg2);border-right:0.5px solid var(--border2);overflow-y:auto;flex-shrink:0;}
.tk .sb-section{padding:10px 14px 4px;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;}
.tk .sb-item{display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;transition:background .12s;}
.tk .sb-item:hover{background:rgba(11,29,94,0.04);}
.tk .sb-item.active{background:rgba(11,29,94,0.08);}
.tk .sb-item.active .sb-name{color:var(--navy);font-weight:500;}
.tk .sb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.tk .sb-name{font-size:12px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tk .sb-badge{font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(11,29,94,0.1);color:var(--navy);font-weight:600;}
.tk .main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.tk .main-head{padding:12px 20px;border-bottom:0.5px solid var(--border);background:var(--bg2);display:flex;align-items:center;gap:10px;flex-shrink:0;}
.tk .main-title{font-size:15px;font-weight:600;flex:1;}
.tk .seg{display:flex;background:var(--bg3);border-radius:7px;padding:2px;}
.tk .seg-btn{height:26px;padding:0 10px;border:none;border-radius:5px;background:transparent;color:var(--text3);font-size:11px;cursor:pointer;transition:all .12s;white-space:nowrap;}
.tk .seg-btn.active{background:#fff;color:var(--navy);font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
.tk .add-btn{height:30px;padding:0 14px;border:none;border-radius:var(--radius);background:var(--navy);color:var(--gold);font-size:12px;font-weight:500;cursor:pointer;}
.tk .add-btn:hover{opacity:.85;}
.tk .board{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:16px;}
.tk .group-head{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
.tk .group-dot{width:8px;height:8px;border-radius:50%;}
.tk .group-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.tk .group-count{font-size:11px;color:var(--text3);}
.tk .task-list{display:flex;flex-direction:column;gap:5px;}
.tk .task-card{background:var(--bg2);border:0.5px solid var(--border2);border-radius:var(--radius);padding:10px 12px;cursor:pointer;transition:transform .12s,box-shadow .12s;}
.tk .task-card:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,0.07);}
.tk .task-card.done{opacity:.5;}
.tk .task-row{display:flex;align-items:flex-start;gap:8px;}
.tk .tcb{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border2);flex-shrink:0;margin-top:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;}
.tk .tcb.checked{background:var(--s-dn);border-color:var(--s-dn);}
.tk .tcb.checked::after{content:"✓";color:#fff;font-size:9px;font-weight:700;}
.tk .ttitle{font-size:13px;flex:1;line-height:1.4;}
.tk .ttitle.done{text-decoration:line-through;color:var(--text3);}
.tk .task-meta{display:flex;align-items:center;gap:6px;margin-top:5px;margin-left:24px;flex-wrap:wrap;}
.tk .pb{font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;}
.tk .p-high{background:#fdecea;color:#d42020;}
.tk .p-medium{background:#fef3e6;color:#e07b0a;}
.tk .p-low{background:#e1f5ee;color:#18a866;}
.tk .sb2{font-size:10px;padding:1px 6px;border-radius:4px;font-weight:500;}
.tk .s-not_started{background:#f1f0ef;color:#888786;}
.tk .s-in_progress{background:#e6f1fb;color:#1a7fd4;}
.tk .s-waiting{background:#fef3e6;color:#e07b0a;}
.tk .s-done{background:#e1f5ee;color:#18a866;}
.tk .due{font-size:10px;color:var(--text3);}
.tk .due.ov{color:#d42020;font-weight:500;}
.tk .asgn{font-size:10px;color:var(--text3);}
.tk .tnotes{font-size:11px;color:var(--text3);margin-top:4px;margin-left:24px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px;}
.tk .empty{text-align:center;padding:40px;color:var(--text3);font-size:13px;font-style:italic;}
.tk .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;}
.tk .modal{background:#fff;border-radius:14px;padding:24px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
.tk .modal h3{font-size:15px;font-weight:600;margin-bottom:16px;color:var(--navy);}
.tk .fg{margin-bottom:12px;}
.tk .fl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:5px;}
.tk .fi{width:100%;height:34px;padding:0 10px;border:0.5px solid var(--border2);border-radius:var(--radius);font-size:13px;color:var(--text);background:var(--bg);}
.tk .fi:focus{outline:none;border-color:var(--navy);}
.tk textarea.fi{height:72px;padding:8px 10px;resize:vertical;}
.tk select.fi{cursor:pointer;}
.tk .frow{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.tk .ma{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:0.5px solid var(--border);padding-top:14px;}
.tk .mc{height:34px;padding:0 16px;border:0.5px solid var(--border2);border-radius:var(--radius);background:transparent;color:var(--text2);font-size:13px;cursor:pointer;}
.tk .ms{height:34px;padding:0 18px;border:none;border-radius:var(--radius);background:var(--navy);color:var(--gold);font-size:13px;font-weight:500;cursor:pointer;}
.tk .md{height:34px;padding:0 14px;border:0.5px solid rgba(212,32,32,0.3);border-radius:var(--radius);background:transparent;color:#d42020;font-size:13px;cursor:pointer;margin-right:auto;}
.tk .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;z-index:99999;opacity:0;transition:opacity .2s;pointer-events:none;}
.tk .toast.show{opacity:1;}
`
