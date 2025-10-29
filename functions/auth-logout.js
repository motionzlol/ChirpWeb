'use strict'

exports.handler = async (event) => {
  const isHttps = ((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) === 'https')
  const secureAttr = isHttps ? ' Secure;' : ''
  const host = (event.headers && (event.headers.host || event.headers.Host)) || ''
  const hostname = host.split(':')[0] || ''
  const parts = hostname.split('.')
  const domainAttr = (isHttps && parts.length >= 2) ? ` Domain=.${parts.slice(-2).join('.')};` : ''

  const delNoDomain = `chirp_session=; Path=/; HttpOnly;${secureAttr} SameSite=Strict; Max-Age=0`
  const delWithDomain = `chirp_session=; Path=/; HttpOnly;${secureAttr}${domainAttr} SameSite=Strict; Max-Age=0`

  return {
    statusCode: 302,
    headers: { Location: '/' },
    multiValueHeaders: { 'Set-Cookie': [delNoDomain, delWithDomain] },
    body: ''
  }
}

