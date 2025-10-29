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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method not allowed' }
  const base = process.env.BOT_API_BASE_URL
  const token = process.env.BOT_API_TOKEN || process.env.BOT_TOKEN || process.env.BOT_API_KEY
  const cookieSecret = process.env.COOKIE_SECRET
  if (!base || !token || !cookieSecret) {
    return { statusCode: 500, body: 'server not configured' }
  }
  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie))
  const raw = cookies['chirp_session']
  if (!raw) return { statusCode: 401, body: 'unauthenticated' }
  const [payloadB64, sig] = raw.split('.')
  const payloadJson = fromB64url(payloadB64)
  const expectedSig = crypto.createHmac('sha256', cookieSecret).update(payloadJson).digest('hex')
  if (sig !== expectedSig) return { statusCode: 401, body: 'invalid session' }
  const session = JSON.parse(payloadJson)
  const now = Math.floor(Date.now() / 1000)
  if (session.exp && now > session.exp) return { statusCode: 401, body: 'session expired' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { body = {} }
  const guildId = (body.guild_id || '').trim()
  const infractionId = (body.infraction_id || '').trim()
  const reason = (body.reason || '').toString()
  if (!guildId || !infractionId) return { statusCode: 400, body: 'missing fields' }

  const api = (p) => base.replace(/\/$/, '') + p
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(api(`/api/guilds/${guildId}/infractions/${encodeURIComponent(infractionId)}`), {
      method: 'POST', headers, body: JSON.stringify({ reason })
    })
    const data = await res.json().catch(() => ({}))
    return { statusCode: res.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
  } catch (e) {
    return { statusCode: 500, body: 'failed to reach bot api' }
  }
}

