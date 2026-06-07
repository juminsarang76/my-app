import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.NOTION_API_KEY
  const pageId = process.env.NOTION_PAGE_ID
  if (!key || !pageId) return NextResponse.json({ error: 'Notion 설정 없음' }, { status: 500 })

  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
    headers: { Authorization: `Bearer ${key}`, 'Notion-Version': '2022-06-28' },
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })

  const data = await res.json()
  const pages = (data.results ?? [])
    .filter((b: { type: string }) => b.type === 'child_page')
    .map((b: { id: string; created_time: string; child_page: { title: string } }) => ({
      id: b.id,
      title: b.child_page?.title ?? '제목 없음',
      createdAt: b.created_time,
    }))

  return NextResponse.json(pages)
}
