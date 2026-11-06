// Daily Banana game rules, shared by the Reddit client and server.
// Same puzzles and scoring as dailybanana.io (v1.1): the answer is shown rounded
// (one decimal under 10, whole numbers to 99, then the nearest 10, 50 or 500)
// and guesses are scored against that shown number, so an exact guess scores 100.
import data from './daily-data.json'

export type Item = {
  name: string
  plural: string
  art: string
  dim: string
  cm: number
  avg: boolean
}
export type Question = {A: Item; B: Item; ans: number; show: number}
export type Daily = {n: number; date: string; qs: Question[]}

export const ROUNDS = 6
export const ROUND_SECONDS = 25
export const MAX_PTS = 100

type Raw = {
  items: {[id: string]: [string, string, string, string, number, number?]}
  dailies: [number, string, number[]][]
}
const RAW = data as unknown as Raw

const item = (id: number): Item => {
  const row = RAW.items[String(id)]
  if (!row) throw Error(`no item ${id}`)
  const [name, plural, art, dim, cm, avg] = row
  return {name, plural, art, dim, cm, avg: !!avg}
}

export const roundAns = (n: number): number =>
  n < 10
    ? Math.round(n * 10) / 10
    : n < 100
      ? Math.round(n)
      : n < 1000
        ? Math.round(n / 10) * 10
        : n < 10000
          ? Math.round(n / 50) * 50
          : Math.round(n / 500) * 500

function build(row: [number, string, number[]]): Daily {
  const [n, date, ids] = row,
    qs: Question[] = []
  for (let i = 0; i < ids.length; i += 2) {
    const A = item(ids[i] ?? -1),
      B = item(ids[i + 1] ?? -1),
      ans = B.cm / A.cm
    qs.push({A, B, ans, show: roundAns(ans)})
  }
  return {n, date, qs}
}

/** The daily for a calendar date (YYYY-MM-DD): each player gets the next one at their own midnight, like the website. */
export function dailyFor(iso: string): Daily {
  const d = RAW.dailies
  const exact = d.find(x => x[1] === iso)
  if (exact) return build(exact)
  const idx = d.findIndex(x => x[1] > iso)
  const row = idx === -1 ? d[d.length - 1] : d[Math.max(0, idx - 1)]
  if (!row) throw Error('no dailies')
  return build(row)
}
export function dailyByNumber(n: number): Daily | undefined {
  const row = RAW.dailies.find(x => x[0] === n)
  return row ? build(row) : undefined
}

export const localISO = (t = new Date()): string =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`

const the = (b: Item): string => (b.art ? `${b.art} ${b.name}` : b.name)
// things whose size varies are averages: "the average carrot" in questions, "an average carrot" in sentences
export const theQ = (b: Item): string =>
  b.avg ? `the average ${b.name}` : the(b)
export const anAvg = (b: Item): string =>
  b.avg ? `an average ${b.name}` : the(b)
export const question = (q: Question): string =>
  `Approximately how many ${q.A.plural} ${q.B.dim} is ${theQ(q.B)}?`

/** points = accuracy as a percent: the smaller of (guess, answer) over the bigger. */
export function judge(guess: number, q: Question): {p: number; off: number} {
  const t = q.show
  return {
    p: Math.round((MAX_PTS * Math.min(guess, t)) / Math.max(guess, t)),
    off: guess / t,
  }
}

export const mark = (p: number | null): string =>
  p == null
    ? '❌'
    : p >= 100
      ? '💯'
      : p >= 90
        ? '🍌'
        : p >= 70
          ? '🟫'
          : p >= 40
            ? '🟨'
            : '⬜'

export function offLabel(p: number | null, off: number): string {
  if (p == null) return 'Out of time.'
  if (p >= MAX_PTS) return 'Spot on! 💯'
  const pc = Math.round(Math.abs(off - 1) * 100)
  if (off > 1)
    return off >= 2
      ? `${Math.round(off * 10) / 10}× too high.`
      : `${pc}% too high.`
  return 1 / off >= 2
    ? `${Math.round(10 / off) / 10}× too low.`
    : `${pc}% too low.`
}

/** what people type: 60, 1,200, 1.5k, 2m, ~300 */
export function parseGuess(raw: string): number | null {
  const s = String(raw)
    .toLowerCase()
    .replace(/[,\s~≈]/g, '')
  const m = s.match(/^(\d*\.?\d+)(k|m)?$/)
  if (!m) return null
  const n =
    parseFloat(m[1] ?? '') * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1)
  return n > 0 && Number.isFinite(n) ? n : null
}

export const fmt = (n: number): string =>
  n.toLocaleString('en-US', {maximumFractionDigits: 1})

function nice(n: number): number {
  if (n < 10) return Math.round(n * 10) / 10
  const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}
/** a length for the reveal, metric with imperial alongside */
export function len(cm: number): string {
  const m =
    cm >= 100000
      ? `${fmt(nice(cm / 100000))} km`
      : cm >= 100
        ? `${fmt(nice(cm / 100))} m`
        : `${nice(cm)} cm`
  const ft = cm / 30.48
  const i =
    cm >= 30.48 * 5280
      ? `${fmt(nice(ft / 5280))} mi`
      : ft >= 3
        ? `${fmt(nice(ft))} ft`
        : `${nice(cm / 2.54)} in`
  return `${m} (${i})`
}

export const unitWord = (q: Question, n: number): string =>
  n === 1 ? q.A.name : q.A.plural

export function shareText(
  n: number,
  total: number,
  points: (number | null)[],
): string {
  return `Daily Banana #${String(n).padStart(3, '0')} · ${total}/${ROUNDS * MAX_PTS}\n${points.map(mark).join(' ')}\nPlay on r/dailybananaio or dailybanana.io`
}
