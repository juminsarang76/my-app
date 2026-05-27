import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import type { Holding, AccountSummary, TrendPoint, PortfolioPayload } from '@/app/stocks/portfolio/types'

export const dynamic = 'force-dynamic'

const DATA_FILE = path.join(process.cwd(), 'data', 'portfolio.json')
const BRIDGE_SECRET = process.env.PORTFOLIO_BRIDGE_SECRET ?? ''

// ─── Mock 데이터 (브리지 미연동 시 fallback) ───
const MOCK_HOLDINGS: Holding[] = [
  { code: '005930', name: '삼성전자',     qty:  50, avgPrice:  72000, curPrice:  81500, marketValue:  4075000, pnl:   475000, pnlRate:  13.19 },
  { code: '000660', name: 'SK하이닉스',   qty:  20, avgPrice: 135000, curPrice: 198000, marketValue:  3960000, pnl:  1260000, pnlRate:  46.67 },
  { code: '035720', name: '카카오',       qty:  80, avgPrice:  58000, curPrice:  44500, marketValue:  3560000, pnl: -1080000, pnlRate: -23.28 },
  { code: '035420', name: 'NAVER',        qty:  15, avgPrice: 195000, curPrice: 222500, marketValue:  3337500, pnl:   412500, pnlRate:  14.10 },
  { code: '373220', name: 'LG에너지솔루션', qty:  10, avgPrice: 480000, curPrice: 365000, marketValue:  3650000, pnl: -1150000, pnlRate: -23.96 },
  { code: '207940', name: '삼성바이오로직스', qty:   3, avgPrice: 780000, curPrice: 925000, marketValue:  2775000, pnl:   435000, pnlRate:  18.59 },
]

function buildMockSummary(holdings: Holding[]): AccountSummary {
  const totalPurchase = holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0)
  const totalValue    = holdings.reduce((s, h) => s + h.marketValue, 0)
  const totalPnl      = holdings.reduce((s, h) => s + h.pnl, 0)
  const deposit       = 8_450_000
  return {
    totalPurchase,
    totalValue,
    totalPnl,
    pnlRate: (totalPnl / totalPurchase) * 100,
    deposit,
    orderable: 7_980_000,
    netAsset: totalValue + deposit,
  }
}

function buildMockTrend(base: number): TrendPoint[] {
  const today = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    const drift = (i - 15) * 280000
    const noise = Math.sin(i * 0.7) * 1200000 + Math.cos(i * 1.3) * 800000
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      asset: Math.round(base - 4_000_000 + drift + noise),
    }
  })
}

function buildMock(): PortfolioPayload {
  const summary = buildMockSummary(MOCK_HOLDINGS)
  return {
    summary,
    holdings: MOCK_HOLDINGS,
    trend: buildMockTrend(summary.netAsset),
    updatedAt: new Date().toISOString(),
    source: 'mock',
  }
}

// ─── GET: 최신 포트폴리오 조회 ───
// WMCA 브리지가 data/portfolio.json에 저장한 데이터를 반환.
// 파일이 없거나 손상되면 Mock 데이터로 fallback.
export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as PortfolioPayload
    if (!parsed.summary || !parsed.holdings) throw new Error('invalid schema')
    return NextResponse.json({ ...parsed, source: 'wmca' as const })
  } catch {
    return NextResponse.json(buildMock())
  }
}

// ─── POST: WMCA 브리지가 새 잔고 데이터 전송 ───
// Header: x-bridge-secret 검증 (PORTFOLIO_BRIDGE_SECRET 환경변수와 일치해야 함)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-bridge-secret')
  if (!BRIDGE_SECRET || secret !== BRIDGE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Partial<PortfolioPayload>
    if (!body.summary || !body.holdings) {
      return NextResponse.json({ error: 'missing summary or holdings' }, { status: 400 })
    }

    const payload: PortfolioPayload = {
      summary: body.summary as AccountSummary,
      holdings: body.holdings as Holding[],
      trend: body.trend ?? [],
      updatedAt: new Date().toISOString(),
      source: 'wmca',
    }

    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8')

    return NextResponse.json({ ok: true, updatedAt: payload.updatedAt })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
