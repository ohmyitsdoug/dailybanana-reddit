/** Generic error detail for all responses. */
export type ErrorRsp = {error: string; status: number}

/** A finished daily as stored for a player. points[i] is null when time ran out. */
export type Result = {
  n: number
  total: number
  points: (number | null)[]
  guesses: (number | null)[]
  at: number
}

export type Stats = {played: number; streak: number; best: number}
export type BoardRow = {name: string; total: number}

/** GET api/init?n=<daily number> */
export type InitRsp = {
  username: string | null
  result: Result | null
  stats: Stats | null
  today: {players: number; avg: number}
}

/** POST api/finish */
export type FinishReq = {
  n: number
  points: (number | null)[]
  guesses: (number | null)[]
}
export type FinishRsp = {
  saved: boolean
  result: Result
  stats: Stats | null
  rank: number | null
  players: number
  avg: number
  board: BoardRow[]
}

/** GET api/board?n=<daily number> */
export type BoardRsp = {players: number; avg: number; board: BoardRow[]}

export const Endpoint = {
  Init: 'api/init',
  Finish: 'api/finish',
  Board: 'api/board',
  OnAppInstall: 'internal/on/app/install',
  OnMenuNewPost: 'internal/on/menu/new-post',
  OnMenuStats: 'internal/on/menu/stats',
  OnDailyPost: 'internal/scheduler/daily-post',
} as const
export type Endpoint = (typeof Endpoint)[keyof typeof Endpoint]

export const EndpointMethod = {
  [Endpoint.Init]: 'GET',
  [Endpoint.Finish]: 'POST',
  [Endpoint.Board]: 'GET',
  [Endpoint.OnAppInstall]: 'POST',
  [Endpoint.OnMenuNewPost]: 'POST',
  [Endpoint.OnMenuStats]: 'POST',
  [Endpoint.OnDailyPost]: 'POST',
} as const satisfies {[endpoint: string]: 'GET' | 'POST'}

/** The website link from inside the app, tagged so the dashboard shows Reddit as the source. */
export const SITE_URL =
  'https://dailybanana.io/?utm_source=reddit&utm_medium=app&utm_campaign=devvit'
