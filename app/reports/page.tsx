import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default async function ReportsPage() {
  const { data: reports } = await supabase
    .from('reports')
    .select('id, date, summary')
    .not('date', 'like', 'rt_%')
    .order('date', { ascending: false })

  return (
    <main style={{ maxWidth: 680, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8 }}>정기요약</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>
        양자뉴스 · 유튜브 · 요즘IT · Geeks 뉴스를 매일 오전 정리합니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports?.map(report => (
          <Link key={report.id} href={`/reports/${report.date}`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 20px', border: '1px solid #BAE6FD', borderRadius: 12, cursor: 'pointer', background: '#EFF8FF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>
                  정기요약 {report.date}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{report.date}</div>
              </div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                {report.summary?.slice(0, 100) ?? ''}...
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
