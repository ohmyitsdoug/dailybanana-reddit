// Small shared pieces for the splash and game views: the pixel banana, API calls, and helpers.
import {navigateTo} from '@devvit/web/client'
import {SITE_URL} from '../shared/api.ts'

// the same 16-bit banana as dailybanana.io (b outline, y yellow, l highlight, d shade, s stem)
const BANANA_PX = [
  '..........bb....', '.........bssb...', '.........bssb...', '.........bydb...', '.........byydb..', '.........byydb..',
  '.........bylydb.', '........bylyydb.', '........bylyydb.', '.......bylyyydb.', '......bylyyyydb.', '....bbylyyyyddb.',
  '..bbylyyyyyyddb.', '.bylyyyyyyyddb..', 'bsyyyyyyyyddb...', 'bsdddddddbbb....', '.bbbbbbbbb......',
]
const BAN_C: {[k: string]: string} = {b: '#3D2411', y: '#FED53C', l: '#FFE46F', d: '#EAA317', s: '#7B4B1F'}
export function banana(px = 16): string {
  const P: {[c: string]: string} = {}
  BANANA_PX.forEach((row, y) => {
    ;[...row].forEach((c, x) => {
      if (BAN_C[c]) P[c] = `${P[c] ?? ''}M${x - 0.03} ${y - 0.03}h1.06v1.06h-1.06z`
    })
  })
  const paths = Object.entries(P).map(([c, d]) => `<path d="${d}" fill="${BAN_C[c]}"/>`).join('')
  return `<svg width="${px}" height="${Math.round((px * 17) / 16)}" viewBox="0 0 16 17" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`
}
/** the Daily Banana logo: the pixel banana in a box, then the name (same as the site's header) */
export const logo = (label = 'dailybanana.io', big = false): string =>
  `<div class="brand${big ? ' big' : ''}"><span class="m" aria-hidden="true">${banana(big ? 26 : 18)}</span><span>${label}</span></div>`

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string)

export async function api<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const rsp = await fetch(path, body === undefined
      ? {headers: {Accept: 'application/json'}}
      : {method: 'POST', headers: {Accept: 'application/json', 'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    if (!rsp.ok) {
      console.error(`HTTP ${rsp.status}: ${await rsp.text().catch(() => '')}`)
      return null
    }
    return (await rsp.json()) as T
  } catch (err) {
    console.error(err)
    return null
  }
}

export function openSite(): void {
  navigateTo(SITE_URL)
}

/** the six result squares, as small tiles (golden banana for an exact guess) */
export function tiles(points: (number | null | undefined)[]): string {
  return `<div class="tiles">${points
    .map(p => {
      if (p === undefined) return '<span class="tile empty">?</span>'
      if (p === null) return '<span class="tile miss">✕</span>'
      if (p >= 100) return `<span class="tile bull gold"><span class="gb" aria-hidden="true"></span><b>${p}</b></span>`
      if (p >= 90) return `<span class="tile bull">${banana(16)}<b>${p}</b></span>`
      return `<span class="tile ${p >= 70 ? 'good' : p >= 40 ? 'mid' : 'low'}"><b>${p}</b></span>`
    })
    .join('')}</div>`
}
