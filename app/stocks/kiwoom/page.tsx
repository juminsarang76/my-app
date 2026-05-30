'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type AuthStatus = {
  ok: boolean
  env: 'mock' | 'production'
  base: string
  configured: boolean
  account?: string | null
  tokenMask?: string
  expiresInMin?: number | null
  error?: string
}

type Quote = {
  symbol: string
  name: string
  current: number
  change: number
  changePercent: number
  isUp: boolean
  isDown: boolean
  open: number
  high: number
  low: number
  volume: number
  upperLimit: number
  lowerLimit: number
}

type OrderResult = {
  ok: boolean
  env?: string
  side?: 'buy' | 'sell'
  symbol?: string
  qty?: number
  price?: number
  orderNo?: string | null
  message?: string
  error?: string
}

type OrderHistory = {
  ts: string
  side: 'buy' | 'sell'
  symbol: string
  name?: string
  qty: number
  price: number
  tradeTp: string
  env: string
  ok: boolean
  orderNo?: string | null
  message?: string
}

const UP = '#E24B4A'
const DOWN = '#0369A1'
const STORAGE_KEY = 'kiwoom-orders-v1'

const krw = (n: number) => '₩' + (n || 0).toLocaleString('ko-KR')

export default function KiwoomPage() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)

  // ─── 시세 조회 상태 ───
  const [symbolInput, setSymbolInput] = useState('005930')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // ─── 주문 상태 ───
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy')
  const [orderQty, setOrderQty] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [orderTradeTp, setOrderTradeTp] = useState<'0' | '3'>('0')
  const [orderConfirming, setOrderConfirming] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [history, setHistory] = useState<OrderHistory[]>([])

  // ─── 초기 로드 ───
  useEffect(() => {
    fetch('/api/kiwoom/auth', { cache: 'no-store' })
      .then(r => r.json())
      .then(setAuth)
      .catch(e => setAuth({ ok: false, env: 'mock', base: '', configured: false, error: String(e) }))
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setHistory(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // ─── 시세 조회 ───
  const fetchQuote = useCallback(async (sym: string) => {
    const s = sym.trim()
    if (!/^\d{6}$/.test(s)) {
      setQuoteError('6자리 종목코드를 입력하세요 (예: 005930)')
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const r = await fetch(`/api/kiwoom/quote?symbol=${s}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) {
        setQuoteError(d.error || `오류 ${r.status}`)
        setQuote(null)
      } else {
        setQuote(d)
        setOrderPrice(String(d.current || ''))
      }
    } catch (e) {
      setQuoteError(String(e))
    } finally {
      setQuoteLoading(false)
    }
  }, [])

  // ─── 주문 실행 ───
  const submitOrder = useCallback(async () => {
    setOrderSubmitting(true)
    setOrderResult(null)
    try {
      const r = await fetch('/api/kiwoom/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: orderSide,
          symbol: symbolInput,
          qty: Number(orderQty),
          price: orderTradeTp === '3' ? 0 : Number(orderPrice),
          tradeTp: orderTradeTp,
          market: 'KRX',
          confirm: true,
        }),
      })
      const d: OrderResult = await r.json()
      setOrderResult(d)

      // 이력에 추가
      const entry: OrderHistory = {
        ts: new Date().toISOString(),
        side: orderSide,
        symbol: symbolInput,
        name: quote?.name,
        qty: Number(orderQty),
        price: orderTradeTp === '3' ? 0 : Number(orderPrice),
        tradeTp: orderTradeTp,
        env: auth?.env || 'mock',
        ok: !!d.ok,
        orderNo: d.orderNo ?? null,
        message: d.message || d.error,
      }
      const next = [entry, ...history].slice(0, 30)
      setHistory(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }

      if (d.ok) {
        setOrderQty('')
        setOrderConfirming(false)
      }
    } catch (e) {
      setOrderResult({ ok: false, error: String(e) })
    } finally {
      setOrderSubmitting(false)
    }
  }, [orderSide, orderQty, orderPrice, orderTradeTp, symbolInput, quote, auth, history])

  // ─── 주문 유효성 ───
  const orderTotal = orderTradeTp === '3'
    ? null
    : Number(orderQty) * Number(orderPrice) || 0
  const orderValid = Number(orderQty) > 0 && (orderTradeTp === '3' || Number(orderPrice) > 0)

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/stocks" style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none' }}>‹ 재무</Link>
        <span style={{ fontSize: 13, color: '#bbb' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>키움증권</h1>
        <EnvBadge env={auth?.env} ok={auth?.ok} />
      </div>

      {/* 인증 상태 */}
      <AuthCard auth={auth} />

      {/* 시세 조회 */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={sectionTitle}>📊 종목 시세</h2>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') fetchQuote(symbolInput) }}
            placeholder="6자리 종목코드 (예: 005930)"
            style={inputStyle}
            maxLength={6}
          />
          <button
            onClick={() => fetchQuote(symbolInput)}
            disabled={quoteLoading || !symbolInput}
            style={{ ...buttonStyle, background: quoteLoading || !symbolInput ? '#CBD5E1' : '#0369A1' }}
          >
            {quoteLoading ? '...' : '조회'}
          </button>
        </div>

        {quoteError && <div style={{ fontSize: 12, color: UP, marginBottom: 8 }}>⚠ {quoteError}</div>}

        {quote && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{quote.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{quote.symbol}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A' }}>{krw(quote.current)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: quote.change >= 0 ? UP : DOWN }}>
                  {quote.change >= 0 ? '▲' : '▼'} {krw(Math.abs(quote.change))} ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
              <KV label="시가" v={krw(quote.open)} />
              <KV label="고가" v={krw(quote.high)} color={UP} />
              <KV label="저가" v={krw(quote.low)} color={DOWN} />
              <KV label="거래량" v={quote.volume.toLocaleString('ko-KR')} />
            </div>
          </div>
        )}
      </section>

      {/* 주문 */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={sectionTitle}>💼 주문</h2>

        {/* 매수/매도 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          <button
            onClick={() => { setOrderSide('buy'); setOrderConfirming(false); setOrderResult(null) }}
            style={{
              ...tabBtn,
              background: orderSide === 'buy' ? UP : '#fff',
              color: orderSide === 'buy' ? '#fff' : UP,
              borderColor: UP,
            }}
          >매수</button>
          <button
            onClick={() => { setOrderSide('sell'); setOrderConfirming(false); setOrderResult(null) }}
            style={{
              ...tabBtn,
              background: orderSide === 'sell' ? DOWN : '#fff',
              color: orderSide === 'sell' ? '#fff' : DOWN,
              borderColor: DOWN,
            }}
          >매도</button>
        </div>

        {/* 주문 폼 */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="종목코드">
              <input value={symbolInput} disabled style={{ ...inputStyle, background: '#F1F5F9' }} />
            </Field>
            <Field label="거래구분">
              <select
                value={orderTradeTp}
                onChange={e => setOrderTradeTp(e.target.value as '0' | '3')}
                style={inputStyle}
              >
                <option value="0">지정가</option>
                <option value="3">시장가</option>
              </select>
            </Field>
            <Field label="수량">
              <input
                value={orderQty}
                onChange={e => setOrderQty(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                inputMode="numeric"
                style={inputStyle}
              />
            </Field>
            <Field label={orderTradeTp === '3' ? '가격 (시장가)' : '가격'}>
              <input
                value={orderTradeTp === '3' ? '' : orderPrice}
                onChange={e => setOrderPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                disabled={orderTradeTp === '3'}
                inputMode="numeric"
                style={{ ...inputStyle, background: orderTradeTp === '3' ? '#F1F5F9' : '#fff' }}
              />
            </Field>
          </div>

          {orderTotal != null && (
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
              예상 거래금액: <b style={{ color: '#0F172A' }}>{krw(orderTotal)}</b>
            </div>
          )}

          {!orderConfirming && (
            <button
              onClick={() => setOrderConfirming(true)}
              disabled={!orderValid}
              style={{
                ...buttonStyle, width: '100%',
                background: !orderValid ? '#CBD5E1' : (orderSide === 'buy' ? UP : DOWN),
              }}
            >{orderSide === 'buy' ? '매수' : '매도'} 주문</button>
          )}

          {orderConfirming && (
            <div style={{
              padding: '12px 14px', border: '1px solid #FCD34D', borderRadius: 10,
              background: '#FFFBEB', fontSize: 12, color: '#92400E',
            }}>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                {auth?.env === 'production' ? '⚠ 실거래 주문 확인' : '🟡 모의투자 주문 확인'}
              </div>
              <div style={{ marginBottom: 12, lineHeight: 1.7 }}>
                <b>{orderSide === 'buy' ? '매수' : '매도'}</b> · {quote?.name || symbolInput} ({symbolInput})<br />
                수량 <b>{orderQty}</b>주 · {orderTradeTp === '3' ? '시장가' : `지정가 ${krw(Number(orderPrice))}`}<br />
                {orderTotal != null && <>예상금액 <b>{krw(orderTotal)}</b></>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setOrderConfirming(false)}
                  disabled={orderSubmitting}
                  style={{ ...buttonStyle, flex: 1, background: '#E2E8F0', color: '#475569' }}
                >취소</button>
                <button
                  onClick={submitOrder}
                  disabled={orderSubmitting}
                  style={{
                    ...buttonStyle, flex: 2,
                    background: orderSubmitting ? '#CBD5E1' : (orderSide === 'buy' ? UP : DOWN),
                  }}
                >{orderSubmitting ? '주문 중...' : '확인 · 주문 실행'}</button>
              </div>
            </div>
          )}

          {orderResult && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12,
              background: orderResult.ok ? '#ECFDF5' : '#FEF2F2',
              color: orderResult.ok ? '#065F46' : '#991B1B',
              border: `1px solid ${orderResult.ok ? '#A7F3D0' : '#FECACA'}`,
            }}>
              {orderResult.ok
                ? <>✅ 주문 접수 · 주문번호 <code>{orderResult.orderNo ?? '-'}</code> {orderResult.message && `· ${orderResult.message}`}</>
                : <>❌ {orderResult.error}</>}
            </div>
          )}
        </div>
      </section>

      {/* 최근 주문 */}
      {history.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={sectionTitle}>📋 최근 주문 ({history.length})</h2>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#64748B' }}>
                  <th style={th}>시간</th>
                  <th style={th}>매매</th>
                  <th style={th}>종목</th>
                  <th style={{ ...th, textAlign: 'right' }}>수량</th>
                  <th style={{ ...th, textAlign: 'right' }}>가격</th>
                  <th style={th}>구분</th>
                  <th style={th}>상태</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={td}>{new Date(h.ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ ...td, color: h.side === 'buy' ? UP : DOWN, fontWeight: 600 }}>{h.side === 'buy' ? '매수' : '매도'}</td>
                    <td style={td}>{h.name ? `${h.name} (${h.symbol})` : h.symbol}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{h.qty.toLocaleString('ko-KR')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{h.tradeTp === '3' ? '시장가' : krw(h.price)}</td>
                    <td style={td}>{h.env === 'production' ? '실거래' : '모의'}</td>
                    <td style={{ ...td, color: h.ok ? '#059669' : UP, fontWeight: 600 }}>
                      {h.ok ? '✓' : '✗'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p style={{ fontSize: 10.5, color: '#bbb', marginBottom: 40 }}>
        키움증권 REST OpenAPI · {auth?.base} · <span style={{ color: UP }}>매수/상승</span> / <span style={{ color: DOWN }}>매도/하락</span>
      </p>
    </main>
  )
}

// ─── 보조 컴포넌트 ───
function EnvBadge({ env, ok }: { env?: 'mock' | 'production'; ok?: boolean }) {
  if (!env) return null
  const isMock = env === 'mock'
  const bg = !ok ? '#FECACA' : (isMock ? '#FEF3C7' : '#DBEAFE')
  const fg = !ok ? '#991B1B' : (isMock ? '#92400E' : '#1E40AF')
  const label = !ok ? '⚠ 미연결' : (isMock ? '🟡 MOCK · 모의투자' : '🔵 LIVE · 실거래')
  return (
    <span style={{
      marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: 1,
      color: fg, background: bg, padding: '4px 10px', borderRadius: 12,
    }}>{label}</span>
  )
}

function AuthCard({ auth }: { auth: AuthStatus | null }) {
  if (!auth) return (
    <div style={{ ...cardStyle, marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: '#94A3B8' }}>연결 확인 중...</div>
    </div>
  )
  if (!auth.configured) return (
    <div style={{ ...cardStyle, marginBottom: 18, background: '#FEF2F2', borderColor: '#FECACA' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>⚠ 키움 API 미설정</div>
      <div style={{ fontSize: 11.5, color: '#7F1D1D', lineHeight: 1.7 }}>
        <code>.env.local</code>에 다음 환경변수 추가 필요:
        <pre style={{ background: '#FFF', padding: '8px 10px', borderRadius: 6, marginTop: 6, fontSize: 11 }}>{`KIWOOM_APPKEY=발급받은_AppKey
KIWOOM_SECRETKEY=발급받은_SecretKey
KIWOOM_ACCOUNT_NO=계좌번호
KIWOOM_API_BASE=https://mockapi.kiwoom.com  # 또는 https://api.kiwoom.com`}</pre>
        <div style={{ marginTop: 4 }}>키 발급: <a href="https://openapi.kiwoom.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1' }}>openapi.kiwoom.com</a></div>
      </div>
    </div>
  )
  if (!auth.ok) return (
    <div style={{ ...cardStyle, marginBottom: 18, background: '#FEF2F2', borderColor: '#FECACA' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>⚠ 토큰 발급 실패</div>
      <div style={{ fontSize: 11, color: '#7F1D1D' }}>{auth.error}</div>
    </div>
  )
  return (
    <div style={{ ...cardStyle, marginBottom: 18, background: '#F0F9FF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 11.5 }}>
        <KV label="환경" v={auth.env === 'mock' ? '모의투자' : '실거래'} />
        <KV label="계좌" v={auth.account || '-'} />
        <KV label="토큰 만료까지" v={auth.expiresInMin != null ? `${auth.expiresInMin}분` : '-'} />
      </div>
    </div>
  )
}

function KV({ label, v, color }: { label: string; v: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: color || '#0F172A' }}>{v}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  )
}

// ─── 스타일 ───
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 10,
}

const cardStyle: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid #BAE6FD',
  borderRadius: 12,
  background: '#fff',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1px solid #BAE6FD', borderRadius: 8, outline: 'none',
  background: '#fff', color: '#0F172A',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const buttonStyle: React.CSSProperties = {
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  border: 'none', borderRadius: 8, cursor: 'pointer',
  color: '#fff', whiteSpace: 'nowrap',
}

const tabBtn: React.CSSProperties = {
  flex: 1, padding: '9px 16px', fontSize: 13, fontWeight: 700,
  border: '1.5px solid', borderRadius: 8, cursor: 'pointer',
  background: '#fff',
}

const th: React.CSSProperties = {
  padding: '8px 10px', fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textAlign: 'left',
}

const td: React.CSSProperties = {
  padding: '8px 10px', color: '#334155', verticalAlign: 'middle',
}
