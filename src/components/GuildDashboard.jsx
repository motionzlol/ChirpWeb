import { useEffect, useMemo, useState } from 'react'

export default function GuildDashboard({ guildId }) {
  const [state, setState] = useState({ loading: true })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('infractions')
  const [editing, setEditing] = useState(null)
  const [editReason, setEditReason] = useState('')

  useEffect(() => {
    let mounted = true
    const url = `/.netlify/functions/dashboard-guild?guild_id=${encodeURIComponent(guildId)}`
    fetch(url, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = '/'; return null }
        if (r.status === 403) { window.location.href = '/dashboard'; return null }
        const json = await r.json().catch(() => null)
        return json
      })
      .then((json) => { if (mounted && json) setState({ loading: false, data: json }) })
      .catch(() => { if (mounted) setState({ loading: false, error: 'Failed to load server' }) })
    return () => { mounted = false }
  }, [guildId])

  const g = state?.data?.guild

  const [ins, setIns] = useState(null)
  const [loadingIns, setLoadingIns] = useState(true)
  useEffect(() => {
    if (!g) return
    let mounted = true
    const KEY = `chirp.guildInsights.v1.${g.id}`
    const TTL_MS = 20_000
    const channelName = `chirp.guild.${g.id}`
    let bc = null
    try { bc = new BroadcastChannel(channelName) } catch {}

    const apply = (json, ts = Date.now()) => {
      if (!mounted) return
      setIns(json)
      setLoadingIns(false)
      try { localStorage.setItem(KEY, JSON.stringify({ ts, data: json })) } catch {}
      try { bc && bc.postMessage({ kind: 'insights', ts, data: json }) } catch {}
    }

    try {
      const cached = localStorage.getItem(KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.data) {
          setIns(parsed.data)
          setLoadingIns(false)
        }
      }
    } catch {}

    const load = () => {
      fetch(`/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(g.id)}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(json => apply(json))
        .catch(() => { if (mounted) setLoadingIns(false) })
    }

    let needsFetch = true
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (cached && cached.ts && Date.now() - cached.ts < TTL_MS) needsFetch = false
    } catch {}
    if (needsFetch) { setLoadingIns(true); load() }

    const iv = setInterval(load, TTL_MS)
    const onMsg = (ev) => {
      const m = ev && ev.data
      if (m && m.kind === 'insights' && m.data) {
        apply(m.data, m.ts || Date.now())
      }
    }
    try { bc && (bc.onmessage = onMsg) } catch {}

    return () => { mounted = false; clearInterval(iv); try { bc && (bc.onmessage = null); bc && bc.close && bc.close() } catch {} }
  }, [g?.id])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!g) return
    setLoadingIns(true)
    fetch(`/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(g.id)}&kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { setIns(json); setLoadingIns(false) })
      .catch(() => setLoadingIns(false))
  }

  return (
    <section className="features" style={{ paddingTop: 24 }}>
      <div className="container">
        <h2 style={{ margin: '0 0 12px' }}>Dashboard · Server</h2>
        {!state.loading && !g && <p className="muted">Redirecting…</p>}
        {g && (
          <>
            <div className="glass" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {g.icon ? (
                  <img src={g.icon} alt="Guild icon" width="40" height="40" style={{ borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(g.name || '?').slice(0,1).toUpperCase()}</div>
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>ID: {g.id}</div>
                </div>
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="glass" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Overview</h3>
                {loadingIns ? (
                  <p className="muted">Loading…</p>
                ) : (
                  <div className="stats__row">
                    <div className="stat"><div className="stat__num">{ins?.stats?.infractions_total ?? '—'}</div><div className="stat__label">Infractions</div></div>
                    <div className="stat"><div className="stat__num">{ins?.stats?.promotions_total ?? '—'}</div><div className="stat__label">Promotions</div></div>
                  </div>
                )}
                {!loadingIns && ins?.infractions_series?.series?.length ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Infractions · Last 30 days</div>
                    <BarMiniChart data={ins.infractions_series.series} />
                  </div>
                ) : null}
              </div>
              <div className="glass" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Search</h3>
                <form onSubmit={handleSearch} className="search__row">
                  <SelectFancy value={kind} onChange={setKind} options={[
                    { value: 'infractions', label: 'Infractions' },
                    { value: 'promotions', label: 'Promotions' },
                  ]} />
                  <input className="input input--ghost" placeholder={`${kind.slice(0,-1)} ID`} value={q} onChange={e => setQ(e.target.value)} />
                  <button className="btn btn--primary" type="submit">Search</button>
                </form>
                {ins?.search?.result?.items && ins.search.result.items.length > 0 ? (
                  <ul className="list">
                          <div className="list__sub">User: <span className="tip" title={`@${it.target_username}`}>{it.target || it.target_id || 'unknown'}</span> · By: <span className="tip" title={`@${it.by_username}`}>{it.by || 'unknown'}</span> · Reason: {it.reason || '—'}</div>
                        </div>
                        <TsMeta ts={it.created_at} />
                      </li>
                    ))}
                  </ul>
                ) : ins?.search && (
                  <p className="muted" style={{ marginTop: 12 }}>No results.</p>
                )}
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="glass" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Recent Infractions</h3>
                {ins?.recent_infractions?.items?.length ? (
                  <ul className="list">
                    {ins.recent_infractions.items.map((it) => (
                      <li key={it.id} className="list__item">
                        <div className="list__main">
                          <div className="list__title">ID: {it.id}</div>
                          <div className="list__sub">User: <span className="tip" title={`@${it.target_username}`}>{it.target || it.target_id || 'unknown'}</span> · By: <span className="tip" title={`@${it.by_username}`}>{it.by || 'unknown'}</span> · Reason: {it.reason || '—'}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">None.</p>
                )}
              </div>
              <div className="glass" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Recent Promotions</h3>
                {ins?.recent_promotions?.items?.length ? (
                  <ul className="list">
                    {ins.recent_promotions.items.map((it) => (
                      <li key={it.id} className="list__item">
                        <div className="list__main">
                          <div className="list__title">ID: {it.id}</div>
                          <div className="list__sub">User: <span className="tip" title={`@${it.target_username}`}>{it.target || it.target_id || 'unknown'}</span> · By: <span className="tip" title={`@${it.by_username}`}>{it.by || 'unknown'}</span> · Reason: {it.reason || '—'}</div>
                        </div>
                        <TsMeta ts={it.created_at} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">None.</p>
                )}
              </div>
            </div>
          </>
        )}
        <Modal
          open={!!editing}
          title={editing ? `Edit Infraction ${editing.id}` : 'Edit'}
          reason={editReason}
          setReason={setEditReason}
          onClose={() => { setEditing(null); setEditReason('') }}
          onSave={() => {
            if (!g || !editing) return
            const payload = { guild_id: g.id, infraction_id: editing.id, reason: editReason }
            fetch('/.netlify/functions/edit-infraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              .then(r => r.json())
              .then(() => {
                setIns(prev => {
                  const next = JSON.parse(JSON.stringify(prev || {}))
                  const arr = next?.recent_infractions?.items || []
                  arr.forEach(x => { if (x.id === editing.id) x.reason = editReason })
                  return next
                })
                setEditing(null); setEditReason('')
              })
              .catch(() => { setEditing(null); setEditReason('') })
          }}
        />
      </div>
    </section>
  )
}

function BarMiniChart({ data }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...data.map(d => d.count || 0))
  const n = Math.max(1, data.length)
  const leftPct = hover != null ? ((hover + 0.5) * 100) / n : 0
  return (
    <div style={{ position: 'relative', height: 64, width: '100%', padding: '4px 0' }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: '100%' }}>
        {data.map((d, i) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count}`}
            onMouseEnter={() => setHover(i)}
            onMouseMove={() => setHover(i)}
            style={{ flex: 1, height: `${(d.count / max) * 100}%`, background: hover === i ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)', borderRadius: 2 }}
          />
        ))}
      </div>
      {hover != null && (
        <div style={{ position: 'absolute', left: `${leftPct}%`, top: -6, transform: 'translate(-50%, -100%)', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 12, padding: '3px 6px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.15)' }}>
          {data[hover].count} infractions
        </div>
      )}
    </div>
  )
}

function SelectFancy({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const active = options.find(o => o.value === value) || options[0]
  const toggle = () => setOpen(v => !v)
  const close = () => setOpen(false)
  return (
    <div className={`select ${open ? 'is-open' : ''}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close() }}>
      <button type="button" className="select__btn" onClick={toggle} aria-haspopup="listbox" aria-expanded={open}>
        <span>{active?.label}</span>
        <span className="chev" aria-hidden>▾</span>
      </button>
      <div className="select__menu glass" role="listbox">
        {options.map((o) => (
          <button key={o.value} type="button" className={`select__item ${o.value === value ? 'is-active' : ''}`} onClick={() => { onChange(o.value); close() }} role="option" aria-selected={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TsMeta({ ts }) {
  const [open, setOpen] = useState(false)
  if (!ts) return <div className="list__meta" />
  try {
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
    const day = d.toLocaleDateString(undefined, { weekday: 'short' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const full = d.toLocaleString()
    return (
      <div
        className={`list__meta tip ${open ? 'is-open' : ''}`}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span>{day} · {time}</span>
        <div className="tip__bubble" role="tooltip">{full}</div>
      </div>
    )
  } catch {
    return <div className="list__meta" />
  }
}

function Modal({ open, onClose, onSave, reason, setReason, title }) {
  if (!open) return null
  return (
    <div className="modal__backdrop" onMouseDown={onClose}>
      <div className="glass modal__card" onMouseDown={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px' }}>{title || 'Edit'}</h3>
        <textarea className="input input--ghost modal__textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
