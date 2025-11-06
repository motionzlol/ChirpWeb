'use strict'

const { ensureValidToken, jsonResponse } = require('./_session')

exports.handler = async (event) => {
  const ensured = await ensureValidToken(event)
  if (!ensured.ok) return ensured.response
  const { tokenType, accessToken, cookies = [] } = ensured
  const opts = { cookies }

  const botApiBase = process.env.BOT_API_BASE_URL
  const botApiToken = process.env.BOT_API_TOKEN || process.env.BOT_TOKEN || process.env.BOT_API_KEY

  let guilds = []
  try {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return jsonResponse(res.status, { ok: false, error: `failed to fetch guilds: ${t || res.status}` }, opts)
    }
    guilds = await res.json()
  } catch (e) {
    return jsonResponse(400, { ok: false, error: 'failed to fetch guilds' }, opts)
  }

  let botGuildIds = new Set()
  if (botApiBase && botApiToken) {
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
    } catch (_) {
      // Ignore bot API errors to avoid blocking dashboard rendering
    }
  }

  const MANAGE_GUILD = 1n << 5n
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

  return jsonResponse(200, { ok: true, guilds: out }, opts)
}
