'use strict'

// Module-scoped cache (persists across warm invocations)
let CACHE = { ts: 0, payload: null }
let PENDING = null
const TTL_MS = 60 * 1000 // 1 minute

async function fetchUpstream(url) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 5000)
  try {
    const res = await fetch(url, { signal: ac.signal })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }
    const payload = { ok: true, upstream: url, status: res.status, data }
    return payload
  } finally {
    clearTimeout(t)
  }
}

exports.handler = async () => {
  const base = process.env.BOT_API_BASE_URL
  if (!base) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'BOT_API_BASE_URL not set' })
    }
  }

  const url = base.replace(/\/$/, '') + '/health'
  const now = Date.now()

  // Serve fresh cache if within TTL
  if (CACHE.payload && (now - CACHE.ts) < TTL_MS) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ...CACHE.payload, cached: true, age_ms: now - CACHE.ts })
    }
  }

  // If a fetch is in-flight, await it
  if (PENDING) {
    try {
      const payload = await PENDING
      CACHE = { ts: Date.now(), payload }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ...payload, cached: false })
      }
    } catch (e) {
      // fall through to error handling below
    } finally {
      PENDING = null
    }
  }

  // Fetch new data and update cache; if it fails, serve last good if available
  try {
    PENDING = fetchUpstream(url)
    const payload = await PENDING
    CACHE = { ts: Date.now(), payload }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ...payload, cached: false })
    }
  } catch (e) {
    const err = String((e && e.message) || e)
    if (CACHE.payload) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ...CACHE.payload, ok: true, stale: true, error: err })
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, upstream: url, error: err })
    }
  } finally {
    PENDING = null
  }
}
