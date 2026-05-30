// 키움증권 REST API 공통 클라이언트
// 문서: https://openapi.kiwoom.com (REST OpenAPI+)

const API_BASE   = process.env.KIWOOM_API_BASE || 'https://mockapi.kiwoom.com'
const APPKEY     = process.env.KIWOOM_APPKEY || ''
const SECRETKEY  = process.env.KIWOOM_SECRETKEY || ''
const ACCOUNT_NO = process.env.KIWOOM_ACCOUNT_NO || ''

export const kiwoomEnv     = (): 'mock' | 'production' => API_BASE.includes('mock') ? 'mock' : 'production'
export const kiwoomBase    = () => API_BASE
export const kiwoomAccount = () => ACCOUNT_NO
export const kiwoomConfigured = () => Boolean(APPKEY && SECRETKEY)

// ─── OAuth 토큰 (메모리 캐시, 만료 1분 전 자동 갱신) ───
let tokenCache: { token: string; expires: number } | null = null

export async function getKiwoomToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expires > now + 60_000) return tokenCache.token
  if (!APPKEY || !SECRETKEY) throw new Error('KIWOOM_APPKEY / KIWOOM_SECRETKEY 환경변수 누락')

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: APPKEY,
      secretkey: SECRETKEY,
    }),
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`oauth ${res.status}: ${text}`)

  let data: { token?: string; access_token?: string; expires_in?: number | string; expires_dt?: string }
  try { data = JSON.parse(text) } catch { throw new Error(`oauth 응답 파싱 실패: ${text.slice(0, 200)}`) }

  const raw = data.token || data.access_token
  if (!raw) throw new Error(`토큰 없음: ${text.slice(0, 200)}`)
  const token = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`

  // 만료 시각 계산
  let expires = now + 23 * 3600 * 1000  // 기본 23시간
  if (data.expires_in) {
    expires = now + Number(data.expires_in) * 1000
  }
  if (data.expires_dt) {
    const m = String(data.expires_dt).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
    if (m) expires = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
  }

  tokenCache = { token, expires }
  return token
}

export function getCachedTokenExpiry(): number | null {
  return tokenCache?.expires ?? null
}

// ─── TR 호출 ───
// 키움 REST는 TR마다 endpoint가 다름. api-id prefix로 매핑.
function endpointForApiId(apiId: string): string {
  if (apiId.startsWith('kt0'))                 return '/api/dostk/acnt'      // 계좌
  if (apiId.startsWith('kt1'))                 return '/api/dostk/ordr'      // 주문
  if (apiId.startsWith('kt9'))                 return '/api/dostk/crdtordr'  // 신용주문
  if (apiId === 'ka10001' || apiId === 'ka10002' || apiId === 'ka10003' || apiId === 'ka10004' ||
      apiId === 'ka10095' || apiId === 'ka10100')                return '/api/dostk/stkinfo'
  if (apiId === 'ka10081' || apiId === 'ka10079' || apiId === 'ka10080')   return '/api/dostk/chart'
  if (apiId.startsWith('ka103') || apiId.startsWith('ka102'))    return '/api/dostk/mrkcond'
  if (apiId.startsWith('ka102'))               return '/api/dostk/sect'
  // 기본
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

export async function callKiwoomTR(opts: TROpts): Promise<TRResult> {
  const { apiId, body, contYn = 'N', nextKey = '', endpoint } = opts
  const token = await getKiwoomToken()
  const url = `${API_BASE}${endpoint || endpointForApiId(apiId)}`

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

// ─── 헬퍼: 키움의 "+/-" 접두사 숫자 파싱 ───
// "+72500" → { value: 72500, sign: 'up' }
// "-500"   → { value: 500,   sign: 'down' }
export function parseKiwoomNum(v: unknown): { value: number; sign: 'up' | 'down' | 'flat' } {
  if (v == null) return { value: 0, sign: 'flat' }
  const s = String(v).trim()
  if (!s) return { value: 0, sign: 'flat' }
  if (s.startsWith('+')) return { value: Math.abs(Number(s.slice(1))) || 0, sign: 'up' }
  if (s.startsWith('-')) return { value: Math.abs(Number(s.slice(1))) || 0, sign: 'down' }
  return { value: Math.abs(Number(s)) || 0, sign: 'flat' }
}
