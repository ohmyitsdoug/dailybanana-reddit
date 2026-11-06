// The expanded view: six timed rounds, the reveal after each, then results and the day's leaderboard.
import {Endpoint, type FinishRsp, type InitRsp, type Result} from '../shared/api.ts'
import {
  anAvg, dailyFor, fmt, judge, localISO, MAX_PTS, offLabel, parseGuess, question,
  ROUND_SECONDS, ROUNDS, shareText, unitWord,
} from '../shared/game.ts'
import {api, esc, logo, openSite, tiles} from './ui.ts'

const root = document.getElementById('app') as HTMLElement
const daily = dailyFor(localISO())
const SAVE_KEY = `dbr:live:${daily.n}`   // an unfinished game on this device, so closing the view doesn't lose it

type Live = {i: number; points: (number | null)[]; guesses: (number | null)[]; offs: number[]}
let live: Live = load() ?? {i: 0, points: [], guesses: [], offs: []}
let timer: number | undefined

function load(): Live | null {
  try { const v = localStorage.getItem(SAVE_KEY); return v ? (JSON.parse(v) as Live) : null } catch { return null }
}
function keep(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(live)) } catch { /* storage can be unavailable */ }
}
function drop(): void {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
const total = (): number => live.points.reduce<number>((s, p) => s + (p ?? 0), 0)

function head(round = live.i + 1): string {
  return `<div class="top">${logo(`Daily #${String(daily.n).padStart(3, '0')}`)}
    <span class="chip">${Math.min(round, ROUNDS)}/${ROUNDS} · ${total()}</span></div>
    ${tiles([...live.points, ...Array<undefined>(ROUNDS - live.points.length).fill(undefined)])}`
}

// ---------- a round ----------
function showRound(): void {
  const q = daily.qs[live.i]
  if (!q) return void finish()
  let left = ROUND_SECONDS
  root.innerHTML = `${head()}
    <p class="q">${esc(question(q))}</p>
    <form id="f" class="guess" autocomplete="off">
      <input id="g" inputmode="decimal" enterkeyhint="go" placeholder="Your guess" aria-label="Your guess">
      <button class="btn main" type="submit">Guess</button>
    </form>
    <div class="clock" aria-hidden="true"><i id="bar"></i></div>
    <p class="note" id="msg">${left} seconds</p>`
  const g = document.getElementById('g') as HTMLInputElement
  const bar = document.getElementById('bar') as HTMLElement
  const msg = document.getElementById('msg') as HTMLElement
  g.focus()
  const end = Date.now() + ROUND_SECONDS * 1000
  timer = window.setInterval(() => {
    left = Math.max(0, (end - Date.now()) / 1000)
    bar.style.width = `${(left / ROUND_SECONDS) * 100}%`
    msg.textContent = `${Math.ceil(left)} seconds`
    if (left <= 0) answer(null)
  }, 100)
  ;(document.getElementById('f') as HTMLFormElement).addEventListener('submit', ev => {
    ev.preventDefault()
    const n = parseGuess(g.value)
    if (n == null) { msg.textContent = 'Type a number, like 40 or 1.5k'; return }
    answer(n)
  })
}

function answer(guess: number | null): void {
  window.clearInterval(timer)
  const q = daily.qs[live.i]
  if (!q) return
  const j = guess == null ? {p: null, off: 1} : judge(guess, q)
  live.points.push(j.p)
  live.guesses.push(guess)
  live.offs.push(j.off)
  live.i++
  keep()
  root.innerHTML = `${head(live.i)}
    <p class="big">${j.p == null ? '0' : `+${j.p}`}</p>
    <p class="lead">${esc(offLabel(j.p, j.off))}${guess != null && j.p !== MAX_PTS ? ` You said ${fmt(guess)}.` : ''}</p>
    <p class="q">${esc(cap(anAvg(q.B)))} is about <b>${fmt(q.show)} ${esc(unitWord(q, q.show))}</b> ${esc(q.B.dim)}.</p>
    <p class="note">${esc(cap(anAvg(q.B)))} is about <b>${inBananas(q.B.cm)}</b> ${esc(q.B.dim)}. ${esc(cap(anAvg(q.A)))} is about <b>${inBananas(q.A.cm)}</b>.</p>
    <button class="btn main" id="next" type="button"><span>${live.i >= ROUNDS ? 'See results' : 'Next'}</span><span aria-hidden="true">→</span></button>`
  const next = document.getElementById('next') as HTMLButtonElement
  next.focus()
  next.addEventListener('click', () => (live.i >= ROUNDS ? void finish() : showRound()))
}
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
// sizes in bananas (18 cm), one decimal under 10: "about 0.8 bananas", "about 111 bananas"
const inBananas = (cm: number): string => {
  const x = cm / 18, v = x < 10 ? Math.round(x * 10) / 10 : Math.round(x)
  return `${fmt(v)} ${v === 1 ? 'banana' : 'bananas'}`
}

// ---------- results ----------
async function finish(): Promise<void> {
  root.innerHTML = `${head(ROUNDS)}<p class="note">Saving…</p>`
  const rsp = await api<FinishRsp>(Endpoint.Finish, {n: daily.n, points: live.points, guesses: live.guesses})
  if (rsp) drop()
  results(rsp ? rsp.result : {n: daily.n, total: total(), points: live.points, guesses: live.guesses, at: Date.now()}, rsp)
}

function results(r: Result, rsp: FinishRsp | null): void {
  const text = shareText(r.n, r.total, r.points)
  const board = rsp?.board ?? []
  root.innerHTML = `<div class="top">${logo(`Daily #${String(r.n).padStart(3, '0')}`)}</div>
    <p class="eyebrow">Your score</p>
    <p class="big">${r.total}<small> / ${ROUNDS * MAX_PTS}</small></p>
    ${tiles(r.points)}
    <p class="note">${rsp?.rank ? `#${rsp.rank} of ${rsp.players} today · average ${rsp.avg}` : rsp ? `${rsp.players} played today · average ${rsp.avg}` : 'Couldn’t save your score just now.'}
    ${rsp?.stats ? ` · streak ${rsp.stats.streak} · ${rsp.stats.played} played` : ''}${rsp && !rsp.saved && rsp.stats ? ' · your first finish counts' : ''}</p>
    <div class="row"><button class="btn main" id="copy" type="button">Copy result</button><button class="btn" id="site" type="button">More at dailybanana.io</button></div>
    ${board.length ? `<p class="eyebrow">Today’s top ${board.length}</p><ol class="board">${board.map(b => `<li><span>${esc(b.name)}</span><b>${b.total}</b></li>`).join('')}</ol>` : ''}
    <p class="note">Talking answers in the comments? Use spoiler tags: <code>&gt;!like this!&lt;</code></p>
    <p class="note">A new daily every day at midnight, your time.</p>`
  ;(document.getElementById('copy') as HTMLButtonElement).addEventListener('click', ev => void copy(text, ev.currentTarget as HTMLButtonElement))
  ;(document.getElementById('site') as HTMLButtonElement).addEventListener('click', openSite)
}

async function copy(text: string, btn: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    btn.textContent = 'Copied!'
  } catch {
    // clipboard can be blocked inside the post; show the text so it can be copied by hand
    const t = document.createElement('textarea')
    t.value = text
    t.rows = 3
    t.className = 'copybox'
    btn.replaceWith(t)
    t.select()
  }
}

// ---------- start ----------
async function start(): Promise<void> {
  root.innerHTML = `<p class="note">Loading…</p>`
  const init = await api<InitRsp>(`${Endpoint.Init}?n=${daily.n}`)
  if (init?.result) return results(init.result, {saved: false, result: init.result, stats: init.stats, rank: null, ...init.today, board: (await api<{board: FinishRsp['board']}>(`${Endpoint.Board}?n=${daily.n}`))?.board ?? []})
  if (live.i >= ROUNDS) return void finish()
  showRound()
}
void start()
