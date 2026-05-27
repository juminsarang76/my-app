'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type WatchItem = { symbol: string; label: string }

type QuoteData = {
  symbol: string
  name: string
  currency: string
  current: number
  change: number
  changePercent: number
  isUp: boolean
  points: { date: string; price: number }[]
}

const DEFAULT_LIST: WatchItem[] = [
  { symbol: 'IONQ',      label: 'IONQ' },
  { symbol: 'RDW',       label: 'RDW (Redwire)' },
  { symbol: '005930.KS', label: '삼성전자' },
  { symbol: '000660.KS', label: 'SK하이닉스' },
]

const STORAGE_KEY = 'stock-watchlist-v1'
const RANGES = [
  { key: '1d',  label: '1D' },
  { key: '5d',  label: '5D' },
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y',  label: '1Y' },
]

const UP = '#E24B4A'
const DOWN = '#0369A1'
const colorOf = (up: boolean) => (up ? UP : DOWN)

function fmtPrice(n: number, currency: string) {
  if (currency === 'KRW') return '₩' + Math.round(n).toLocaleString('ko-KR')
  if (currency === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + currency
}

export default function WatchlistPage() {
  const [list, setList] = useState<WatchItem[]>(DEFAULT_LIST)
  const [range, setRange] = useState('1mo')
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  // localStorage 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as WatchItem[]
        if (Array.isArray(parsed) && parsed.length) setList(parsed)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  // localStorage 저장
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }, [list, loaded])

  const addSymbol = useCallback(async () => {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    if (list.some(i => i.symbol.toUpperCase() === sym)) {
      setAddError('이미 추가된 종목입니다')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const r = await fetch(`/api/quote-history?symbol=${encodeURIComponent(sym)}&range=1mo`)
      const d = await r.json()
      if (d.error || !d.symbol) {
        setAddError(`'${sym}' 종목을 찾을 수 없습니다`)
      } else {
        setList(prev => [...prev, { symbol: d.symbol, label: d.name || sym }])
        setInput('')
      }
    } catch {
      setAddError('조회 실패 — 다시 시도해주세요')
    } finally {
      setAdding(false)
    }
  }, [input, list])

  const removeSymbol = useCallback((symbol: string) => {
    setList(prev => prev.filter(i => i.symbol !== symbol))
  }, [])

  const moveItem = useCallback((from: number, to: number) => {
    setList(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/stocks" style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none' }}>‹ 재무</Link>
        <span style={{ fontSize: 13, color: '#bbb' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>주식 리스트</h1>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{list.length}개 종목</span>
      </div>

      {/* 추가 바 + 기간 선택 */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setAddError(null) }}
            onKeyDown={e => { if (e.key === 'Enter') addSymbol() }}
            placeholder="티커 입력 (예: AAPL, TSLA, 005930.KS)"
            style={{
              flex: 1, padding: '9px 14px', fontSize: 13,
              border: '1px solid #BAE6FD', borderRadius: 10, outline: 'none',
              background: '#fff', color: '#0F172A',
            }}
          />
          <button
            onClick={addSymbol}
            disabled={adding || !input.trim()}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 10, cursor: adding || !input.trim() ? 'default' : 'pointer',
              background: adding || !input.trim() ? '#CBD5E1' : '#1D9E75', color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? '...' : '+ 추가'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#EFF8FF', padding: 3, borderRadius: 10, border: '1px solid #BAE6FD' }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 7,
                cursor: 'pointer',
                background: range === r.key ? '#0369A1' : 'transparent',
                color: range === r.key ? '#fff' : '#0369A1',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {addError && <div style={{ fontSize: 12, color: UP, marginBottom: 14 }}>⚠ {addError}</div>}

      {/* 종목별 차트 (수직 배열) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {list.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            종목을 추가해주세요
          </div>
        )}
        {list.map((item, idx) => (
          <StockChartCard
            key={item.symbol}
            item={item}
            range={range}
            onRemove={() => removeSymbol(item.symbol)}
            dragging={dragIndex === idx}
            over={overIndex === idx && dragIndex !== null && dragIndex !== idx}
            onDragStart={() => setDragIndex(idx)}
            onDragEnter={() => { if (dragIndex !== null) setOverIndex(idx) }}
            onDrop={() => {
              if (dragIndex !== null) moveItem(dragIndex, idx)
              setDragIndex(null)
              setOverIndex(null)
            }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
          />
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#bbb', margin: '28px 0 40px' }}>
        데이터: Yahoo Finance · 5분 캐시 · <span style={{ color: UP }}>▲ 상승</span> / <span style={{ color: DOWN }}>▼ 하락</span> · 목록은 브라우저에 저장됩니다
      </p>
    </main>
  )
}

function StockChartCard({
  item, range, onRemove,
  dragging, over, onDragStart, onDragEnter, onDrop, onDragEnd,
}: {
  item: WatchItem
  range: string
  onRemove: () => void
  dragging: boolean
  over: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [data, setData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [grab, setGrab] = useState(false)   // 핸들을 잡았을 때만 draggable 활성화

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    fetch(`/api/quote-history?symbol=${encodeURIComponent(item.symbol)}&range=${range}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: QuoteData & { error?: string }) => {
        if (!alive) return
        if (d.error || !d.symbol) setError(true)
        else setData(d)
        setLoading(false)
      })
      .catch(() => { if (alive) { setError(true); setLoading(false) } })
    return () => { alive = false }
  }, [item.symbol, range])

  const up = data?.isUp ?? true
  const stroke = colorOf(up)

  return (
    <div
      draggable={grab}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onDragEnd={() => { setGrab(false); onDragEnd() }}
      style={{
        border: '1px solid #BAE6FD', borderRadius: 14, background: '#fff', overflow: 'hidden',
        opacity: dragging ? 0.4 : 1,
        boxShadow: over ? '0 0 0 2px #1D9E75' : 'none',
        transition: 'opacity .15s, box-shadow .15s',
      }}
    >
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 6px' }}>
        <div
          onMouseDown={() => setGrab(true)}
          onMouseUp={() => setGrab(false)}
          title="드래그하여 순서 변경"
          style={{
            cursor: 'grab', color: '#CBD5E1', fontSize: 17, lineHeight: 1,
            userSelect: 'none', flexShrink: 0, padding: '2px 0',
          }}
        >⠿</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.symbol}</div>
        </div>
        {data && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>
              {fmtPrice(data.current, data.currency)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: stroke }}>
              {up ? '▲' : '▼'} {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
            </div>
          </div>
        )}
        <button
          onClick={onRemove}
          title="삭제"
          style={{
            width: 26, height: 26, borderRadius: 7, border: '1px solid #E2E8F0',
            background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 14, lineHeight: 1,
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* 차트 */}
      <div style={{ padding: '0 8px 10px' }}>
        {loading && <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 13 }}>로딩 중...</div>}
        {error && <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: UP, fontSize: 13 }}>데이터 조회 실패</div>}
        {data && !loading && !error && (
          <ResponsiveContainer width="100%" aspect={4} debounce={50}>
            <LineChart data={data.points} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={Math.max(1, Math.floor(data.points.length / 6))} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                domain={['auto', 'auto']}
                width={48}
                tickFormatter={(v) => data.currency === 'KRW' ? (v / 1000).toFixed(0) + 'k' : Number(v).toFixed(0)}
              />
              <Tooltip
                formatter={(v) => [fmtPrice(Number(v), data.currency), '종가']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #BAE6FD' }}
              />
              <Line type="monotone" dataKey="price" stroke={stroke} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
