// 키움증권 REST API 공통 클라이언트 (실전/모의 듀얼 환경 지원)
// 문서: https://openapi.kiwoom.com

export type KiwoomEnv = 'mock' | 'prod'

const ENVS = {
  mock: {
    base: 'https://mockapi.kiwoom.com',
    appkey: process.env.KIWOOM_APPKEY_MOCK || '',
    secret: process.env.KIWOOM_SECRETKEY_MOCK || '',
  },
  prod: {
    base: 'https://api.kiwoom.com',
    appkey: process.env.KIWOOM_APPKEY_PROD || '',
    secret: process.env.KIWOOM_SECRETKEY_PROD || '',
  },
} as const

const ACCOUNT_NO = process.env.KIWOOM_ACCOUNT_NO || ''

export const kiwoomAccount = () => ACCOUNT_NO
export const kiwoomBase    = (env: KiwoomEnv) => ENVS[env].base
export const kiwoomConfigured = (env: KiwoomEnv) => Boolean(ENVS[env].appkey && ENVS[env].secret)

export function parseEnv(v: string | null | undefined): KiwoomEnv {
  return v === 'prod' ? 'prod' : 'mock'
}

// ─── OAuth 토큰 (env별 메모리 캐시) ───
const tokenCache: Record<KiwoomEnv, { token: string; expires: number } | null> = {
  mock: null,
  prod: null,
}

export async function getKiwoomToken(env: KiwoomEnv): Promise<string> {
  const cfg = ENVS[env]
  const now = Date.now()
  const cached = tokenCache[env]
  if (cached && cached.expires > now + 60_000) return cached.token
  if (!cfg.appkey || !cfg.secret) throw new Error(`${env === 'prod' ? '실전' : '모의'} AppKey/SecretKey 미설정 (KIWOOM_APPKEY_${env.toUpperCase()} / KIWOOM_SECRETKEY_${env.toUpperCase()})`)

  const res = await fetch(`${cfg.base}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: cfg.appkey,
      secretkey: cfg.secret,
    }),
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`oauth ${res.status}: ${text}`)

  let data: { token?: string; access_token?: string; expires_in?: number | string; expires_dt?: string; return_msg?: string; return_code?: number }
  try { data = JSON.parse(text) } catch { throw new Error(`oauth 파싱 실패: ${text.slice(0, 200)}`) }

  if (data.return_code != null && data.return_code !== 0) {
    throw new Error(`${data.return_msg || `code ${data.return_code}`}`)
  }

  const raw = data.token || data.access_token
  if (!raw) throw new Error(`토큰 없음: ${text.slice(0, 200)}`)
  const token = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`

  let expires = now + 23 * 3600 * 1000
  if (data.expires_in) expires = now + Number(data.expires_in) * 1000
  if (data.expires_dt) {
    const m = String(data.expires_dt).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
    if (m) expires = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
  }

  tokenCache[env] = { token, expires }
  return token
}

export function getCachedTokenExpiry(env: KiwoomEnv): number | null {
  return tokenCache[env]?.expires ?? null
}

// ─── TR 호출 ───
function endpointForApiId(apiId: string): string {
  if (apiId.startsWith('kt0'))                 return '/api/dostk/acnt'
  if (apiId.startsWith('kt1'))                 return '/api/dostk/ordr'
  if (apiId.startsWith('kt9'))                 return '/api/dostk/crdtordr'
  if (apiId === 'ka10001' || apiId === 'ka10002' || apiId === 'ka10003' || apiId === 'ka10004' ||
      apiId === 'ka10095' || apiId === 'ka10100')                return '/api/dostk/stkinfo'
  if (apiId === 'ka10081' || apiId === 'ka10079' || apiId === 'ka10080')   return '/api/dostk/chart'
  if (apiId.startsWith('ka103') || apiId.startsWith('ka102'))    return '/api/dostk/mrkcond'
  return '/api/dostk/stkinfo'
}

export type TROpts = {
  apiId: string
  body: Record<string, string>
  contYn?: 'Y' | 'N'
  nextKey?: string
  endpoint?: string
}

export type TRResult = {
  status: number
  data: Record<string, unknown> & { return_code?: number; return_msg?: string }
  contYn: string | null
  nextKey: string | null
}

export async function callKiwoomTR(env: KiwoomEnv, opts: TROpts): Promise<TRResult> {
  const { apiId, body, contYn = 'N', nextKey = '', endpoint } = opts
  const token = await getKiwoomToken(env)
  const url = `${ENVS[env].base}${endpoint || endpointForApiId(apiId)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'authorization': token,
      'cont-yn': contYn,
      'next-key': nextKey,
      'api-id': apiId,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  return {
    status: res.status,
    data: data as TRResult['data'],
    contYn: res.headers.get('cont-yn'),
    nextKey: res.headers.get('next-key'),
  }
}

export function parseKiwoomNum(v: unknown): { value: number; sign: 'up' | 'down' | 'flat' } {
  if (v == null) return { value: 0, sign: 'flat' }
  const s = String(v).trim()
  if (!s) return { value: 0, sign: 'flat' }
  if (s.startsWith('+')) return { value: Math.abs(Number(s.slice(1))) || 0, sign: 'up' }
  if (s.startsWith('-')) return { value: Math.abs(Number(s.slice(1))) || 0, sign: 'down' }
  return { value: Math.abs(Number(s)) || 0, sign: 'flat' }
}
