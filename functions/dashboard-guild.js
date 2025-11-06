'use strict'

const { ensureValidToken, jsonResponse } = require('./_session')

exports.handler = async (event) => {
  const params = event.queryStringParameters || {}
  const guildId = (params.guild_id || '').trim()
  if (!guildId) return jsonResponse(400, { ok: false, error: 'missing guild_id' })

  const ensured = await ensureValidToken(event)
  if (!ensured.ok) return ensured.response
  const { tokenType, accessToken, cookies = [] } = ensured
  const opts = { cookies }

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
  } catch (_) {
    return jsonResponse(400, { ok: false, error: 'failed to fetch guilds' }, opts)
  }

  const g = guilds.find(x => String(x.id) === String(guildId))
  if (!g) return jsonResponse(404, { ok: false, error: 'guild not found for user' }, opts)

  const MANAGE_GUILD = 1n << 5n
  let canManage = !!g.owner
  try {
    const perms = typeof g.permissions === 'string' ? BigInt(g.permissions) : BigInt(g.permissions || 0)
    if ((perms & MANAGE_GUILD) !== 0n) canManage = true
  } catch (_) {}

  if (!canManage) {
    return jsonResponse(403, { ok: false, authorized: false }, opts)
  }

  const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96` : null
  const payload = {
    id: String(g.id),
    name: g.name,
    icon,
    owner: !!g.owner,
    canManage: true,
  }

  return jsonResponse(200, { ok: true, authorized: true, guild: payload }, opts)
}
