import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) return NextResponse.json({ error: 'GitHub 설정 없음' }, { status: 500 })

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/YouTube`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) {
    if (res.status === 404) return NextResponse.json([]) // 폴더 없으면 빈 배열
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }

  const data = await res.json()
  const files = (Array.isArray(data) ? data : [])
    .filter((f: { type: string }) => f.type === 'file')
    .map((f: { name: string; path: string; sha: string; size: number }) => ({
      name: f.name.replace('.md', ''),
      path: f.path,
      sha: f.sha,
      size: f.size,
    }))
    .reverse() // 최신순

  return NextResponse.json(files)
}
