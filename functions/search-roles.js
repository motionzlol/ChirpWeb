'use strict'

const crypto = require('crypto')

function parseCookies(header) {
  const out = {}
  if (!header) return out
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=')
    if (k && v) out[k] = v.join('=')
  })
  return out
}

const fromB64url = (input) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  return Buffer.from(padded, 'base64').toString('utf8')
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {}
  const guildId = (params.guild_id || '').trim()
  const q = (params.q || '').trim()

  if (!guildId || !q) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'missing guild_id or q' })
    }
  }

  const cookieSecret = process.env.COOKIE_SECRET
  const base = process.env.BOT_API_BASE_URL
  if (!cookieSecret || !base) {
    return { statusCode: 500, body: 'server not configured' }
  }

  // Validate session and ensure requester can manage the guild
  try {
    const cookieHeader = event.headers && (event.headers.cookie || event.headers.Cookie)
    const cookies = parseCookies(cookieHeader)
    const raw = cookies['chirp_session']
    if (!raw) return { statusCode: 401, body: 'unauthenticated' }
    const [payloadB64, sig] = raw.split('.')
    const payloadJson = fromB64url(payloadB64)
    const expectedSig = crypto.createHmac('sha256', cookieSecret).update(payloadJson).digest('hex')
    if (sig !== expectedSig) return { statusCode: 401, body: 'invalid session' }
    const session = JSON.parse(payloadJson)
    const now = Math.floor(Date.now() / 1000)
    if (session.exp && now > session.exp) return { statusCode: 401, body: 'session expired' }

    // Check Discord guild permissions
    const tokenType = session.token_type
    const accessToken = session.access_token
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    })
    if (!res.ok) return { statusCode: 401, body: 'failed to verify membership' }
    const guilds = await res.json()
    const g = guilds.find((x) => String(x.id) === String(guildId))
    if (!g) return { statusCode: 403, body: 'not in guild' }
    const MANAGE_GUILD = 1n << 5n
    let canManage = !!g.owner
    try {
      const p = typeof g.permissions === 'string' ? BigInt(g.permissions) : BigInt(g.permissions || 0)
      if ((p & MANAGE_GUILD) !== 0n) canManage = true
    } catch {}
    if (!canManage) return { statusCode: 403, body: 'forbidden' }
  } catch {
    return { statusCode: 401, body: 'unauthorized' }
  }

  try {
    const apiUrl = base.replace(/\/$/, '') + `/bot/api/guilds/roles/search?guild_id=${encodeURIComponent(guildId)}&q=${encodeURIComponent(q)}`
    const response = await fetch(apiUrl)
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || { ok: false, error: 'upstream error' })
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data)
    }
  } catch (e) {
    console.error('search-roles error:', e)
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'internal error' }) }
  }
}
