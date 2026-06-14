import { NextRequest, NextResponse } from 'next/server'
import { callKiwoomTR, kiwoomConfigured, parseEnv } from '@/app/lib/finance/kiwoom'

export const dynamic = 'force-dynamic'

// POST /api/kiwoom/order
// Body:
//   env:     'mock' | 'prod'   (필수)
//   side:    'buy' | 'sell'
//   symbol:  6자리 종목코드
//   qty:     수량
//   price:   가격 (지정가만)
//   tradeTp: '0'(지정가) | '3'(시장가) ...
//   market:  'KRX' | 'NXT' | 'SOR' (기본 KRX)
//   confirm: true (실전 환경 필수)
export async function POST(req: NextRequest) {
  let body: {
    env?: string; side?: string; symbol?: string;
    qty?: number | string; price?: number | string;
    tradeTp?: string; market?: string; confirm?: boolean;
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const env = parseEnv(body.env)
  if (!kiwoomConfigured(env)) {
    return NextResponse.json({ error: `${env === 'prod' ? '실전' : '모의'} 키 미설정` }, { status: 400 })
  }

  const { side, symbol, qty, price = '', tradeTp = '0', market = 'KRX', confirm = false } = body
  if (side !== 'buy' && side !== 'sell') return NextResponse.json({ error: "side must be 'buy' or 'sell'" }, { status: 400 })
  if (!symbol || !/^\d{6}$/.test(symbol)) return NextResponse.json({ error: 'symbol(6-digit) required' }, { status: 400 })
  if (!qty || Number(qty) <= 0) return NextResponse.json({ error: 'qty > 0 required' }, { status: 400 })

  if (tradeTp !== '3' && (!price || Number(price) <= 0)) {
    return NextResponse.json({ error: 'price required for non-market order' }, { status: 400 })
  }

  if (env === 'prod' && !confirm) {
    return NextResponse.json({ error: '실거래 주문은 confirm=true 필수' }, { status: 400 })
  }

  const apiId = side === 'buy' ? 'kt10000' : 'kt10001'

  try {
    const r = await callKiwoomTR(env, {
      apiId,
      body: {
        dmst_stex_tp: market,
        stk_cd: symbol,
        ord_qty: String(qty),
        ord_uv: tradeTp === '3' ? '' : String(price),
        trde_tp: tradeTp,
        cond_uv: '',
      },
    })

    if (r.status !== 200 || (r.data.return_code != null && r.data.return_code !== 0)) {
      return NextResponse.json({
        ok: false,
        env,
        error: r.data.return_msg || `status ${r.status}`,
        raw: r.data,
      }, { status: 502 })
    }

    const d = r.data as Record<string, string>
    return NextResponse.json({
      ok: true,
      env,
      side,
      symbol,
      qty: Number(qty),
      price: Number(price) || 0,
      orderNo: d.ord_no || d.order_no || null,
      message: r.data.return_msg || 'OK',
    })
  } catch (e) {
    return NextResponse.json({ ok: false, env, error: String(e) }, { status: 500 })
  }
}
