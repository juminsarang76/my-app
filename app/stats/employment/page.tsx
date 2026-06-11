'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

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

/* ── SVG 라인 차트 (인터랙티브 툴팁 포함) ───────────────── */
function LineChart({
  data, keys, colors, labels, unit = '', title,
}: {
  data: Record<string, number | string>[]
  keys: string[]
  colors: string[]
  labels: string[]
  unit?: string
  title: string
}) {
  const W = 700, H = 220
  const PAD = { t: 20, r: 20, b: 48, l: 66 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const num = (v: number | string | undefined) => (typeof v === 'number' ? v : 0)
  const allVals = data.flatMap(d => keys.map(k => num(d[k]))).filter(v => v !== 0)
  if (!allVals.length) return null
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad  = (maxV - minV) * 0.08 || 1
  const lo = minV - pad, hi = maxV + pad

  const xOf = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * iW
  const yOf = (v: number) => PAD.t + iH - ((v - lo) / (hi - lo)) * iH

  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const xLabels = data.reduce<{ i: number; label: string }[]>((acc, d, i) => {
    const dateStr = String(d.date ?? '')
    if (i % 6 === 0 || i === data.length - 1) acc.push({ i, label: dateStr.slice(0, 7) })
    return acc
  }, [])

  // 마우스 → 가장 가까운 데이터 인덱스
  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const ratio = (x - PAD.l) / iW
    const idx = Math.round(ratio * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, idx)))
  }

  const hoverDate = hover != null ? String(data[hover].date ?? '') : ''

  return (
    <div style={{ marginBottom: 32, position: 'relative' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <span key={k} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 20, height: 3, background: colors[i], display: 'inline-block', borderRadius: 2 }} />
            {labels[i]}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* 눈금선 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(t).toLocaleString()}{unit}
            </text>
          </g>
        ))}
        {/* X 레이블 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        {/* 데이터 라인 */}
        {keys.map((k, ki) => {
          const pts = data.map((d, i) => `${xOf(i)},${yOf(num(d[k]))}`).join(' ')
          return (
            <g key={k}>
              <polyline points={pts} fill="none" stroke={colors[ki]} strokeWidth="2.2" strokeLinejoin="round" />
              {data.map((d, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(num(d[k]))} r="3"
                  fill={colors[ki]} opacity={i % 3 === 0 ? 1 : 0} />
              ))}
            </g>
          )
        })}
        {/* 축 */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        {/* 호버 크로스헤어 + 강조점 */}
        {hover != null && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.t} y2={H - PAD.b}
              stroke="#0369A1" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            {keys.map((k, ki) => (
              <circle key={k} cx={xOf(hover)} cy={yOf(num(data[hover][k]))} r="4.5"
                fill="#fff" stroke={colors[ki]} strokeWidth="2.5" />
            ))}
          </g>
        )}
      </svg>
      {/* 툴팁 */}
      {hover != null && (
        <div style={{
          position: 'absolute', top: 34,
          left: `${(xOf(hover) / W) * 100}%`,
          transform: `translateX(${hover > data.length / 2 ? '-105%' : '8px'})`,
          background: '#0f172a', color: '#fff', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#bae6fd' }}>{hoverDate}</div>
          {keys.map((k, ki) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[ki], display: 'inline-block' }} />
              {labels[ki]}: <b>{num(data[hover][k]).toLocaleString()}{unit || '천'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── SVG 가로 막대 차트 (툴팁 포함) ─────────────────────── */
function BarChart({ data, title }: { data: IndRow[]; title: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const max = sorted[0]?.value ?? 1
  const total = sorted.reduce((a, b) => a + b.value, 0)
  const [hover, setHover] = useState<string | null>(null)
  const COLORS = [
    '#0369A1','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd',
    '#1D9E75','#34d399','#6ee7b7','#a7f3d0',
    '#f59e0b','#fbbf24',
  ]

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((row, i) => {
          const pct = ((row.value / total) * 100).toFixed(1)
          const on = hover === row.name
          return (
            <div key={row.name}
              onMouseEnter={() => setHover(row.name)} onMouseLeave={() => setHover(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', cursor: 'default' }}>
              <div style={{ width: 100, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
                {row.name}
              </div>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 22, position: 'relative' }}>
                <div style={{
                  width: `${(row.value / max) * 100}%`,
                  background: COLORS[i % COLORS.length],
                  height: '100%', borderRadius: 4,
                  transition: 'width 0.6s ease, filter 0.15s',
                  filter: on ? 'brightness(1.1)' : 'none',
                }} />
                {on && (
                  <div style={{
                    position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
                    background: '#0f172a', color: '#fff', borderRadius: 8, padding: '6px 10px',
                    fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}>
                    <b>{row.name}</b> · {row.value.toLocaleString()}천명 · 비중 {pct}%
                  </div>
                )}
              </div>
              <div style={{ width: 60, fontSize: 12, color: '#0369A1', fontWeight: 600, flexShrink: 0 }}>
                {row.value.toLocaleString()}천
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── SVG 누적 막대 차트 (월별 산업 스택, 툴팁 포함) ──────── */
function StackedBarChart({
  series, colors, unit = '천', title,
}: {
  series: IndSeries[]
  colors: string[]
  unit?: string
  title: string
}) {
  const W = 700, H = 440           // 높이 2배
  const PAD = { t: 20, r: 20, b: 48, l: 70 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  if (!series.length) return null
  const dates = series[0].data.map(d => d.date)
  const n = dates.length

  // 각 월의 합계 → 최대값
  const totals = dates.map((_, i) => series.reduce((sum, s) => sum + (s.data[i]?.value ?? 0), 0))
  const maxTotal = Math.max(...totals) * 1.05 || 1

  const bandW = iW / n
  const barW = Math.min(bandW * 0.7, 26)
  const xOf = (i: number) => PAD.l + bandW * i + bandW / 2
  const hOf = (v: number) => (v / maxTotal) * iH

  const ticks = Array.from({ length: 5 }, (_, i) => (maxTotal * i) / 4)
  const xLabels = dates.reduce<{ i: number; label: string }[]>((acc, d, i) => {
    if (i % 6 === 0 || i === n - 1) acc.push({ i, label: d.slice(0, 7) })
    return acc
  }, [])

  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.floor((x - PAD.l) / bandW)
    setHover(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <div style={{ marginBottom: 32, position: 'relative' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <span key={s.name} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, background: colors[i % colors.length], display: 'inline-block', borderRadius: 3 }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* 눈금선 */}
        {ticks.map((t, i) => {
          const y = PAD.t + iH - hOf(t)
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {Math.round(t).toLocaleString()}{unit}
              </text>
            </g>
          )
        })}
        {/* X 레이블 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        {/* 누적 막대 */}
        {dates.map((_, i) => {
          let cum = 0
          const on = hover === i
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = s.data[i]?.value ?? 0
                const h = hOf(v)
                const y = PAD.t + iH - hOf(cum) - h
                cum += v
                return (
                  <rect key={si} x={xOf(i) - barW / 2} y={y} width={barW} height={Math.max(h, 0)}
                    fill={colors[si % colors.length]} opacity={on || hover == null ? 1 : 0.45}
                    rx="1" />
                )
              })}
            </g>
          )
        })}
        {/* 축 */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
      {/* 툴팁 */}
      {hover != null && (
        <div style={{
          position: 'absolute', top: 40,
          left: `${(xOf(hover) / W) * 100}%`,
          transform: `translateX(${hover > n / 2 ? '-105%' : '8px'})`,
          background: '#0f172a', color: '#fff', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#bae6fd' }}>
            {dates[hover]} · 합계 {totals[hover].toLocaleString()}{unit}
          </div>
          {series.map((s, si) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[si % colors.length], display: 'inline-block' }} />
              {s.name}: <b>{(s.data[hover]?.value ?? 0).toLocaleString()}{unit}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
