import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const CATEGORIES = [
  { key: 'quantum_news', label: '양자뉴스' },
  { key: 'youtube_news', label: '유튜브' },
  { key: 'yozm_news', label: '요즘IT' },
  { key: 'geeks_news', label: 'Geeks' },
] as const

type NewsItem = {
  title: string
  link: string
  pubDate: string
  summary: string
}

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('date', date)
    .single()

  if (!report) {
    return (
      <main style={{ maxWidth: 680, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#888' }}>리포트를 찾을 수 없습니다.</p>
        <Link href="/reports" style={{ color: '#1D9E75', fontSize: 14 }}>← 목록으로</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 680, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <Link href="/reports" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← 목록으로</Link>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '16px 0 4px' }}>정기요약 {date}</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>{date}</p>

      <div style={{ background: '#E0F2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 8 }}>전체 요약</div>
        <div style={{ fontSize: 14, lineHeight: 1.9, color: '#333', whiteSpace: 'pre-line' }}>
          {report.summary}
        </div>
      </div>

      {CATEGORIES.map(cat => {
        const items: NewsItem[] = report[cat.key] ?? []
        return (
          <section key={cat.key} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>{cat.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((news, i) => (
                <div key={i} style={{ padding: '14px 18px', border: '1px solid #BAE6FD', borderRadius: 10, background: '#EFF8FF' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 4, lineHeight: 1.5 }}>
                    {news.summary}
                  </div>
                  {news.link ? (
                    <a
                      href={news.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}
                    >
                      {news.title}
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, color: '#999' }}>{news.title}</div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <p style={{ fontSize: 13, color: '#bbb', padding: '8px 0' }}>뉴스가 없습니다.</p>
              )}
            </div>
          </section>
        )
      })}
    </main>
  )
}
