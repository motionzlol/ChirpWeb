import { useEffect, useState } from 'react'

export default function Status() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let mounted = true
    const load = () => {
      fetch('/.netlify/functions/status-health', { cache: 'no-store' })
        .then(r => r.json())
        .then(json => { if (mounted) setState({ loading: false, data: json }) })
        .catch(err => { if (mounted) setState({ loading: false, error: String(err) }) })
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { mounted = false }
  }, [])

  const fmtUptime = (s) => {
    if (typeof s !== 'number' || !isFinite(s)) return 'n/a'
    let n = Math.floor(s)
    const d = Math.floor(n / 86400); n -= d * 86400
    const h = Math.floor(n / 3600); n -= h * 3600
    const m = Math.floor(n / 60); n -= m * 60
    const parts = []
    if (d) parts.push(`${d}d`)
    if (d || h) parts.push(`${h}h`)
    if (d || h || m) parts.push(`${m}m`)
    parts.push(`${n}s`)
    return parts.join(' ')
  }

  const renderBody = () => {
    if (state.loading) return <p>Checking status…</p>
    if (state.error) return <p style={{ color: '#ff7c98' }}>Error: {state.error}</p>
    const d = state.data || {}
    if (!d.ok) return <p style={{ color: '#ff7c98' }}>Upstream error: {d.error || 'unknown'}</p>
    const info = d.data || {}
    return (
      <div className="status__grid">
        <div className="glass status__card">
          <h3>Bot</h3>
          <p><strong>Status:</strong> {info.status || 'unknown'}</p>
          {info.bot && (
            <p><strong>Identity:</strong> {info.bot.username} ({info.bot.id})</p>
          )}
          {typeof info.ready !== 'undefined' && info.ready !== null && (
            <p><strong>Ready:</strong> {String(info.ready)}</p>
          )}
          {typeof info.guild_count !== 'undefined' && (
            <p><strong>Guilds:</strong> {info.guild_count}</p>
          )}
          {typeof info.shard_count !== 'undefined' && info.shard_count !== null && (
            <p><strong>Shards:</strong> {info.shard_count}</p>
          )}
          {typeof info.users_cached !== 'undefined' && info.users_cached !== null && (
            <p><strong>Users Cached:</strong> {info.users_cached}</p>
          )}
          {typeof info.commands_total !== 'undefined' && info.commands_total !== null && (
            <p><strong>Registered Commands:</strong> {info.commands_total}
              {typeof info.commands_prefix === 'number' || typeof info.commands_application === 'number' ? (
                <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                  ({typeof info.commands_prefix === 'number' ? `${info.commands_prefix} prefix` : ''}
                  {typeof info.commands_prefix === 'number' && typeof info.commands_application === 'number' ? ', ' : ''}
                  {typeof info.commands_application === 'number' ? `${info.commands_application} slash` : ''})
                </span>
              ) : null}
            </p>
          )}
          {typeof info.latency_s !== 'undefined' && info.latency_s !== null && (
            (() => {
              const ms = typeof info.latency_s === 'number' ? Math.round(info.latency_s * 1000) : null
              return <p><strong>Latency:</strong> {ms !== null ? `${ms} ms` : 'n/a'}</p>
            })()
          )}
        </div>
        <div className="glass status__card">
          <h3>Uptime</h3>
          <p><strong>Uptime:</strong> {typeof info.uptime_s === 'number' ? fmtUptime(info.uptime_s) : 'n/a'}</p>
          {info.now && (<p><strong>Now:</strong> {new Date(info.now * 1000).toLocaleString()}</p>)}
          {info.started_at && (<p><strong>Started:</strong> {new Date(info.started_at * 1000).toLocaleString()}</p>)}
          {typeof info.memory_mb !== 'undefined' && info.memory_mb !== null && (
            <p><strong>Memory:</strong> {info.memory_mb} MB</p>
          )}
        </div>
        <div className="glass status__card">
          <h3>API</h3>
          <p><strong>HTTP:</strong> {d.status}</p>
          {info.auth && (<p><strong>Auth Mode:</strong> {info.auth}</p>)}
          {info.version && (<p><strong>Version:</strong> {info.version}</p>)}
          {info.services && (
            <>
              <p><strong>DB:</strong> {info.services.db ? 'ok' : 'n/a'}</p>
              <p><strong>Cache:</strong> {info.services.cache ? 'ok' : 'n/a'}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="features" style={{ paddingTop: 24 }}>
      <div className="container">
        <h2 style={{ margin: '0 0 12px' }}>Status</h2>
        {renderBody()}
      </div>
    </section>
  )
}
