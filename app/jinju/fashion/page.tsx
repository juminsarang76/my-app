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
  '에이블리': 'https://m.a-bly.com/search?q=',
  '무신사': 'https://www.musinsa.com/search/musinsa/goods?q=',
}

type FashionItem = {
  아이템: string
  사진설명: string
  설명: string
  출처: string
  검색어: string
  imageUrl?: string | null
  productUrl?: string
}

type Category = {
  category: string
  icon: string
  items: FashionItem[]
}

type ApiResult = {
  summary: string
  categories: Category[]
  provider?: string
  generatedAt: string
  cached?: boolean
  error?: string
}

function FashionImage({ src, alt, width, height, style }: {
  src: string; alt: string; width: number; height: number; style?: React.CSSProperties
}) {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  return (
    <div style={{ position: 'relative', width, height, borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', flexShrink: 0, ...style }}>
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #BAE6FD', borderTopColor: '#0369A1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👗</div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ width, height, objectFit: 'cover', display: status === 'done' ? 'block' : 'none' }}
        onLoad={() => setStatus('done')} onError={() => setStatus('error')} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function FashionPage() {
  const [data, setData] = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const fetch조사 = useCallback(async () => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res = await fetch('/api/fashion')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setHasSearched(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '조사 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  const th: React.CSSProperties = {
    padding: '10px 14px', background: '#0369A1', color: 'white',
    fontSize: 12, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid #e0f0ff',
    verticalAlign: 'top', fontSize: 13, lineHeight: 1.65,
  }

  // 전체 아이템 flat list (갤러리용)
  const allItems: { item: FashionItem; catIdx: number; itemIdx: number; catIcon: string }[] =
    data?.categories?.flatMap((cat, ci) =>
      cat.items.map((item, ii) => ({ item, catIdx: ci, itemIdx: ii, catIcon: cat.icon }))
    ) ?? []

  return (
    <main style={{ maxWidth: 920, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'sans-serif' }}>
      <Link href="/jinju" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← 진주</Link>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, margin: '16px 0 6px' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0369A1' }}>진주 패션 조사</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>에이블리 · 무신사 기반 중학교 여학생 패션 트렌드</p>
        </div>
        <button onClick={fetch조사} disabled={loading} style={{
          background: loading ? '#94a3b8' : '#1D9E75', color: 'white', border: 'none',
          borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
        }}>
          {loading ? '조사 중…' : hasSearched ? '다시 조사하기' : '조사하기'}
        </button>
      </div>

      {/* 프로필 태그 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, marginTop: 14 }}>
        {PROFILE.map(({ label, value }) => (
          <div key={label} style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '5px 13px', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{label} </span>
            <span style={{ fontWeight: 600, color: '#0369A1' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 미조사 상태 */}
      {!loading && !hasSearched && !error && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👗</div>
          <p style={{ fontSize: 15, marginBottom: 6 }}>에이블리 · 무신사 최신 패션 트렌드를 조사합니다</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>위의 조사하기 버튼을 눌러주세요</p>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 16, display: 'inline-block', animation: 'spin2 1s linear infinite' }}>👗</div>
          <p style={{ fontSize: 15 }}>에이블리 · 무신사 트렌드 조사 중…</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>AI가 최신 패션을 분석하고 있어요</p>
          <style>{`@keyframes spin2 { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* 에러 (한도 초과 포함) */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
            {error.includes('한도 초과') ? '⚠️ 모든 AI 서비스 일일 한도 초과' : '조사 중 오류 발생'}
          </div>
          <div style={{ fontSize: 13, color: '#991b1b' }}>
            {error.includes('한도 초과')
              ? 'Groq · Gemini · Cerebras 세 곳 모두 오늘 사용량이 소진되었습니다. 내일 다시 시도해주세요.'
              : error}
          </div>
        </div>
      )}

      {/* 결과 */}
      {data && !loading && (
        <>
          {/* ── 트렌드 요약 + 전체 사진 갤러리 ── */}
          <div style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 16, padding: '20px 24px', marginBottom: 32 }}>
            {/* 요약 텍스트 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0369A1' }}>2026 트렌드 요약</span>
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {data.provider && (
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                    {data.provider}
                  </span>
                )}
                {data.cached && <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 4, padding: '1px 7px' }}>캐시</span>}
                {data.generatedAt && new Date(data.generatedAt).toLocaleString('ko-KR')}
              </span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#334155', margin: '0 0 18px' }}>
              {data.summary || '현재 중학교 여학생들 사이에서 K-패션 트렌드가 인기를 끌고 있습니다.'}
            </p>

            {/* 전체 아이템 사진 갤러리 — 클릭 시 해당 항목으로 스크롤 */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {allItems.map(({ item, catIdx, itemIdx }) => {
                const id = `item-${catIdx}-${itemIdx}`
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                  >
                    {item.imageUrl
                      ? <FashionImage src={item.imageUrl} alt={item.아이템} width={72} height={90}
                          style={{ borderRadius: 8, border: '2px solid #BAE6FD', transition: 'border-color 0.2s' }} />
                      : <div style={{ width: 72, height: 90, background: '#dbeafe', borderRadius: 8, border: '2px solid #BAE6FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👗</div>
                    }
                    <span style={{ fontSize: 10, color: '#475569', textAlign: 'center', maxWidth: 72, lineHeight: 1.3, wordBreak: 'keep-all' }}>
                      {item.아이템}
                    </span>
                  </a>
                )
              })}
            </div>
          </div>

          {/* ── 카테고리별 테이블 ── */}
          {data.categories?.map((section, ci) => (
            <section key={section.category} style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111' }}>
                {section.icon} {section.category}
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #BAE6FD', borderRadius: 12, overflow: 'hidden' }}>
                  <thead>
                    <tr>
                      {['#', '착용 이미지', '아이템', '사진 설명', '설명', '출처'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items?.map((item, ii) => {
                      const link = item.productUrl
                        || (SOURCE_LINKS[item.출처]
                          ? `${SOURCE_LINKS[item.출처]}${encodeURIComponent(item.검색어)}`
                          : null)
                      return (
                        <tr key={ii} id={`item-${ci}-${ii}`} style={{ background: ii % 2 === 0 ? 'white' : '#f8fbff' }}>
                          <td style={{ ...td, color: '#0ea5e9', fontWeight: 700, width: 28 }}>{ii + 1}</td>
                          <td style={{ ...td, padding: '8px 10px', width: 104 }}>
                            {item.imageUrl
                              ? <FashionImage src={item.imageUrl} alt={item.아이템} width={88} height={116} />
                              : <div style={{ width: 88, height: 116, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👗</div>
                            }
                          </td>
                          <td style={{ ...td, fontWeight: 600, minWidth: 110 }}>
                            {link
                              ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'none' }}>{item.아이템}</a>
                              : item.아이템
                            }
                          </td>
                          <td style={{ ...td, color: '#7c3aed', fontSize: 12, minWidth: 150 }}>{item.사진설명}</td>
                          <td style={{ ...td, minWidth: 180 }}>{item.설명}</td>
                          <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {link
                              ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#1D9E75', textDecoration: 'none', fontWeight: 600 }}>{item.출처} →</a>
                              : <span style={{ color: '#94a3b8' }}>{item.출처}</span>
                            }
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
            * AI가 에이블리·무신사 트렌드를 기반으로 생성한 추천입니다. 이미지는 카카오 이미지 검색 결과이며 실제 상품과 다를 수 있습니다.
          </p>
        </>
      )}
    </main>
  )
}
