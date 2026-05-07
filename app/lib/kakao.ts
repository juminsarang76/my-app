async function refreshToken(): Promise<string> {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY!,
      refresh_token: process.env.KAKAO_REFRESH_TOKEN!,
    }),
  })
  if (!res.ok) throw new Error(`Kakao token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

async function sendWithToken(message: string, token: string): Promise<Response> {
  return fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
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

export async function sendKakaoMessage(message: string): Promise<void> {
  let token = process.env.KAKAO_ACCESS_TOKEN!
  let res = await sendWithToken(message, token)

  if (res.status === 401) {
    token = await refreshToken()
    res = await sendWithToken(message, token)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kakao send failed: ${res.status} ${body}`)
  }
}
