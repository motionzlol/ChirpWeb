import { useEffect, useMemo, useState } from 'react'

import User from './User';
import TsMeta from './TsMeta';
import ChannelOrRoleSelector from './ChannelOrRoleSelector';

export default function GuildDashboard({ guildId }) {
  const [state, setState] = useState({ loading: true })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('infractions')

  const handleBotConfigUpdate = async (key, value) => {
    setIns(prev => ({
      ...prev,
      bot_config: { ...prev.bot_config, [key]: value }
    }));
    // Persist changes to the backend
    try {
      const url = `/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(guildId)}`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error updating bot config:', error);
    }
  };

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
                  <p className="muted">Loading...</p>
                ) : (
                  <div className="stats__row">
                    <div className="stat"><div className="stat__num">{ins?.stats?.infractions_total ?? '-'}</div><div className="stat__label">Infractions</div></div>
                    <div className="stat"><div className="stat__num">{ins?.stats?.promotions_total ?? '-'}</div><div className="stat__label">Promotions</div></div>
                  </div>
                )}
                {!loadingIns && ins?.infractions_series?.series?.length ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Infractions | Last 30 days</div>
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
                    {ins.search.result.items.map((it) => (
                      <li key={it.id} className="list__item">
                        <div className="list__main">
                          <div className="list__title">ID: {it.id}</div>
                          <div className="list__sub">User: <User id={it.target_id} name={it.target} username={it.target_username} /> | By: <User id={it.by_id} name={it.by} username={it.by_username} /> | Reason: {it.reason || '-'}</div>
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
                          <div className="list__sub">User: <User id={it.target_id} name={it.target} username={it.target_username} /> | By: <User id={it.by_id} name={it.by} username={it.by_username} /> | Reason: {it.reason || '-'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TsMeta ts={it.created_at} />
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(it); setEditReason(it.reason || '') }}>Edit</button>
                        </div>
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
                                        <div className="list__sub">User: <User id={it.target_id} name={it.target} username={it.target_username} /> | By: <User id={it.by_id} name={it.by} username={it.by_username} /> | Reason: {it.reason || '-'}</div>
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
                          <div className="grid-2" style={{ marginTop: 12 }}>
                            <div className="glass" style={{ padding: 18 }}>
                              <h3 style={{ marginTop: 0 }}>Bot Configuration</h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <ChannelOrRoleSelector
                                  type="role"
                                  label="Promotion Issuer Role"
                                  guildId={g.id}
                                  value={ins?.bot_config?.promotion_issuer_role}
                                  onChange={(id) => handleBotConfigUpdate('promotion_issuer_role', id)}
                                />
                                <ChannelOrRoleSelector
                                  type="role"
                                  label="Infraction Issuer Role"
                                  guildId={g.id}
                                  value={ins?.bot_config?.infraction_issuer_role}
                                  onChange={(id) => handleBotConfigUpdate('infraction_issuer_role', id)}
                                />
                                <ChannelOrRoleSelector
                                  type="channel"
                                  label="Promotion Log Channel"
                                  guildId={g.id}
                                  value={ins?.bot_config?.promotion_log}
                                  onChange={(id) => handleBotConfigUpdate('promotion_log', id)}
                                />
                                <ChannelOrRoleSelector
                                  type="channel"
                                  label="Promotion Audit Log Channel"
                                  guildId={g.id}
                                  value={ins?.bot_config?.promotion_audit_log}
                                  onChange={(id) => handleBotConfigUpdate('promotion_audit_log', id)}
                                />
                                <ChannelOrRoleSelector
                                  type="channel"
                                  label="Infraction Log Channel"
                                  guildId={g.id}
                                  value={ins?.bot_config?.infraction_log}
                                  onChange={(id) => handleBotConfigUpdate('infraction_log', id)}
                                />
                                <ChannelOrRoleSelector
                                  type="channel"
                                  label="Infraction Audit Log Channel"
                                  guildId={g.id}
                                  value={ins?.bot_config?.infraction_audit_log}
                                  onChange={(id) => handleBotConfigUpdate('infraction_audit_log', id)}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      <Modal          open={!!editing}
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
    <div style={{ position: 'relative', height: 100, width: '100%', padding: '4px 0 16px 0' }} onMouseLeave={() => setHover(null)}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 'calc(100% - 16px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
        <span>{max}</span>
        <span>0</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 'calc(100% - 16px)', marginLeft: 20 }}>
        {data.map((d, i) => (
          <div
            key={d.date}
            onMouseEnter={() => setHover(i)}
            onMouseMove={() => setHover(i)}
            style={{ flex: 1, height: `${(d.count / max) * 100}%`, background: hover === i ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)', borderRadius: 2 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, height: 16, marginLeft: 20, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {data.map((d, i) => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {i % 7 === 0 ? d.date.slice(5) : ''}
          </div>
        ))}
      </div>
      {hover != null && (
        <div className="bar-chart-tooltip" style={{ left: `${leftPct}%`, top: -6, transform: 'translate(-50%, -100%)' }}>
          {data[hover].date}: {data[hover].count} infractions
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
        <span className="chev" aria-hidden>v</span>
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
