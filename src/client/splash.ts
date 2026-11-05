// The inline post: today's daily at a glance, and the button that opens the game.
import {requestExpandedMode} from '@devvit/web/client'
import {Endpoint, type InitRsp} from '../shared/api.ts'
import {dailyFor, localISO, ROUND_SECONDS, ROUNDS} from '../shared/game.ts'
import {api, banana, openSite, tiles} from './ui.ts'

const root = document.getElementById('app') as HTMLElement
const daily = dailyFor(localISO())

function draw(init: InitRsp | null): void {
  const r = init?.result
  const players = init?.today.players ?? 0
  root.innerHTML = `
    <div class="brand">${banana(34)}<span>dailybanana.io</span></div>
    <h1>Daily #${String(daily.n).padStart(3, '0')}</h1>
    ${r
      ? `<p class="lead">You scored <b>${r.total}</b> / ${ROUNDS * 100}</p>${tiles(r.points)}`
      : `<p class="lead">How many bananas long is a school bus? Guess ${ROUNDS} things like that, ${ROUND_SECONDS} seconds each.</p>`}
    <button class="btn main" id="go" type="button"><span>${r ? 'See results' : 'Play today’s daily'}</span><span aria-hidden="true">→</span></button>
    <p class="note">${players ? `${players} ${players === 1 ? 'player' : 'players'} today${init?.today.avg ? ` · average ${init.today.avg}` : ''}` : 'Be the first to play today'}
      · <button class="link" id="site" type="button">dailybanana.io</button></p>`
  ;(document.getElementById('go') as HTMLButtonElement).addEventListener('click', ev => requestExpandedMode(ev, 'game'))
  ;(document.getElementById('site') as HTMLButtonElement).addEventListener('click', openSite)
}

draw(null)
void api<InitRsp>(`${Endpoint.Init}?n=${daily.n}`).then(draw)
