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

  // Validate session
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

  // Get user ID from session
  const userId = session.user_id
  if (!userId) return { statusCode: 400, body: 'missing user_id in session' }

  const api = (p) => base.replace(/\/$/, '') + p
  const headers = { Authorization: `Bearer ${token}` }

  let infractions = []
  try {
    // Assuming a bot API endpoint for user-specific infractions exists
    // If not, this would need to be adjusted based on actual bot API capabilities
    const res = await fetch(api(`/api/users/${userId}/infractions?limit=10`), { headers })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { statusCode: res.status, body: `failed to fetch user infractions: ${t}` }
    }
    const data = await res.json()
    infractions = data.items || []
  } catch (e) {
    return { statusCode: 500, body: `failed to fetch user infractions: ${e.message || e}` }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, user_id: userId, infractions: infractions })
  }
}
