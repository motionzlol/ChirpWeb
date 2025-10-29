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
  const cookieSecret = process.env.COOKIE_SECRET
  if (!cookieSecret) return { statusCode: 500, body: 'server not configured' }

  const params = event.queryStringParameters || {}
  const guildId = (params.guild_id || '').trim()
  if (!guildId) return { statusCode: 400, body: 'missing guild_id' }

  // validate session
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
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || ''
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '')) || ''
  const ipClient = (ip.split(',')[0] || '').trim()
  const ipPrefix = ipClient.includes('.') ? ipClient.split('.').slice(0,2).join('.') : (ipClient.includes(':') ? ipClient.split(':').slice(0,2).join(':') : '')
  const fp_ua = crypto.createHmac('sha256', cookieSecret).update(ua).digest('hex').slice(0, 16)
  const fp_ip = ipPrefix ? crypto.createHmac('sha256', cookieSecret).update(ipPrefix).digest('hex').slice(0, 16) : ''
  if ((session.fp_ua && session.fp_ua !== fp_ua) || (session.fp_ip && session.fp_ip !== fp_ip)) {
    return { statusCode: 401, body: 'session mismatch' }
  }

  const tokenType = session.token_type
  const accessToken = session.access_token
  if (!tokenType || !accessToken) return { statusCode: 401, body: 'missing access token' }

  // fetch user guilds and locate the one requested
  let guilds = []
  try {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { statusCode: 400, body: `failed to fetch guilds: ${t}` }
    }
    guilds = await res.json()
  } catch {
    return { statusCode: 400, body: 'failed to fetch guilds' }
  }

  const g = guilds.find(x => String(x.id) === String(guildId))
  if (!g) return { statusCode: 404, body: 'guild not found for user' }

  // permissions
  const MANAGE_GUILD = 1n << 5n
  let canManage = !!g.owner
  try {
    const p = typeof g.permissions === 'string' ? BigInt(g.permissions) : BigInt(g.permissions || 0)
    if ((p & MANAGE_GUILD) !== 0n) canManage = true
  } catch {}

  if (!canManage) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, authorized: false })
    }
  }

  const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96` : null
  const payload = {
    id: String(g.id),
    name: g.name,
    icon,
    owner: !!g.owner,
    canManage: true,
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, authorized: true, guild: payload })
  }
}
