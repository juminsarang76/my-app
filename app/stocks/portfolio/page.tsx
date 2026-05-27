'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { PortfolioPayload } from './types'

// ─── 포맷 헬퍼 ───
const krw = (n: number) => '₩ ' + n.toLocaleString('ko-KR')
const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
const compactKrw = (n: number) => {
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '억'
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(0) + '만'
  return n.toLocaleString('ko-KR')
}

const UP = '#E24B4A'
const DOWN = '#0369A1'
const colorOf = (n: number) => (n >= 0 ? UP : DOWN)

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/portfolio', { cache: 'no-store' })
      .then(r => r.json())
      .then((p: PortfolioPayload) => { if (alive) { setData(p); setLoading(false) } })
      .catch(e => { if (alive) { setError(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <PageShell><div style={msg}>잔고 조회 중...</div></PageShell>
  if (error || !data) return <PageShell><div style={{ ...msg, color: UP }}>오류: {error ?? 'no data'}</div></PageShell>

  const { summary, holdings, trend, updatedAt, source } = data
  const isLive = source === 'wmca'

  return (
    <PageShell>

      {/* 헤더 + 상태 뱃지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Link href="/stocks" style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none' }}>‹ 재무</Link>
        <span style={{ fontSize: 13, color: '#bbb' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>주식 리스트</h1>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10, fontWeight: 700, letterSpacing: 1,
          color: isLive ? '#065F46' : '#92400E',
          background: isLive ? '#D1FAE5' : '#FEF3C7',
          padding: '4px 10px', borderRadius: 12,
        }}>
          {isLive ? '🟢 LIVE · WMCA' : '🟡 DEMO · 데모 데이터'}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 28 }}>
        NH투자증권 나무 WMCA OpenAPI c8201 · 마지막 업데이트 {new Date(updatedAt).toLocaleString('ko-KR')}
      </p>

      {/* 순자산 큰 카드 */}
      <section style={{ marginBottom: 28 }}>
        <div style={{
          padding: '24px 28px',
          border: '1px solid #BAE6FD',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #EFF8FF 0%, #F0F9FF 100%)',
        }}>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>NET ASSET · 순자산</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#0F172A', marginBottom: 6, letterSpacing: -1 }}>
            {krw(summary.netAsset)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: colorOf(summary.totalPnl), fontWeight: 600 }}>
              {summary.totalPnl >= 0 ? '▲' : '▼'} {krw(Math.abs(summary.totalPnl))} ({pct(summary.pnlRate)})
            </span>
            <span style={{ color: '#94A3B8' }}>총 평가손익</span>
          </div>
        </div>
      </section>

      {/* 보조 지표 4개 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { label: '평가금액',    val: krw(summary.totalValue) },
          { label: '매입원가',    val: krw(summary.totalPurchase) },
          { label: '예수금',      val: krw(summary.deposit) },
          { label: '주문가능액',  val: krw(summary.orderable) },
        ].map((m, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            background: '#FFFFFF',
          }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4, letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{m.val}</div>
          </div>
        ))}
      </section>

      {/* 자산 추이 그래프 */}
      {trend.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', margin: 0 }}>자산 추이 (최근 {trend.length}일)</h2>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>일별 순자산 평가액</span>
          </div>
          <div style={{
            border: '1px solid #BAE6FD',
            borderRadius: 12,
            background: '#FFFFFF',
            padding: '14px 8px 8px 8px',
          }}>
            <ResponsiveContainer width="100%" aspect={3.2} debounce={50}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} interval={Math.max(1, Math.floor(trend.length / 8))} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => compactKrw(v)}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(v) => [krw(Number(v)), '순자산']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #BAE6FD' }}
                />
                <ReferenceLine y={summary.totalPurchase + summary.deposit} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: '원금', fill: '#94A3B8', fontSize: 10, position: 'insideTopRight' }} />
                <Line
                  type="monotone"
                  dataKey="asset"
                  stroke={colorOf(summary.totalPnl)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 보유 종목 테이블 */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', margin: 0 }}>보유 종목 ({holdings.length})</h2>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>c8201outblock1</span>
        </div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B' }}>
                <th style={th}>종목</th>
                <th style={{ ...th, textAlign: 'right' }}>수량</th>
                <th style={{ ...th, textAlign: 'right' }}>평균가</th>
                <th style={{ ...th, textAlign: 'right' }}>현재가</th>
                <th style={{ ...th, textAlign: 'right' }}>평가금액</th>
                <th style={{ ...th, textAlign: 'right' }}>손익</th>
                <th style={{ ...th, textAlign: 'right' }}>수익률</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.code} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{h.code}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{h.qty.toLocaleString('ko-KR')}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{h.avgPrice.toLocaleString('ko-KR')}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{h.curPrice.toLocaleString('ko-KR')}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{krw(h.marketValue)}</td>
                  <td style={{ ...td, textAlign: 'right', color: colorOf(h.pnl), fontWeight: 600 }}>
                    {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString('ko-KR')}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: colorOf(h.pnlRate), fontWeight: 600 }}>
                    {pct(h.pnlRate)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>합계</td>
                <td style={{ ...td, textAlign: 'right' }} />
                <td style={{ ...td, textAlign: 'right' }} />
                <td style={{ ...td, textAlign: 'right' }} />
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{krw(summary.totalValue)}</td>
                <td style={{ ...td, textAlign: 'right', color: colorOf(summary.totalPnl), fontWeight: 700 }}>
                  {summary.totalPnl >= 0 ? '+' : ''}{summary.totalPnl.toLocaleString('ko-KR')}
                </td>
                <td style={{ ...td, textAlign: 'right', color: colorOf(summary.pnlRate), fontWeight: 700 }}>
                  {pct(summary.pnlRate)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 연동 안내 (DEMO 모드일 때만) */}
      {!isLive && (
        <section style={{ marginBottom: 28 }}>
          <div style={{
            padding: '18px 22px',
            border: '1px dashed #BAE6FD',
            borderRadius: 12,
            background: '#F0F9FF',
            fontSize: 12,
            color: '#475569',
            lineHeight: 1.75,
          }}>
            <div style={{ fontWeight: 700, color: '#0369A1', marginBottom: 8 }}>🔌 WMCA 연동 활성화 방법</div>
            <div>1. <code style={code}>.env.local</code>에 <code style={code}>PORTFOLIO_BRIDGE_SECRET</code> 설정</div>
            <div>2. Windows PC에서 <code style={code}>scripts/wmca_bridge.py</code> 실행 (Python 3.x + pywin32)</div>
            <div>3. 브리지가 wmca.dll → c8201 호출 → <code style={code}>POST /api/portfolio</code>로 전송</div>
            <div>4. 페이지 새로고침 시 자동으로 LIVE 모드 전환</div>
          </div>
        </section>
      )}

      <p style={{ fontSize: 11, color: '#bbb', marginBottom: 40 }}>
        <span style={{ color: UP }}>▲ 평가이익</span> · <span style={{ color: DOWN }}>▼ 평가손실</span> · 단위: 원
      </p>

    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 920, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      {children}
    </main>
  )
}

const msg: React.CSSProperties = { padding: '40px 0', textAlign: 'center', color: '#64748B', fontSize: 14 }

const th: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: 0.5,
  textAlign: 'left',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  color: '#334155',
  verticalAlign: 'middle',
}

const code: React.CSSProperties = {
  background: '#E0F2FE',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 11,
  color: '#0C4A6E',
  fontFamily: 'monospace',
}
