import { useEffect, useMemo, useState } from 'react'

export default function GuildDashboard({ guildId }) {
  const [state, setState] = useState({ loading: true })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('infractions')

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
    setLoadingIns(true)
    fetch(`/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(g.id)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (mounted) { setIns(json); setLoadingIns(false) } })
      .catch(() => { if (mounted) setLoadingIns(false) })
    return () => { mounted = false }
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
              </div>
              <div className="glass" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Search</h3>
                <form onSubmit={handleSearch} className="search__row">
                  <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
                    <option value="infractions">Infractions</option>
                    <option value="promotions">Promotions</option>
                  </select>
                  <input className="input input--ghost" placeholder={`${kind.slice(0,-1)} ID`} value={q} onChange={e => setQ(e.target.value)} />
                  <button className="btn btn--primary" type="submit">Search</button>
                </form>
                {ins?.search?.result?.items && ins.search.result.items.length > 0 ? (
                  <ul className="list">
                    {ins.search.result.items.map((it) => (
                      <li key={it.id} className="list__item">
                        <div className="list__main">
                          <div className="list__title">ID: {it.id}</div>
                          <div className="list__sub">User: {it.target_id || 'unknown'} · By: {it.by || 'unknown'} · Reason: {it.reason || '—'}</div>
                        </div>
                        <div className="list__meta">{it.created_at ? new Date(it.created_at * 1000).toLocaleString() : ''}</div>
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
                          <div className="list__sub">User: {it.target_id || 'unknown'} · By: {it.by || 'unknown'} · Reason: {it.reason || '—'}</div>
                        </div>
                        <div className="list__meta">{it.created_at ? new Date(it.created_at * 1000).toLocaleString() : ''}</div>
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
                          <div className="list__sub">User: {it.target_id || 'unknown'} · By: {it.by || 'unknown'} · Reason: {it.reason || '—'}</div>
                        </div>
                        <div className="list__meta">{it.created_at ? new Date(it.created_at * 1000).toLocaleString() : ''}</div>
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
      </div>
    </section>
  )
}
