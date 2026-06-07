import { NextRequest, NextResponse } from 'next/server'

function blockToText(block: {
  type: string
  paragraph?: { rich_text: { plain_text: string }[] }
  heading_1?: { rich_text: { plain_text: string }[] }
  heading_2?: { rich_text: { plain_text: string }[] }
  heading_3?: { rich_text: { plain_text: string }[] }
  code?: { rich_text: { plain_text: string }[] }
  bulleted_list_item?: { rich_text: { plain_text: string }[] }
}): string {
  const getText = (arr?: { plain_text: string }[]) => arr?.map(t => t.plain_text).join('') ?? ''
  switch (block.type) {
    case 'heading_1': return `# ${getText(block.heading_1?.rich_text)}\n`
    case 'heading_2': return `## ${getText(block.heading_2?.rich_text)}\n`
    case 'heading_3': return `### ${getText(block.heading_3?.rich_text)}\n`
    case 'paragraph': return `${getText(block.paragraph?.rich_text)}\n`
    case 'code': return `\`\`\`\n${getText(block.code?.rich_text)}\n\`\`\`\n`
    case 'bulleted_list_item': return `• ${getText(block.bulleted_list_item?.rich_text)}\n`
    default: return ''
  }
}

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('id')
  const key = process.env.NOTION_API_KEY
  if (!key || !pageId) return NextResponse.json({ error: '설정 없음' }, { status: 400 })

  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: { Authorization: `Bearer ${key}`, 'Notion-Version': '2022-06-28' },
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })

  const data = await res.json()
  const content = (data.results ?? []).map(blockToText).join('')
  return NextResponse.json({ content })
}
