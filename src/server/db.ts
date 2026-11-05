// Everything the Reddit app stores, in the app's own Redis (nothing leaves Reddit).
//   res:{n}:{userId}      the player's finished daily (JSON)
//   board:{n}             sorted set, member userId, score = total (the day's leaderboard)
//   names                 hash userId -> username (for the leaderboard)
//   user:{userId}         hash { played, streak, best, lastN, firstN }
//   players               sorted set of everyone who ever finished a daily (score = first daily n)
//   returners             sorted set of players who finished dailies on 2+ different days
//   sum:{n}               total of all scores for daily n (for the average)
import {redis} from '@devvit/web/server'
import type {BoardRow, Result, Stats} from '../shared/api.ts'

export async function getResult(n: number, uid: string): Promise<Result | null> {
  const v = await redis.get(`res:${n}:${uid}`)
  return v ? (JSON.parse(v) as Result) : null
}

export async function getStats(uid: string): Promise<Stats | null> {
  const h = await redis.hGetAll(`user:${uid}`)
  if (!h || !h.played) return null
  return {played: Number(h.played), streak: Number(h.streak || 0), best: Number(h.best || 0)}
}

export async function dayTotals(n: number): Promise<{players: number; avg: number}> {
  const players = await redis.zCard(`board:${n}`)
  const sum = Number((await redis.get(`sum:${n}`)) ?? 0)
  return {players, avg: players ? Math.round(sum / players) : 0}
}

export async function topBoard(n: number, size = 10): Promise<BoardRow[]> {
  const rows = await redis.zRange(`board:${n}`, 0, size - 1, {by: 'rank', reverse: true})
  if (!rows.length) return []
  const names = await redis.hMGet('names', rows.map(r => r.member))
  return rows.map((r, i) => ({name: names[i] || 'someone', total: r.score}))
}

/** 1 = best score of the day */
export async function rankOf(n: number, uid: string): Promise<number | null> {
  const total = await redis.zScore(`board:${n}`, uid)
  if (total == null) return null
  // players with a strictly higher score, plus one (ties share a rank)
  const higher = await redis.zRange(`board:${n}`, total + 0.5, '+inf', {by: 'score'})
  return higher.length + 1
}

/** Saves a first finish of daily n. Returns false if this player already finished it (the first one stands). */
export async function saveResult(uid: string, username: string, res: Result): Promise<boolean> {
  const key = `res:${res.n}:${uid}`
  if (await redis.get(key)) return false
  await redis.set(key, JSON.stringify(res))
  await redis.zAdd(`board:${res.n}`, {member: uid, score: res.total})
  await redis.incrBy(`sum:${res.n}`, res.total)
  await redis.hSet('names', {[uid]: username})

  const h = (await redis.hGetAll(`user:${uid}`)) || {}
  const lastN = h.lastN ? Number(h.lastN) : null
  const streak = lastN === res.n - 1 ? Number(h.streak || 0) + 1 : 1
  const played = Number(h.played || 0) + 1
  await redis.hSet(`user:${uid}`, {
    played: String(played),
    streak: String(streak),
    best: String(Math.max(Number(h.best || 0), res.total)),
    lastN: String(Math.max(lastN ?? 0, res.n)),
    firstN: h.firstN || String(res.n),
  })
  if (!h.firstN) await redis.zAdd('players', {member: uid, score: res.n})
  else if (h.firstN !== String(res.n)) await redis.zAdd('returners', {member: uid, score: res.n})
  return true
}

/** For the moderators' Stats menu item. */
export async function overview(n: number): Promise<string> {
  const today = await dayTotals(n)
  const yesterday = await dayTotals(n - 1)
  const players = await redis.zCard('players')
  const returners = await redis.zCard('returners')
  const pct = players ? Math.round((returners / players) * 100) : 0
  return `#${n}: ${today.players} played (avg ${today.avg}) · yesterday ${yesterday.players} · all-time ${players} players, ${returners} came back (${pct}%)`
}
