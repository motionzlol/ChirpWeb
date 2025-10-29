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
  // Verify simple fingerprint binding
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || ''
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '')) || ''
  const ipClient = (ip.split(',')[0] || '').trim()
  const ipPrefix = ipClient.includes('.') ? ipClient.split('.').slice(0,2).join('.') : (ipClient.includes(':') ? ipClient.split(':').slice(0,2).join(':') : '')
  const fp_ua = crypto.createHmac('sha256', cookieSecret).update(ua).digest('hex').slice(0, 16)
  const fp_ip = ipPrefix ? crypto.createHmac('sha256', cookieSecret).update(ipPrefix).digest('hex').slice(0, 16) : ''
  if ((session.fp_ua && session.fp_ua !== fp_ua) || (session.fp_ip && session.fp_ip !== fp_ip)) {
    return { statusCode: 401, body: 'session mismatch' }
  }

  const avatarUrl = session.avatar 
    ? `https://cdn.discordapp.com/avatars/${session.sub}/${session.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${(session.sub >> 22) % 6}.png`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
    body: JSON.stringify({ 
      ok: true, 
      user: { 
        id: session.sub, 
        username: session.username, 
        discriminator: session.discriminator,
        global_name: session.global_name,
        avatar: session.avatar,
        avatar_url: avatarUrl
      } 
    })
  }
}


