import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo || !path) return NextResponse.json({ error: '설정 없음' }, { status: 400 })

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })

  const data = await res.json()
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return NextResponse.json({ content })
}
