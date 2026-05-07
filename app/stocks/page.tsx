type Quote = {
  symbol: string
  label: string
  price: string
  change: string
  changePercent: string
  isUp: boolean
} | null

async function fetchQuote(symbol: string, label: string): Promise<Quote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const meta = data.chart?.result?.[0]?.meta
    if (!meta) return null
    const price: number = meta.regularMarketPrice
    const prev: number = meta.chartPreviousClose
    const change = price - prev
    const pct = ((change / prev) * 100).toFixed(2)
    const sign = change >= 0 ? '+' : ''
    return {
      symbol,
      label,
      price: price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      change: sign + change.toFixed(2),
      changePercent: sign + pct,
      isUp: change >= 0,
    }
  } catch {
    return null
  }
}

const US_STOCKS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^DJI', label: '다우존스' },
  { symbol: '^IXIC', label: 'NASDAQ' },
  { symbol: 'IONQ', label: 'IONQ' },
]

const KR_STOCKS = [
  { symbol: '^KS11', label: 'KOSPI' },
  { symbol: '^KQ11', label: 'KOSDAQ' },
]

const FX = [
  { symbol: 'KRW=X', label: 'USD/KRW' },
  { symbol: 'EURKRW=X', label: 'EUR/KRW' },
  { symbol: 'JPY=X', label: 'USD/JPY' },
]

function QuoteCard({ q }: { q: Quote }) {
  if (!q) return null
  return (
    <div style={{ padding: '16px 20px', border: '1px solid #eee', borderRadius: 12, background: 'white' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{q.label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 4 }}>{q.price}</div>
      <div style={{ fontSize: 13, color: q.isUp ? '#1D9E75' : '#E24B4A' }}>
        {q.isUp ? '▲' : '▼'} {q.change} ({q.changePercent}%)
      </div>
    </div>
  )
}

export default async function StocksPage() {
  const [usQuotes, krQuotes, fxQuotes] = await Promise.all([
    Promise.all(US_STOCKS.map(s => fetchQuote(s.symbol, s.label))),
    Promise.all(KR_STOCKS.map(s => fetchQuote(s.symbol, s.label))),
    Promise.all(FX.map(s => fetchQuote(s.symbol, s.label))),
  ])

  const grid2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  }
  const grid3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  }

  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 28 }}>증권뉴스</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, letterSpacing: 0.5 }}>
          미국 증시
        </h2>
        <div style={grid2}>
          {usQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, letterSpacing: 0.5 }}>
          한국 증시
        </h2>
        <div style={grid2}>
          {krQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, letterSpacing: 0.5 }}>
          환율
        </h2>
        <div style={grid3}>
          {fxQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <p style={{ fontSize: 11, color: '#bbb' }}>
        데이터 출처: Yahoo Finance · 5분 캐시
      </p>
    </main>
  )
}
