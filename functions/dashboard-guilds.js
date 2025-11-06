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

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(payload),
})

exports.handler = async (event) => {
  const cookieSecret = process.env.COOKIE_SECRET
  const botApiBase = process.env.BOT_API_BASE_URL
  const botApiToken = process.env.BOT_API_TOKEN || process.env.BOT_TOKEN || process.env.BOT_API_KEY
  if (!cookieSecret) return json(500, { ok: false, error: 'server not configured' })

  // validate session
  const cookieHeader = event.headers && (event.headers.cookie || event.headers.Cookie)
  const cookies = parseCookies(cookieHeader)
  const raw = cookies['chirp_session']
  if (!raw) return json(401, { ok: false, error: 'unauthenticated' })
  const [payloadB64, sig] = raw.split('.')
  const payloadJson = fromB64url(payloadB64)
  const expectedSig = crypto.createHmac('sha256', cookieSecret).update(payloadJson).digest('hex')
  if (sig !== expectedSig) return json(401, { ok: false, error: 'invalid session' })
  const session = JSON.parse(payloadJson)
  const now = Math.floor(Date.now() / 1000)
  if (session.exp && now > session.exp) return json(401, { ok: false, error: 'session expired' })
  // simple fingerprint binding
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || ''
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '')) || ''
  const ipClient = (ip.split(',')[0] || '').trim()
  const ipPrefix = ipClient.includes('.') ? ipClient.split('.').slice(0,2).join('.') : (ipClient.includes(':') ? ipClient.split(':').slice(0,2).join(':') : '')
  const fp_ua = crypto.createHmac('sha256', cookieSecret).update(ua).digest('hex').slice(0, 16)
  const fp_ip = ipPrefix ? crypto.createHmac('sha256', cookieSecret).update(ipPrefix).digest('hex').slice(0, 16) : ''
  if ((session.fp_ua && session.fp_ua !== fp_ua) || (session.fp_ip && session.fp_ip !== fp_ip)) {
    return json(401, { ok: false, error: 'session mismatch' })
  }

  const tokenType = session.token_type
  const accessToken = session.access_token
  if (!tokenType || !accessToken) return json(401, { ok: false, error: 'missing access token' })

  // fetch guilds from Discord
  let guilds = []
  try {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return json(400, { ok: false, error: `failed to fetch guilds: ${t || res.status}` })
    }
    guilds = await res.json()
  } catch (e) {
    return json(400, { ok: false, error: 'failed to fetch guilds' })
  }

  // determine where the bot is present
  let botGuildIds = new Set()
  if (botApiBase && (botApiToken)) {
    try {
      const url = botApiBase.replace(/\/$/, '') + '/api/guilds'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${botApiToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const arr = (data && data.guilds) || []
        for (const g of arr) botGuildIds.add(String(g.id))
      }
    } catch (_) {}
  }

  // permission bit for MANAGE_GUILD
  const MANAGE_GUILD = 1n << 5n // 0x20

  const out = guilds.map((g) => {
    const id = String(g.id)
    const perms = g.permissions
    let canManage = !!g.owner
    try {
      const p = typeof perms === 'string' ? BigInt(perms) : BigInt(perms || 0)
      if ((p & MANAGE_GUILD) !== 0n) canManage = true
    } catch (_) {}
    const icon = g.icon ? `https://cdn.discordapp.com/icons/${id}/${g.icon}.png?size=96` : null
    return {
      id,
      name: g.name,
      icon,
      owner: !!g.owner,
      canManage,
      botInGuild: botGuildIds.size ? botGuildIds.has(id) : null,
    }
  })

  return json(200, { ok: true, guilds: out })
}
