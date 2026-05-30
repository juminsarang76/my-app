import { NextRequest, NextResponse } from 'next/server'
import { callKiwoomTR, kiwoomConfigured, kiwoomEnv } from '@/app/lib/kiwoom'

export const dynamic = 'force-dynamic'

// POST /api/kiwoom/order
// Body:
//   side:    'buy' | 'sell'
//   symbol:  '005930'
//   qty:     number      (수량)
//   price:   number      (지정가일 때만 필요)
//   tradeTp: '0'(보통/지정가) | '3'(시장가) | '5'(조건부지정가) ...
//   market:  'KRX' | 'NXT' | 'SOR'  (기본 KRX)
//   confirm: true  (실거래 환경에서 명시 확인)
export async function POST(req: NextRequest) {
  if (!kiwoomConfigured()) {
    return NextResponse.json({ error: 'KIWOOM_APPKEY/SECRETKEY 미설정' }, { status: 400 })
  }

  let body: {
    side?: string; symbol?: string; qty?: number | string;
    price?: number | string; tradeTp?: string; market?: string;
    confirm?: boolean;
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { side, symbol, qty, price = '', tradeTp = '0', market = 'KRX', confirm = false } = body
  if (side !== 'buy' && side !== 'sell') return NextResponse.json({ error: "side must be 'buy' or 'sell'" }, { status: 400 })
  if (!symbol || !/^\d{6}$/.test(symbol)) return NextResponse.json({ error: 'symbol(6-digit) required' }, { status: 400 })
  if (!qty || Number(qty) <= 0) return NextResponse.json({ error: 'qty > 0 required' }, { status: 400 })

  // 시장가가 아닌 경우 가격 필수
  if (tradeTp !== '3' && (!price || Number(price) <= 0)) {
    return NextResponse.json({ error: 'price required for non-market order' }, { status: 400 })
  }

  // 실거래 환경에선 confirm 플래그 강제
  if (kiwoomEnv() === 'production' && !confirm) {
    return NextResponse.json({ error: '실거래 환경에선 confirm=true 필수' }, { status: 400 })
  }

  // api-id: 매수 kt10000, 매도 kt10001
  const apiId = side === 'buy' ? 'kt10000' : 'kt10001'

  try {
    const r = await callKiwoomTR({
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
        error: r.data.return_msg || `status ${r.status}`,
        raw: r.data,
      }, { status: 502 })
    }

    const d = r.data as Record<string, string>
    return NextResponse.json({
      ok: true,
      env: kiwoomEnv(),
      side,
      symbol,
      qty: Number(qty),
      price: Number(price) || 0,
      orderNo: d.ord_no || d.order_no || null,
      message: r.data.return_msg || 'OK',
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
