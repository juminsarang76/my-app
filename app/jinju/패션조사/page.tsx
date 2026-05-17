'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const PROFILE = [
  { label: '키', value: '159cm' },
  { label: '몸무게', value: '38kg' },
  { label: '성별', value: '여자' },
  { label: '나이', value: '14살' },
  { label: '체형', value: '마른 편' },
]

const SOURCE_LINKS: Record<string, string> = {
  '에이블리': 'https://a.ably.kr/search?q=',
  '무신사': 'https://www.musinsa.com/search/musinsa/goods?q=',
}

type FashionItem = {
  아이템: string
  사진설명: string
  설명: string
  출처: string
  검색어: string
  imageUrl?: string
}

type Category = {
  category: string
  icon: string
  items: FashionItem[]
}

type ApiResult = {
  categories: Category[]
  generatedAt: string
  error?: string
}

export default function FashionPage() {
  const [data, setData] = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetch조사 = useCallback(async () => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res = await fetch('/api/fashion')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '조사 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch조사() }, [fetch조사])

  const th: React.CSSProperties = {
    padding: '10px 14px', background: '#0369A1', color: 'white',
    fontSize: 12, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '12px 14px', borderBottom: '1px solid #e0f0ff',
    verticalAlign: 'top', fontSize: 13, lineHeight: 1.65,
  }

  return (
    <main style={{ maxWidth: 860, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'sans-serif' }}>
      <Link href="/진주" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← 진주</Link>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, margin: '16px 0 6px' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0369A1' }}>진주 패션 조사</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            에이블리 · 무신사 기반 중학교 여학생 패션 트렌드
          </p>
        </div>
        <button
          onClick={fetch조사}
          disabled={loading}
          style={{
            background: loading ? '#94a3b8' : '#1D9E75',
            color: 'white', border: 'none', borderRadius: 8,
            padding: '8px 18px', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '조사 중…' : '다시 조사하기'}
        </button>
      </div>

      {/* 프로필 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28, marginTop: 16 }}>
        {PROFILE.map(({ label, value }) => (
          <div key={label} style={{
            background: '#EFF8FF', border: '1px solid #BAE6FD',
            borderRadius: 8, padding: '5px 13px', fontSize: 13,
          }}>
            <span style={{ color: '#64748b' }}>{label} </span>
            <span style={{ fontWeight: 600, color: '#0369A1' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 16, animation: 'spin 1s linear infinite', display: 'inline-block' }}>👗</div>
          <p style={{ fontSize: 15 }}>에이블리 · 무신사 트렌드 조사 중…</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>AI가 최신 패션을 분석하고 있어요</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '20px 24px', color: '#dc2626', fontSize: 14 }}>
          조사 중 오류가 발생했어요: {error}
        </div>
      )}

      {/* 결과 */}
      {data && !loading && (
        <>
          {data.generatedAt && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 20 }}>
              조사 시각: {new Date(data.generatedAt).toLocaleString('ko-KR')}
            </p>
          )}

          {data.categories?.map((section) => (
            <section key={section.category} style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: '#111' }}>
                {section.icon} {section.category}
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%', borderCollapse: 'collapse',
                  background: 'white', border: '1px solid #BAE6FD',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <thead>
                    <tr>
                      {['#', '착용 이미지', '아이템', '사진 설명', '설명', '출처'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items?.map((item, i) => {
                      const link = SOURCE_LINKS[item.출처]
                        ? `${SOURCE_LINKS[item.출처]}${encodeURIComponent(item.검색어)}`
                        : null
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fbff' }}>
                          <td style={{ ...td, color: '#0ea5e9', fontWeight: 700, width: 28 }}>{i + 1}</td>
                          <td style={{ ...td, width: 100, padding: '8px 10px' }}>
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.아이템}
                                width={90}
                                height={120}
                                style={{ borderRadius: 8, objectFit: 'cover', display: 'block' }}
                                loading="lazy"
                              />
                            ) : (
                              <div style={{ width: 90, height: 120, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👗</div>
                            )}
                          </td>
                          <td style={{ ...td, fontWeight: 600, minWidth: 110 }}>{item.아이템}</td>
                          <td style={{ ...td, color: '#7c3aed', fontSize: 12, minWidth: 150 }}>{item.사진설명}</td>
                          <td style={{ ...td, minWidth: 180 }}>{item.설명}</td>
                          <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#1D9E75', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {item.출처} →
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>{item.출처}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
            * AI가 에이블리·무신사 트렌드를 기반으로 생성한 추천입니다. 출처 링크는 해당 플랫폼 검색 결과로 연결됩니다.
          </p>
        </>
      )}
    </main>
  )
}
