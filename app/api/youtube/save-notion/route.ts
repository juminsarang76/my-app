import { NextRequest, NextResponse } from 'next/server'

// Notion API — 자막을 Notion 페이지로 저장
// 필요 환경변수: NOTION_API_KEY, NOTION_PAGE_ID (부모 페이지)
export async function POST(req: NextRequest) {
  const notionKey = process.env.NOTION_API_KEY
  const parentPageId = process.env.NOTION_PAGE_ID

  if (!notionKey || !parentPageId) {
    return NextResponse.json(
      { error: 'NOTION_API_KEY 또는 NOTION_PAGE_ID가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  const { videoId, items, translated, summary } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const title = `YouTube 자막 — ${videoId}`

  // Notion 블록 구성
  const blocks: object[] = []

  // 영상 링크
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: `🎬 https://www.youtube.com/watch?v=${videoId}`, link: { url: `https://www.youtube.com/watch?v=${videoId}` } },
      }],
    },
  })

  // 한글 요약
  if (summary) {
    blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 한글 요약' } }] } })
    // 요약을 2000자 단위로 분할 (Notion 블록 제한)
    const chunks = summary.match(/[\s\S]{1,2000}/g) ?? [summary]
    for (const chunk of chunks) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] } })
    }
  }

  // 번역 자막
  if (translated?.length) {
    blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🇰🇷 한글 번역' } }] } })
    const translatedText = items.map((item: { start: number; text: string }, i: number) => {
      const m = Math.floor(item.start / 60).toString().padStart(2, '0')
      const s = (item.start % 60).toString().padStart(2, '0')
      return `[${m}:${s}] ${translated[i] || item.text}`
    }).join('\n')
    // 2000자 단위 분할
    const chunks = translatedText.match(/[\s\S]{1,2000}/g) ?? [translatedText]
    for (const chunk of chunks) {
      blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: chunk } }], language: 'plain text' } })
    }
  }

  // 원문 자막
  blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📝 원문 자막' } }] } })
  const originalText = items.map((item: { start: number; text: string }) => {
    const m = Math.floor(item.start / 60).toString().padStart(2, '0')
    const s = (item.start % 60).toString().padStart(2, '0')
    return `[${m}:${s}] ${item.text}`
  }).join('\n')
  const origChunks = originalText.match(/[\s\S]{1,2000}/g) ?? [originalText]
  for (const chunk of origChunks) {
    blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: chunk } }], language: 'plain text' } })
  }

  // Notion 페이지 생성 (최대 100 블록/요청)
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ type: 'text', text: { content: title } }] },
      },
      children: blocks.slice(0, 100),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Notion API 오류: ${err}` }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ ok: true, url: data.url })
}
