'use strict'

const crypto = require('crypto')

const b64url = (str) => Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

function parseCookies(header) {
  const out = {}
  if (!header) return out
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=')
    if (k && v) out[k] = v.join('=')
  })
  return out
}

const resolveSiteUrl = (event) => {
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  const host = event.headers && event.headers.host
  const proto = (event.headers && event.headers['x-forwarded-proto']) || 'https'
  if (!host) return ''
  return `${proto}://${host}`.replace(/\/$/, '')
}

exports.handler = async (event) => {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.OAUTH_REDIRECT_URI
  const cookieSecret = process.env.COOKIE_SECRET
  const sessionDays = parseInt(process.env.SESSION_DAYS || '180', 10)

  if (!clientId || !clientSecret) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'text/plain' },
      body: 'server not configured - missing client_id or secret' 
    }
  }

  const params = event.queryStringParameters || {}
  const code = params.code
  const state = params.state
  if (!code || !state) return { statusCode: 400, body: 'missing code/state' }

  // validate state cookie
  const cookieHeader = event.headers && (event.headers.cookie || event.headers.Cookie)
  const cookies = parseCookies(cookieHeader)
  const stateCookie = cookies['chirp_oauth_state']
  if (!stateCookie) return { statusCode: 400, body: 'state cookie missing' }
  if (stateCookie !== state) return { statusCode: 400, body: 'state mismatch' }

  // build redirect URI dynamically
  const siteUrl = resolveSiteUrl(event)
  if (!siteUrl) return { statusCode: 500, body: 'unable to resolve site URL' }
  const dynamicRedirectUri = `${siteUrl}/.netlify/functions/auth-callback`

  // exchange code for token
  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', dynamicRedirectUri)
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!tokenRes.ok) {
    const t = await tokenRes.text()
    return { statusCode: 400, body: `token exchange failed: ${t}` }
  }
  const token = await tokenRes.json()

  // fetch user
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `${token.token_type} ${token.access_token}` }
  })
  if (!userRes.ok) return { statusCode: 400, body: 'failed to fetch user' }
  const user = await userRes.json()

  // build signed session (bind to UA/IP prefix)
  const now = Math.floor(Date.now() / 1000)
  const exp = now + sessionDays * 24 * 60 * 60
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || ''
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '')) || ''
  const ipClient = (ip.split(',')[0] || '').trim()
  const ipPrefix = ipClient.includes('.') ? ipClient.split('.').slice(0,2).join('.') : (ipClient.includes(':') ? ipClient.split(':').slice(0,2).join(':') : '')
  const fp_ua = crypto.createHmac('sha256', cookieSecret).update(ua).digest('hex').slice(0, 16)
  const fp_ip = ipPrefix ? crypto.createHmac('sha256', cookieSecret).update(ipPrefix).digest('hex').slice(0, 16) : ''
  const session = {
    sub: user.id,
    username: user.username,
    discriminator: user.discriminator,
    global_name: user.global_name,
    avatar: user.avatar,
    token_type: token.token_type,
    access_token: token.access_token,
    exp,
    fp_ua,
    fp_ip
  }
  const sessionPayload = JSON.stringify(session)
  const sessionSig = crypto.createHmac('sha256', cookieSecret).update(sessionPayload).digest('hex')
  const sessionCookie = `${b64url(sessionPayload)}.${sessionSig}`

  const isHttps = ((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) === 'https')
  const secureAttr = isHttps ? ' Secure;' : ''
  const host = (event.headers && (event.headers.host || event.headers.Host)) || ''
  const hostname = host.split(':')[0] || ''
  const parts = hostname.split('.')
  const domainAttr = (isHttps && parts.length >= 2) ? ` Domain=.${parts.slice(-2).join('.')};` : ''
  const deleteState = `chirp_oauth_state=; Path=/; HttpOnly;${secureAttr}${domainAttr} SameSite=Lax; Max-Age=0`
  const setSession = `chirp_session=${sessionCookie}; Path=/; HttpOnly;${secureAttr}${domainAttr} SameSite=Strict; Max-Age=${sessionDays*24*60*60}`

  const redirectTo = '/'
  return {
    statusCode: 302,
    headers: { Location: redirectTo },
    multiValueHeaders: { 'Set-Cookie': [deleteState, setSession] },
    body: ''
  }
}


