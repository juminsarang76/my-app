type Quote = {
  symbol: string
  label: string
  price: string
  change: string
  changePercent: string
  isUp: boolean
  tvUrl: string
} | null

async function fetchQuote(symbol: string, label: string, tvUrl: string): Promise<Quote> {
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
      tvUrl,
    }
  } catch {
    return null
  }
}

const US_STOCKS = [
  { symbol: '^GSPC',  label: 'S&P 500',  tvUrl: 'https://www.tradingview.com/symbols/SPX/' },
  { symbol: '^DJI',   label: '다우존스', tvUrl: 'https://www.tradingview.com/symbols/DJI/' },
  { symbol: '^IXIC',  label: 'NASDAQ',   tvUrl: 'https://www.tradingview.com/symbols/NASDAQ-IXIC/' },
  { symbol: 'IONQ',   label: 'IONQ',     tvUrl: 'https://www.tradingview.com/symbols/NYSE-IONQ/' },
]

const KR_STOCKS = [
  { symbol: '^KS11', label: 'KOSPI',  tvUrl: 'https://www.tradingview.com/symbols/KOSPI/' },
  { symbol: '^KQ11', label: 'KOSDAQ', tvUrl: 'https://www.tradingview.com/symbols/KOSDAQ/' },
]

const FX = [
  { symbol: 'KRW=X',    label: 'USD/KRW', tvUrl: 'https://www.tradingview.com/symbols/FX_IDC-USDKRW/' },
  { symbol: 'EURKRW=X', label: 'EUR/KRW', tvUrl: 'https://www.tradingview.com/symbols/FX_IDC-EURKRW/' },
  { symbol: 'JPYKRW=X', label: 'JPY/KRW', tvUrl: 'https://www.tradingview.com/symbols/FX_IDC-JPYKRW/' },
  { symbol: 'JPY=X',    label: 'USD/JPY', tvUrl: 'https://www.tradingview.com/symbols/FX_IDC-USDJPY/' },
]

function QuoteCard({ q }: { q: Quote }) {
  if (!q) return null
  return (
    <a
      href={q.tvUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        padding: '16px 20px',
        border: '1px solid #eee',
        borderRadius: 12,
        background: 'white',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{q.label}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 4 }}>{q.price}</div>
        <div style={{ fontSize: 13, color: q.isUp ? '#1D9E75' : '#E24B4A' }}>
          {q.isUp ? '▲' : '▼'} {q.change} ({q.changePercent}%)
        </div>
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 8 }}>TradingView →</div>
      </div>
    </a>
  )
}

export default async function StocksPage() {
  const [usQuotes, krQuotes, fxQuotes] = await Promise.all([
    Promise.all(US_STOCKS.map(s => fetchQuote(s.symbol, s.label, s.tvUrl))),
    Promise.all(KR_STOCKS.map(s => fetchQuote(s.symbol, s.label, s.tvUrl))),
    Promise.all(FX.map(s => fetchQuote(s.symbol, s.label, s.tvUrl))),
  ])

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }
  const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }

  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 28 }}>증권뉴스</h1>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12 }}>미국 증시</h2>
        <div style={grid2}>
          {usQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12 }}>한국 증시</h2>
        <div style={grid2}>
          {krQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12 }}>환율</h2>
        <div style={grid4}>
          {fxQuotes.map((q, i) => <QuoteCard key={i} q={q} />)}
        </div>
      </section>

      <p style={{ fontSize: 11, color: '#bbb' }}>데이터 출처: Yahoo Finance · 5분 캐시 · 클릭 시 TradingView 차트</p>
    </main>
  )
}
