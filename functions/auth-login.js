'use strict'

const crypto = require('crypto')

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

  if (!clientId) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Discord OAuth is not configured. Missing DISCORD_CLIENT_ID.'
    }
  }

  const state = crypto.randomBytes(16).toString('hex')
  const siteUrl = resolveSiteUrl(event)

  if (!siteUrl) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Unable to resolve site URL. Set PUBLIC_SITE_URL.'
    }
  }

  const redirectUri = `${siteUrl}/.netlify/functions/auth-callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email guilds',
    state,
    prompt: 'consent'
  })

  const isHttps = ((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) === 'https')
  const secureAttr = isHttps ? ' Secure;' : ''
  const host = (event.headers && (event.headers.host || event.headers.Host)) || ''
  const hostname = host.split(':')[0] || ''
  const parts = hostname.split('.')
  const domainAttr = (isHttps && parts.length >= 2) ? ` Domain=.${parts.slice(-2).join('.')};` : ''
  const stateCookie = `chirp_oauth_state=${state}; Path=/; HttpOnly;${secureAttr}${domainAttr} SameSite=Lax; Max-Age=600`

  return {
    statusCode: 302,
    headers: {
      Location: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
      'Set-Cookie': stateCookie
    },
    body: ''
  }
}


