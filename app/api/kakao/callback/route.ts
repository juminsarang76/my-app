import { NextRequest, NextResponse } from 'next/server'

// 카카오 OAuth 인가코드 → 토큰 교환
// 이 URL을 Kakao 콘솔 Redirect URI에 등록 필요
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(
      html(`<h2 style="color:red">❌ 인가 거부</h2><p>${req.nextUrl.searchParams.get('error_description') ?? error}</p>`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (!code) {
    return new NextResponse(
      html('<h2 style="color:red">❌ 인가코드 없음</h2>'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_API_URL}/api/kakao/callback`

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY!,
      redirect_uri: redirectUri,
      code,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    return new NextResponse(
      html(`<h2 style="color:red">❌ 토큰 발급 실패</h2><pre>${JSON.stringify(data, null, 2)}</pre>`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const body = html(`
<h2 style="color:#1D9E75">✅ 토큰 발급 성공!</h2>
<p>아래 값을 <strong>Vercel 환경변수</strong>에 업데이트하세요.</p>

<table style="border-collapse:collapse;width:100%;font-size:13px">
  <tr>
    <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;font-weight:700">KAKAO_ACCESS_TOKEN</td>
    <td style="padding:8px;border:1px solid #e2e8f0;word-break:break-all;font-family:monospace">${data.access_token}</td>
  </tr>
  ${data.refresh_token ? `
  <tr>
    <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;font-weight:700">KAKAO_REFRESH_TOKEN</td>
    <td style="padding:8px;border:1px solid #e2e8f0;word-break:break-all;font-family:monospace">${data.refresh_token}</td>
  </tr>` : ''}
</table>

<p style="margin-top:16px;font-size:12px;color:#64748b">
  액세스 토큰 유효기간: <strong>${Math.floor((data.expires_in ?? 21600) / 3600)}시간</strong>
  ${data.refresh_token_expires_in ? ` / 리프레시 토큰: ${Math.floor(data.refresh_token_expires_in / 86400)}일` : ''}
</p>

<p style="margin-top:8px;font-size:12px;color:#ef4444">
  ⚠️ 이 페이지를 닫기 전에 위 토큰을 복사하여 저장하세요.
</p>
  `)

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function html(content: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>카카오 토큰</title>
<style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1e293b}</style>
</head>
<body>${content}</body>
</html>`
}
