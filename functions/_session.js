'use strict'

const crypto = require('crypto')

const fromB64url = (input = '') => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  return Buffer.from(padded, 'base64').toString('utf8')
}

const toB64url = (input = '') => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const parseCookies = (header) => {
  const out = {}
  if (!header) return out
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=')
    if (k && v) out[k] = v.join('=')
  })
  return out
}

const sessionMaxAgeSeconds = () => {
  const days = parseInt(process.env.SESSION_DAYS || '180', 10)
  return days * 24 * 60 * 60
}

const requestMeta = (event = {}) => {
  const headers = event.headers || {}
  const ua = headers['user-agent'] || headers['User-Agent'] || ''
  const ipHeader = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || ''
  const ipClient = (ipHeader.split(',')[0] || '').trim()
  const host = headers.host || headers.Host || ''
  const proto = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || ''
  return { ua, ipClient, host, proto }
}

const fingerprint = (event, secret) => {
  const { ua, ipClient } = requestMeta(event)
  const fp_ua = crypto.createHmac('sha256', secret).update(ua).digest('hex').slice(0, 16)
  let fp_ip = ''
  if (ipClient) {
    const prefix = ipClient.includes('.')
      ? ipClient.split('.').slice(0, 2).join('.')
      : (ipClient.includes(':') ? ipClient.split(':').slice(0, 2).join(':') : '')
    if (prefix) {
      fp_ip = crypto.createHmac('sha256', secret).update(prefix).digest('hex').slice(0, 16)
    }
  }
  return { fp_ua, fp_ip }
}

const cookieAttributes = (event = {}) => {
  const { host, proto } = requestMeta(event)
  const isHttps = proto === 'https'
  const secureAttr = isHttps ? ' Secure;' : ''
  const hostname = (host || '').split(':')[0] || ''
  const parts = hostname.split('.')
  const domainAttr = (isHttps && parts.length >= 2) ? ` Domain=.${parts.slice(-2).join('.')};` : ''
  return { secureAttr, domainAttr }
}

const signSession = (session, secret) => {
  const payload = JSON.stringify(session)
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const value = `${toB64url(payload)}.${sig}`
  return { payload, value }
}

const buildSessionCookie = (session, event, secret) => {
  const { value } = signSession(session, secret)
  const { secureAttr, domainAttr } = cookieAttributes(event)
  const cookie = `chirp_session=${value}; Path=/; HttpOnly;${secureAttr}${domainAttr} SameSite=Strict; Max-Age=${sessionMaxAgeSeconds()}`
  return { cookie, value }
}

const jsonResponse = (statusCode, payload, opts = {}) => {
  const headers = Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, opts.headers || {})
  const res = { statusCode, headers, body: JSON.stringify(payload) }
  const cookies = opts.cookies && opts.cookies.filter(Boolean)
  if (cookies && cookies.length) {
    res.multiValueHeaders = Object.assign({}, opts.multiValueHeaders || {}, { 'Set-Cookie': cookies })
  } else if (opts.multiValueHeaders) {
    res.multiValueHeaders = opts.multiValueHeaders
  }
  return res
}

const refreshDiscordAccessToken = async (refreshToken) => {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { ok: false, response: jsonResponse(500, { ok: false, error: 'discord oauth not configured' }) }
  }
  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', refreshToken)
  try {
    const res = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, response: jsonResponse(res.status, { ok: false, error: `token refresh failed: ${text || res.status}` }) }
    }
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    return { ok: false, response: jsonResponse(500, { ok: false, error: `token refresh failed: ${err.message || err}` }) }
  }
}

const ensureValidToken = async (event, options = {}) => {
  const cookieSecret = process.env.COOKIE_SECRET
  if (!cookieSecret) {
    return { ok: false, response: jsonResponse(500, { ok: false, error: 'server not configured' }) }
  }

  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie))
  const raw = cookies['chirp_session']
  if (!raw) return { ok: false, response: jsonResponse(401, { ok: false, error: 'unauthenticated' }) }
  const [payloadB64, sig] = raw.split('.')
  if (!payloadB64 || !sig) return { ok: false, response: jsonResponse(401, { ok: false, error: 'invalid session' }) }

  let payloadJson
  try {
    payloadJson = fromB64url(payloadB64)
  } catch (_) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: 'invalid session' }) }
  }

  const expectedSig = crypto.createHmac('sha256', cookieSecret).update(payloadJson).digest('hex')
  if (sig !== expectedSig) return { ok: false, response: jsonResponse(401, { ok: false, error: 'invalid session' }) }

  let session
  try {
    session = JSON.parse(payloadJson)
  } catch (_) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: 'invalid session payload' }) }
  }

  const now = Math.floor(Date.now() / 1000)
  if (session.exp && now > session.exp) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: 'session expired' }) }
  }

  const reqFp = fingerprint(event, cookieSecret)
  if ((session.fp_ua && reqFp.fp_ua && session.fp_ua !== reqFp.fp_ua) || (session.fp_ip && reqFp.fp_ip && session.fp_ip !== reqFp.fp_ip)) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: 'session mismatch' }) }
  }

  const requireDiscordToken = options.requireDiscordToken !== false
  const refreshWindow = options.refreshWindowSeconds || 60
  let updatedSession = session
  const cookiesOut = []

  if (requireDiscordToken) {
    if (!session.token_type || !session.access_token) {
      return { ok: false, response: jsonResponse(401, { ok: false, error: 'missing access token' }) }
    }
    const tokenExp = session.token_exp
    if (!tokenExp) {
      return { ok: false, response: jsonResponse(401, { ok: false, error: 'missing token expiry' }) }
    }
    if (now >= tokenExp - refreshWindow) {
      if (!session.refresh_token) {
        return { ok: false, response: jsonResponse(401, { ok: false, error: 'token expired' }) }
      }
      const refreshed = await refreshDiscordAccessToken(session.refresh_token)
      if (!refreshed.ok) return refreshed
      const data = refreshed.data
      const expiresIn = parseInt(data.expires_in || '3600', 10)
      updatedSession = Object.assign({}, session, {
        access_token: data.access_token,
        token_type: data.token_type || session.token_type,
        refresh_token: data.refresh_token || session.refresh_token,
        token_exp: Math.floor(Date.now() / 1000) + expiresIn,
        scope: data.scope || session.scope,
      })
      const { cookie } = buildSessionCookie(updatedSession, event, cookieSecret)
      cookiesOut.push(cookie)
    }
  }

  return {
    ok: true,
    session: updatedSession,
    accessToken: updatedSession.access_token,
    tokenType: updatedSession.token_type,
    cookies: cookiesOut,
  }
}

module.exports = {
  fromB64url,
  toB64url,
  parseCookies,
  jsonResponse,
  ensureValidToken,
  buildSessionCookie,
  signSession,
}
