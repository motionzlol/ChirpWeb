'use strict'

const crypto = require('crypto')

const fromB64url = (input) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  return Buffer.from(padded, 'base64').toString('utf8')
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=')
    if (k && v) out[k] = v.join('=')
  })
  return out
}

exports.handler = async (event) => {
  const base = process.env.BOT_API_BASE_URL
  const token = process.env.BOT_API_TOKEN || process.env.BOT_TOKEN || process.env.BOT_API_KEY
  const cookieSecret = process.env.COOKIE_SECRET
  if (!base || !token || !cookieSecret) {
    return { statusCode: 500, body: 'server not configured' }
  }

  // Validate session and ensure requester has Manage Server/owner on guild
  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie))
  let raw = cookies['chirp_session']

  // Fallback to custom header if chirp_session is not found in standard cookies
  if (!raw && event.headers['x-chirp-session']) {
    raw = event.headers['x-chirp-session'];
  }

  if (!raw) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'unauthenticated', cookieHeader: event.headers.cookie || event.headers.Cookie || '' }) }
  const [payloadB64, sig] = raw.split('.')
  const payloadJson = fromB64url(payloadB64)
  const expectedSig = crypto.createHmac('sha256', cookieSecret).update(payloadJson).digest('hex')
  if (sig !== expectedSig) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'invalid session' }) }
  const session = JSON.parse(payloadJson)
  const now = Math.floor(Date.now() / 1000)
  if (session.exp && now > session.exp) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'session expired' }) }

  // fingerprint binding
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || ''
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '')) || ''
  const ipClient = (ip.split(',')[0] || '').trim()
  const ipPrefix = ipClient.includes('.') ? ipClient.split('.').slice(0,2).join('.') : (ipClient.includes(':') ? ipClient.split(':').slice(0,2).join(':') : '')
  const fp_ua = crypto.createHmac('sha256', cookieSecret).update(ua).digest('hex').slice(0, 16)
  const fp_ip = ipPrefix ? crypto.createHmac('sha256', cookieSecret).update(ipPrefix).digest('hex').slice(0, 16) : ''
  if ((session.fp_ua && session.fp_ua !== fp_ua) || (session.fp_ip && session.fp_ip !== fp_ip)) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'session mismatch' }) }
  }

  const params = event.queryStringParameters || {}
  const guildId = (params.guild_id || '').trim()
  const q = params.q && params.q.trim()
  const kind = params.kind && params.kind.trim() // 'infractions' | 'promotions'
  const hasSearchQuery = Object.prototype.hasOwnProperty.call(params, 'search_query')
  const searchType = params.search_type && params.search_type.trim() // 'channel' | 'role'
  const searchQueryRaw = hasSearchQuery ? (params.search_query ?? '') : undefined
  const searchQuery = typeof searchQueryRaw === 'string' ? searchQueryRaw.trim() : searchQueryRaw
  if (!guildId) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'missing guild_id' }) }

  // Check user's guild permissions on Discord
  const tokenType = session.token_type
  const accessToken = session.access_token
  try {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    })
    if (!res.ok) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'failed to verify membership' }) }
    const guilds = await res.json()
    const g = guilds.find((x) => String(x.id) === String(guildId))
    if (!g) return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'not in guild' }) }
    const MANAGE_GUILD = 1n << 5n
    let canManage = !!g.owner
    try {
      const p = typeof g.permissions === 'string' ? BigInt(g.permissions) : BigInt(g.permissions || 0)
      if ((p & MANAGE_GUILD) !== 0n) canManage = true
    } catch {}
    if (!canManage) return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'forbidden' }) }
  } catch {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'failed to verify membership' }) }
  }

  const api = (p) => base.replace(/\/$/, '') + p
  const headers = { Authorization: `Bearer ${token}` }

  if (event.httpMethod === 'POST') {
    try {
      const { key, value } = JSON.parse(event.body);
      if (!key) {
        return { statusCode: 400, body: 'Missing config key' };
      }
      await fetch(api(`/api/guilds/${guildId}/config`), {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (e) {
      console.error('Error updating bot config:', e);
      return { statusCode: 500, body: 'Failed to update bot config' };
    }
  }

  const out = { ok: true, guild_id: guildId }
  try {
    const [statsRes, infRes, proRes, seriesRes, botConfigRes] = await Promise.all([
      fetch(api(`/api/guilds/${guildId}/stats`), { headers }),
      fetch(api(`/api/guilds/${guildId}/infractions?limit=5`), { headers }),
      fetch(api(`/api/guilds/${guildId}/promotions?limit=5`), { headers }),
      fetch(api(`/api/guilds/${guildId}/infractions/series?days=30`), { headers }),
      fetch(api(`/api/guilds/${guildId}/config`), { headers })
    ])
    const [stats, inf, pro, series, botConfig] = await Promise.all([
      statsRes.json(),
      infRes.json(),
      proRes.json(),
      seriesRes.json(),
      botConfigRes.json(),
    ])
    out.stats = stats
    out.recent_infractions = inf
    out.recent_promotions = pro
    out.infractions_series = series
    out.bot_config = botConfig
  } catch (e) {
    out.error = String((e && e.message) || e)
  }

  if (q && kind && (kind === 'infractions' || kind === 'promotions')) {
    try {
      const res = await fetch(api(`/api/guilds/${guildId}/${kind}?q=${encodeURIComponent(q)}&limit=5`), { headers })
      const data = await res.json()
      out.search = { kind, q, result: data }
    } catch (e) {
      out.search = { kind, q, error: String((e && e.message) || e) }
    }
  }

  if (searchType && hasSearchQuery) {
    try {
      const endpoint = searchType === 'channel' ? 'channels' : 'roles';
      const qp = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(api(`/api/guilds/${guildId}/${endpoint}/search${qp}`), { headers });
      const data = await res.json();
      out.searchResults = { type: searchType, query: searchQuery, items: data.items || data.results || [] };
    } catch (e) {
      out.searchResults = { type: searchType, query: searchQuery, error: String((e && e.message) || e) };
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(out)
  }
}
