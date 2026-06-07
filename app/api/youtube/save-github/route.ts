import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO // "juminsarang76/youtube_script"

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN 또는 GITHUB_REPO가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  const { filename, content } = await req.json()
  if (!filename || !content) {
    return NextResponse.json({ error: '파일명 또는 내용이 없습니다.' }, { status: 400 })
  }

  const path = `YouTube/${filename}.md`
  const encoded = Buffer.from(content, 'utf-8').toString('base64')

  // 기존 파일 SHA 조회 (같은 이름 파일 업데이트 시 필요)
  let sha: string | undefined
  try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    )
    if (checkRes.ok) {
      const existing = await checkRes.json()
      sha = existing.sha
    }
  } catch { /* 새 파일이면 무시 */ }

  // 파일 생성 또는 업데이트
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `📝 Add YouTube transcript: ${filename}`,
        content: encoded,
        ...(sha ? { sha } : {}),
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `GitHub API 오류: ${err}` }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({
    ok: true,
    url: data.content?.html_url ?? `https://github.com/${repo}/blob/main/${path}`,
    path,
  })
}
