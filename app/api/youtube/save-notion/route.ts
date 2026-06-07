import { NextRequest, NextResponse } from 'next/server'

// Notion API — 자막을 Notion 페이지로 저장
// 필요 환경변수: NOTION_API_KEY, NOTION_PAGE_ID (부모 페이지)

// 문장 배열 → Notion paragraph 블록 (문장마다 한 블록, 5문장마다 빈 줄)
function toParaBlocks(sentences: string[]): object[] {
  const blocks: object[] = []
  sentences.forEach((sentence, i) => {
    // 문장 하나 = paragraph 블록 하나
    const chunks = sentence.match(/[\s\S]{1,1900}/g) ?? [sentence]
    for (const chunk of chunks) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] },
      })
    }
    // 5문장마다 빈 줄
    if ((i + 1) % 5 === 0) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } })
    }
  })
  return blocks
}

export async function POST(req: NextRequest) {
  const notionKey = process.env.NOTION_API_KEY
  const parentPageId = process.env.NOTION_PAGE_ID

  if (!notionKey || !parentPageId) {
    return NextResponse.json(
      { error: 'NOTION_API_KEY 또는 NOTION_PAGE_ID가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  const { videoId, videoTitle, filename, items, translated, summary } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const title = filename || videoTitle || videoId

  const blocks: object[] = []

  // 영상 링크
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: {
          content: `🎬 https://www.youtube.com/watch?v=${videoId}`,
          link: { url: `https://www.youtube.com/watch?v=${videoId}` },
        },
      }],
    },
  })

  // 한글 요약
  if (summary) {
    blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 한글 요약' } }] } })
    const chunks = summary.match(/[\s\S]{1,1900}/g) ?? [summary]
    for (const chunk of chunks) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] } })
    }
  }

  // 한글 번역 — 타임스탬프 없이 읽기 편한 단락
  if (translated?.length) {
    blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🇰🇷 한글 번역' } }] } })
    const sentences = (items as { text: string }[]).map((item, i) => translated[i] || item.text)
    blocks.push(...toParaBlocks(sentences))
  }

  // 원문 — 타임스탬프 없이 문장별 단락
  blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📝 원문' } }] } })
  const origSentences = (items as { text: string }[]).map(item => item.text)
  blocks.push(...toParaBlocks(origSentences))

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
