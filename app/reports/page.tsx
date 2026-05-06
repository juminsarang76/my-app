import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

async function fetchIonqPrice() {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/IONQ?interval=1d&range=1d',
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const price = data.chart.result[0].meta.regularMarketPrice
    const prevClose = data.chart.result[0].meta.chartPreviousClose
    const change = ((price - prevClose) / prevClose * 100).toFixed(2)
    const isUp = price >= prevClose
    return { price: price.toFixed(2), change, isUp }
  } catch {
    return null
  }
}

export default async function ReportsPage() {
  const [{ data: reports }, ionq] = await Promise.all([
    supabase.from('reports').select('id, date, summary').order('date', { ascending: false }),
    fetchIonqPrice()
  ])

  return (
    <main style={{ maxWidth: 680, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500 }}>양자뉴스 일일요약</h1>
        {ionq && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>IONQ 현재가</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#111' }}>${ionq.price}</div>
            <div style={{ fontSize: 12, color: ionq.isUp ? '#1D9E75' : '#E24B4A' }}>
              {ionq.isUp ? '▲' : '▼'} {ionq.change}%
            </div>
          </div>
        )}
      </div>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>IONQ 및 양자컴퓨터 최신 뉴스를 매일 요약합니다.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports?.map(report => (
          <Link key={report.id} href={`/reports/${report.date}`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 20px', border: '1px solid #eee', borderRadius: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>
                  {report.date}_양자뉴스
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{report.date}</div>
              </div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                {report.summary.slice(0, 100)}...
              </div>
            </div>
          </Link>
        ))}
        {(!reports || reports.length === 0) && (
          <div style={{ fontSize: 14, color: '#888', textAlign: 'center', padding: '40px 0' }}>
            아직 리포트가 없습니다.
          </div>
        )}
      </div>
    </main>
  )
}