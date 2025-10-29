import { useEffect, useMemo, useState } from 'react'

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, lastUpdated: null })
  const [query, setQuery] = useState('')
  const [bc] = useState(() => {
    try { return new BroadcastChannel('chirp.dashboard') } catch { return null }
  })

  useEffect(() => {
    let mounted = true

    const KEY = 'chirp.dashboardGuilds.v1'
    const TTL_MS = 20_000
    const apply = (json) => {
      if (!mounted) return
      setState({ loading: false, data: json, lastUpdated: Date.now() })
      try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), data: json })) } catch {}
      try { bc && bc.postMessage({ kind: 'dashboard_guilds', ts: Date.now(), data: json }) } catch {}
    }
    try {
      const cached = localStorage.getItem(KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.data) {
          setState({ loading: false, data: parsed.data, lastUpdated: parsed.ts || Date.now() })
        }
      }
    } catch {}

    const load = () => {
      fetch('/.netlify/functions/dashboard-guilds', { credentials: 'include', cache: 'no-store' })
        .then(r => r.json())
        .then(apply)
        .catch(err => { if (mounted) setState({ loading: false, error: String(err), lastUpdated: null }) })
    }

    let needsFetch = true
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (cached && cached.ts && Date.now() - cached.ts < TTL_MS) needsFetch = false
    } catch {}
    if (needsFetch) load()

    const iv = setInterval(load, TTL_MS)
    const onMsg = (ev) => {
      const m = ev && ev.data
      if (m && m.kind === 'dashboard_guilds' && m.data) {
        const curTs = state.lastUpdated || 0
        if (!curTs || (m.ts && m.ts > curTs)) {
          setState({ loading: false, data: m.data, lastUpdated: m.ts || Date.now() })
          try { localStorage.setItem(KEY, JSON.stringify({ ts: m.ts || Date.now(), data: m.data })) } catch {}
        }
      }
    }
    try { bc && (bc.onmessage = onMsg) } catch {}

    return () => { mounted = false; clearInterval(iv); try { bc && (bc.onmessage = null); } catch {} }
  }, [])

  const handleRefresh = () => {
    setState(s => ({ ...s, loading: true }))
    const KEY = 'chirp.dashboardGuilds.v1'
    fetch('/.netlify/functions/dashboard-guilds', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        const ts = Date.now()
        setState({ loading: false, data: json, lastUpdated: ts })
        try { localStorage.setItem(KEY, JSON.stringify({ ts, data: json })) } catch {}
        try { bc && bc.postMessage({ kind: 'dashboard_guilds', ts, data: json }) } catch {}
      })
      .catch(err => setState({ loading: false, error: String(err), lastUpdated: null }))
  }

  // Derive guild lists at the top level (hooks must not be inside nested functions)
  const dataOk = !!(state.data && state.data.ok)
  const guilds = useMemo(() => {
    if (!dataOk) return []
    const list = (state.data.guilds || []).filter(g => g.botInGuild !== false)
    return list
  }, [dataOk, state.data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const src = guilds
    const arr = q ? src.filter(g => (g.name || '').toLowerCase().includes(q)) : src
    return [...arr].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [guilds, query])

  const renderCards = () => {
    if (state.loading) return <p>Loading your servers…</p>
    if (state.error) return <p style={{ color: '#ff7c98' }}>Error: {state.error}</p>
    const d = state.data || {}
    if (!d.ok) return <p style={{ color: '#ff7c98' }}>Error: {d.error || 'unable to load'}</p>
    if (!filtered.length) return <p>No servers found.</p>

    return (
      <div className="dashboard__grid">
        {filtered.map((g) => {
          const disabled = g.botInGuild === true && !g.canManage
          const canManage = g.botInGuild === true && g.canManage
          return (
            <div key={g.id} className={`glass guild__card ${disabled ? 'is-disabled' : ''}`}>
              <div className="guild__row">
                <div className="guild__icon">
                  {g.icon ? (
                    <img src={g.icon} alt="Guild icon" />
                  ) : (
                    <div className="guild__placeholder">{(g.name || '?').slice(0,1).toUpperCase()}</div>
                  )}
                </div>
                <div className="guild__meta">
                  <div className="guild__name">{g.name}</div>
                  <div className="guild__sub">{g.owner ? 'Owner' : (g.canManage ? 'Manage Server' : 'View only')}</div>
                </div>
                <div className="guild__right">
                  <div className={`guild__status ${g.botInGuild ? 'ok' : (g.botInGuild === false ? 'warn' : 'muted')}`}>
                    <span className="dot" />{g.botInGuild ? 'Installed' : (g.botInGuild === false ? 'Not Installed' : 'Unknown')}
                  </div>
                  {canManage && (
                    <a className="btn btn--primary guild__manage" href={`/dashboard/${g.id}`}>Manage</a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section className="features" style={{ paddingTop: 24 }}>
      <div className="container">
        <div className="dash__toolbar">
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <div className="dash__actions">
            <input
              className="input input--ghost"
              type="text"
              placeholder="Search servers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn--ghost" onClick={handleRefresh} disabled={!!state.loading}>Refresh</button>
          </div>
        </div>
        <p className="muted" style={{ margin: '0 0 12px' }}>Select a server to manage. Servers where you lack Manage Server are dimmed.</p>
        {state.lastUpdated && (
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Updated {new Date(state.lastUpdated).toLocaleString()}</p>
        )}
        {renderCards()}
      </div>
    </section>
  )
}
