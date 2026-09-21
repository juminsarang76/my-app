import {
  getState, setState, KAKAO_TOKEN_KEY, KAKAO_SEND_KEY,
  type KakaoTokenState, type SendState,
} from './state'

// 카카오 "나에게 보내기".
//
// 액세스 토큰은 6시간, 리프레시 토큰은 60일이다.
// 예전에는 갱신한 액세스 토큰을 메모리에만 두고 버려서, 요청마다 만료된 환경변수 토큰으로
// 시작해 매번 재발급을 거쳤다. 환경변수와 실제 유효한 토큰이 어긋나면 조용히 실패했다.
// 이제 갱신 결과를 app_state 에 저장해 다음 요청이 그대로 쓴다.
// (app_state 테이블이 없으면 저장만 건너뛰고 기존과 동일하게 동작한다)

const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

// 만료 1분 전이면 미리 갱신한다
const SKEW_MS = 60 * 1000

async function refreshToken(): Promise<string> {
  const stored = await getState<KakaoTokenState>(KAKAO_TOKEN_KEY)
  const refresh = stored?.refreshToken || process.env.KAKAO_REFRESH_TOKEN!

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY!,
      refresh_token: refresh,
      ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Kakao token refresh failed: ${res.status} ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  await setState(KAKAO_TOKEN_KEY, {
    accessToken: data.access_token,
    // 카카오는 리프레시 토큰의 잔여 기간이 짧을 때만 새 값을 준다. 받으면 반드시 갈아끼운다.
    refreshToken: data.refresh_token ?? refresh,
    expiresAt: Date.now() + (data.expires_in ?? 21599) * 1000,
    updatedAt: new Date().toISOString(),
  } satisfies KakaoTokenState)

  return data.access_token as string
}

async function currentToken(): Promise<string> {
  const stored = await getState<KakaoTokenState>(KAKAO_TOKEN_KEY)
  if (stored?.accessToken && stored.expiresAt - SKEW_MS > Date.now()) return stored.accessToken
  if (stored) return refreshToken()
  // 저장된 게 없으면 환경변수로 시작한다 (최초 1회)
  return process.env.KAKAO_ACCESS_TOKEN!
}

async function sendWithToken(message: string, token: string): Promise<Response> {
  return fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: { web_url: process.env.NEXT_PUBLIC_API_URL },
      }),
    }),
  })
}

export async function sendKakaoMessage(message: string, label = ''): Promise<void> {
  try {
    let res = await sendWithToken(message, await currentToken())

    if (res.status === 401) {
      res = await sendWithToken(message, await refreshToken())
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Kakao send failed: ${res.status} ${body.slice(0, 200)}`)
    }

    await setState(KAKAO_SEND_KEY, {
      ok: true, at: new Date().toISOString(), label,
    } satisfies SendState)
  } catch (e) {
    // 실패를 눈에 보이게 남긴다 — 예전에는 흔적 없이 사라져 며칠 뒤에야 알아차렸다
    await setState(KAKAO_SEND_KEY, {
      ok: false,
      at: new Date().toISOString(),
      label,
      error: e instanceof Error ? e.message : String(e),
    } satisfies SendState)
    throw e
  }
}

// 마지막 전송 결과 (화면에 배지로 띄우는 용도)
export async function lastKakaoSend(): Promise<SendState | null> {
  return getState<SendState>(KAKAO_SEND_KEY)
}
