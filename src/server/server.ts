import {once} from 'node:events'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {context, reddit} from '@devvit/web/server'
import type {PartialJsonValue, TriggerResponse, UiResponse} from '@devvit/web/shared'
import {
  type BoardRsp,
  Endpoint,
  EndpointMethod,
  type ErrorRsp,
  type FinishReq,
  type FinishRsp,
  type InitRsp,
  type Result,
} from '../shared/api.ts'
import {dailyByNumber, dailyFor, MAX_PTS, ROUNDS} from '../shared/game.ts'
import {dayTotals, getResult, getStats, overview, rankOf, saveResult, topBoard} from './db.ts'

type AnyRsp = InitRsp | FinishRsp | BoardRsp | UiResponse | TriggerResponse | ErrorRsp

export async function onReq(reqMsg: IncomingMessage, rspMsg: ServerResponse): Promise<void> {
  try {
    await route(reqMsg, rspMsg)
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`
    console.error(msg)
    writeJson<ErrorRsp>(500, {error: 'Something went wrong.', status: 500}, rspMsg)
  }
}

async function route(reqMsg: IncomingMessage, rspMsg: ServerResponse): Promise<void> {
  const url = new URL(reqMsg.url ?? '/', 'http://app')
  const endpoint = url.pathname.slice(1) as Endpoint
  const method = (EndpointMethod as {[k: string]: string})[endpoint]

  let rsp: AnyRsp
  if (!method || method !== reqMsg.method) rsp = {error: 'not found', status: 404}
  else {
    switch (endpoint) {
      case Endpoint.Init:
        rsp = await routeInit(Number(url.searchParams.get('n')))
        break
      case Endpoint.Finish:
        rsp = await routeFinish(await readJson<FinishReq>(reqMsg))
        break
      case Endpoint.Board:
        rsp = await routeBoard(Number(url.searchParams.get('n')))
        break
      case Endpoint.OnMenuNewPost:
        rsp = await routeNewPost()
        break
      case Endpoint.OnMenuStats:
        rsp = await routeStats()
        break
      case Endpoint.OnAppInstall:
      case Endpoint.OnDailyPost:
        await postToday()
        rsp = {}
        break
      default:
        rsp = {error: 'not found', status: 404}
    }
  }
  writeJson<PartialJsonValue>('status' in rsp ? (rsp as ErrorRsp).status : 200, rsp as PartialJsonValue, rspMsg)
}

// players get the next daily at their own midnight, so "today" can be yesterday's or tomorrow's UTC daily
function playableNumbers(): Set<number> {
  const day = 864e5, now = Date.now(), iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  return new Set([dailyFor(iso(now - day)).n, dailyFor(iso(now)).n, dailyFor(iso(now + day)).n])
}

async function routeInit(n: number): Promise<InitRsp> {
  const uid = context.userId
  const today = Number.isFinite(n) ? await dayTotals(n) : {players: 0, avg: 0}
  if (!uid) return {username: null, result: null, stats: null, today}
  return {username: context.username ?? null, result: await getResult(n, uid), stats: await getStats(uid), today}
}

async function routeFinish(req: FinishReq): Promise<FinishRsp | ErrorRsp> {
  const n = Number(req.n)
  if (!playableNumbers().has(n) || !dailyByNumber(n)) return {error: 'That daily isn’t open.', status: 400}
  const clean = (a: unknown[], max: number) =>
    Array.from({length: ROUNDS}, (_, i) => {
      const v = a?.[i]
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : null
    })
  const points = clean(req.points, MAX_PTS).map(p => (p == null ? null : Math.round(p)))
  const guesses = clean(req.guesses, 1e12)
  const result: Result = {n, total: points.reduce<number>((s, p) => s + (p ?? 0), 0), points, guesses, at: Date.now()}

  const uid = context.userId
  if (!uid) {
    const t = await dayTotals(n)
    return {saved: false, result, stats: null, rank: null, ...t, board: await topBoard(n)}
  }
  const saved = await saveResult(uid, context.username ?? (await reddit.getCurrentUsername()) ?? 'someone', result)
  const stored = (await getResult(n, uid)) ?? result
  const t = await dayTotals(n)
  return {saved, result: stored, stats: await getStats(uid), rank: await rankOf(n, uid), ...t, board: await topBoard(n)}
}

async function routeBoard(n: number): Promise<BoardRsp> {
  return {...(await dayTotals(n)), board: await topBoard(n)}
}

// today's daily by Eastern time (the scheduled post goes up just after midnight Eastern)
function easternISO(t = Date.now()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'})
      .formatToParts(new Date(t))
      .map(x => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function titleFor(): string {
  const iso = easternISO(), d = dailyFor(iso)
  return `Daily Banana #${String(d.n).padStart(3, '0')} · ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}
async function postToday() {
  return reddit.submitCustomPost({title: titleFor()})
}

async function routeNewPost(): Promise<UiResponse> {
  const post = await postToday()
  return {showToast: {text: 'Posted today’s daily.', appearance: 'success'}, navigateTo: post.url}
}

async function routeStats(): Promise<UiResponse> {
  return {showToast: {text: await overview(dailyFor(easternISO()).n)}}
}

async function readJson<T>(reqMsg: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = []
  reqMsg.on('data', chunk => chunks.push(chunk))
  await once(reqMsg, 'end')
  return JSON.parse(`${Buffer.concat(chunks)}` || '{}')
}

function writeJson<T extends PartialJsonValue>(status: number, json: Readonly<T>, rsp: ServerResponse): void {
  const body = JSON.stringify(json)
  rsp.writeHead(status, {'Content-Length': Buffer.byteLength(body), 'Content-Type': 'application/json'})
  rsp.end(body)
}
