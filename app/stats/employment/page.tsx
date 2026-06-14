'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart } from '@/app/components/charts/LineChart'
import { BarChart } from '@/app/components/charts/BarChart'
import { StackedBarChart } from '@/app/components/charts/StackedBarChart'

/* ── 타입 ───────────────────────────────────────────────── */
interface MonthRow {
  date: string
  total: number
  male: number
  female: number
  urate: number
  erate: number
}
interface IndRow { name: string; value: number }
interface IndSeries { name: string; data: { date: string; value: number }[] }
interface ApiData {
  monthly: MonthRow[]
  industry: IndRow[]
  industryMonthly?: IndSeries[]
  industryUrate?: IndSeries[]
  ageMonthly?: IndSeries[]
  restYouth?: { date: string; value: number }[]
  source: string
  demo: boolean
}

const IND_COLORS = ['#0369A1','#ec4899','#1D9E75','#f59e0b','#8b5cf6','#06b6d4']

/* ── KPI 카드 ───────────────────────────────────────────── */
function KpiCard({ label, value, unit, sub, color = '#0369A1' }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #BAE6FD',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── 메인 페이지 ────────────────────────────────────────── */
interface NewsItem { date: string; title: string; body: string; sourceTitle?: string; sourceUrl?: string }
interface NewsData { fetchedAt: string; count: number; provider?: string; summary: string; news: NewsItem[] }

export default function EmploymentPage() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'total' | 'compare' | 'rate' | 'industry'>('total')
  const [news, setNews] = useState<NewsData | null>(null)
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats/employment')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })

    fetch('/api/stats/employment-news')
      .then(r => r.json())
      .then(d => { setNews(d); setNewsLoading(false) })
      .catch(() => setNewsLoading(false))
  }, [])

  const latest = data?.monthly.at(-1)
  const prev12 = data?.monthly.at(-13)

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'total',    label: '취업자 추이' },
    { key: 'compare',  label: '비교' },
    { key: 'rate',     label: '고용률·실업률' },
    { key: 'industry', label: '산업별' },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f7ff' }}>
      {/* 헤더 */}
      <header style={{
        background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        color: '#fff', padding: '32px 24px 28px',
      }}>
        <Link href="/stats" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>
          ← 통계 홈
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>
          취업 통계
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>
          경제활동인구조사 · 월별 · 2024~2026
          {data?.demo && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px',
              background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            }}>데모 데이터 (KOSIS_API_KEY 미설정)</span>
          )}
          {!data?.demo && data && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px',
              background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            }}>KOSIS 실데이터</span>
          )}
        </p>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 }}>
            데이터 불러오는 중…
          </div>
        )}
        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#9f1239' }}>
            오류: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
              <KpiCard label="최신 취업자" value={latest?.total ?? 0} unit="천명"
                sub={latest?.date} color="#0369A1" />
              <KpiCard label="고용률" value={latest?.erate ?? 0} unit="%"
                sub="15세 이상" color="#1D9E75" />
              <KpiCard label="실업률" value={latest?.urate ?? 0} unit="%"
                sub={latest?.date} color="#f97316" />
              <KpiCard
                label="전년 동월 대비"
                value={prev12 ? `${((( (latest?.total??0) - prev12.total) / prev12.total)*100).toFixed(1)}%` : '-'}
                sub="취업자 증감"
                color={prev12 && latest && latest.total >= prev12.total ? '#1D9E75' : '#ef4444'}
              />
            </div>

            {/* 일주일 내 최신 뉴스 요약 */}
            <div style={{
              background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14,
              padding: '18px 20px', marginBottom: 28,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📰</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>최근 1주일 고용 뉴스</span>
                {news?.provider && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#EFF8FF', color: '#0369A1' }}>
                    {news.provider} 요약
                  </span>
                )}
              </div>

              {newsLoading && (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>뉴스 불러오는 중…</div>
              )}

              {!newsLoading && news && (
                <>
                  {news.summary && (
                    <div style={{
                      background: '#E0F2FE', borderRadius: 8, padding: '10px 14px',
                      fontSize: 13, color: '#0c4a6e', marginBottom: 14, lineHeight: 1.6,
                    }}>
                      💡 {news.summary}
                    </div>
                  )}
                  {news.news.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {news.news.map((n, i) => (
                        <div key={i} style={{ borderLeft: '3px solid #BAE6FD', paddingLeft: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>{n.date}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{n.title}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>{n.body}</div>
                          {n.sourceUrl && (
                            <a href={n.sourceUrl} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: '#1D9E75', textDecoration: 'none' }}>
                              ↗ {n.sourceTitle || '원문'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>최근 1주일 내 관련 뉴스가 없습니다.</div>
                  )}
                </>
              )}
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === t.key ? 700 : 400,
                  color: activeTab === t.key ? '#0369A1' : '#94a3b8',
                  borderBottom: `2px solid ${activeTab === t.key ? '#0369A1' : 'transparent'}`,
                  marginBottom: '-2px',
                }}>{t.label}</button>
              ))}
            </div>

            {/* 차트 영역 */}
            <div style={{ background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14, padding: '24px 20px' }}>

              {activeTab === 'total' && (
                <>
                  <LineChart
                    title="월별 취업자 수 (단위: 천명)"
                    data={data.monthly as unknown as Record<string,number>[]}
                    keys={['total']}
                    colors={['#0369A1']}
                    labels={['취업자 (천명)']}
                  />
                  {(data.industryMonthly?.length ?? 0) > 0 && (
                    <StackedBarChart
                      title="주요 산업별 취업자 추이 (누적, 단위: 천명)"
                      series={data.industryMonthly!}
                      colors={IND_COLORS}
                      unit="천"
                    />
                  )}
                </>
              )}

              {activeTab === 'compare' && (
                <>
                  {(data.ageMonthly?.length ?? 0) > 0 ? (
                    <StackedBarChart
                      title="나이별 취업자 비교 (누적, 단위: 천명)"
                      series={data.ageMonthly!}
                      colors={IND_COLORS}
                      unit="천"
                    />
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>
                      나이별 데이터가 없습니다.
                    </div>
                  )}
                  {(data.restYouth?.length ?? 0) > 0 && (
                    <LineChart
                      title="20대 '쉬었음' 인구 (단위: 천명)"
                      data={data.restYouth as unknown as Record<string,number>[]}
                      keys={['value']}
                      colors={['#ef4444']}
                      labels={["20대 쉬었음"]}
                    />
                  )}
                </>
              )}

              {activeTab === 'rate' && (
                <>
                  <LineChart
                    title="고용률 (%)"
                    data={data.monthly as unknown as Record<string,number>[]}
                    keys={['erate']}
                    colors={['#1D9E75']}
                    labels={['고용률']}
                    unit="%"
                  />
                  <LineChart
                    title="실업률 (%)"
                    data={data.monthly as unknown as Record<string,number>[]}
                    keys={['urate']}
                    colors={['#f97316']}
                    labels={['실업률']}
                    unit="%"
                  />
                  {(data.industryUrate?.length ?? 0) > 0 && (
                    <StackedBarChart
                      title="주요 산업별 실업률 (직전 직장 기준, 누적 %)"
                      series={data.industryUrate!}
                      colors={IND_COLORS}
                      unit="%"
                    />
                  )}
                </>
              )}

              {activeTab === 'industry' && (
                <BarChart
                  title="산업별 취업자 수 (단위: 천명, 최신 기준)"
                  data={data.industry}
                />
              )}
            </div>

            {/* 출처 */}
            <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
              출처: 통계청 경제활동인구조사 (KOSIS)
              {data.demo && ' · 데모 데이터 표시 중 — KOSIS_API_KEY 설정 시 실데이터 자동 전환'}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
