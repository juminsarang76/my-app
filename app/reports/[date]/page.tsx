import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  console.log('date params:', date)
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
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '16px 0 4px' }}>{date}_양자뉴스</h1>
<p style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>{date}</p>
      <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '16px 20px', marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 8 }}>전체 요약</div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: '#333' }}>{report.summary}</div>
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>IONQ 뉴스</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {report.ionq_news?.map((news: any, i: number) => (
          <div key={i} style={{ padding: '14px 18px', border: '1px solid #eee', borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 6 }}>{news.summary}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{news.title}</div>
            <a href={news.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1D9E75', textDecoration: 'none' }}>
              원문 보기 →
            </a>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>양자컴퓨터 뉴스</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {report.quantum_news?.map((news: any, i: number) => (
          <div key={i} style={{ padding: '14px 18px', border: '1px solid #eee', borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 6 }}>{news.summary}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{news.title}</div>
            <a href={news.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1D9E75', textDecoration: 'none' }}>
              원문 보기 →
            </a>
          </div>
        ))}
      </div>
    </main>
  )
}