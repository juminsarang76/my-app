import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Yahoo Finance 차트 API → 종목 현재가 + 기간별 종가 추이
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const range = req.nextUrl.searchParams.get('range') ?? '1mo'
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  // range별 interval 자동 결정
  const interval = range === '1d' || range === '5d' ? '15m' : '1d'

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) {
      return NextResponse.json({ error: 'no data' }, { status: 404 })
    }

    const meta = result.meta
    const timestamps: number[] = result.timestamp ?? []
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []

    const points = timestamps
      .map((ts, i) => {
        const d = new Date(ts * 1000)
        const label =
          interval === '1d'
            ? `${d.getMonth() + 1}/${d.getDate()}`
            : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        return { date: label, price: closes[i] }
      })
      .filter((p): p is { date: string; price: number } => p.price != null)

    const current: number = meta.regularMarketPrice
    const prev: number = meta.chartPreviousClose
    const change = current - prev
    const pct = prev ? (change / prev) * 100 : 0

    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || symbol,
      currency: meta.currency || 'USD',
      current,
      change,
      changePercent: pct,
      isUp: change >= 0,
      points,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
