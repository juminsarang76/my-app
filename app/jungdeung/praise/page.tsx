import Link from 'next/link'
import { getAllPraiseDates } from '@/app/lib/praise'

export default function PraiseListPage() {
  const weeks = getAllPraiseDates()

  return (
    <div style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Link href="/jungdeung" style={{ color: '#0369A1', textDecoration: 'none', fontSize: 13 }}>
          중등부
        </Link>
        <span style={{ color: '#94a3b8' }}>/</span>
        <span style={{ fontSize: 13, color: '#64748b' }}>찬양 선곡</span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>찬양 선곡</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 32 }}>
        매주 일요일 선정되는 중등부 찬양 5곡 — 선곡을 클릭해 악보와 코드를 확인하세요.
      </p>

      {weeks.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: '#F8FAFC',
          borderRadius: 12,
          color: '#94a3b8',
        }}>
          아직 등록된 선곡이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {weeks.map((week, idx) => (
            <Link
              key={week.date}
              href={`/jungdeung/praise/${week.date}`}
              style={{
                display: 'block',
                padding: '20px 24px',
                background: '#EFF8FF',
                border: '1px solid #BAE6FD',
                borderRadius: 12,
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0369A1' }}>
                      {week.displayDate} 선곡
                    </span>
                    {idx === 0 && (
                      <span style={{
                        background: '#1D9E75',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 20,
                      }}>
                        최신
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    테마: {week.theme} &nbsp;·&nbsp; {week.songs.length}곡
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {week.songs.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      style={{
                        background: '#E0F2FE',
                        color: '#0369A1',
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {s.title}
                    </span>
                  ))}
                  {week.songs.length > 3 && (
                    <span style={{
                      background: '#E0F2FE',
                      color: '#0369A1',
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}>
                      +{week.songs.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
