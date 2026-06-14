import { NextRequest, NextResponse } from 'next/server'
import { callKiwoomTR, parseKiwoomNum, kiwoomConfigured, parseEnv } from '@/app/lib/finance/kiwoom'

export const dynamic = 'force-dynamic'

// GET /api/kiwoom/quote?symbol=005930&env=mock|prod
export async function GET(req: NextRequest) {
  const env = parseEnv(req.nextUrl.searchParams.get('env'))
  if (!kiwoomConfigured(env)) {
    return NextResponse.json({ error: `${env === 'prod' ? '실전' : '모의'} 키 미설정` }, { status: 400 })
  }
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim()
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  try {
    const r = await callKiwoomTR(env, {
      apiId: 'ka10001',
      body: { stk_cd: symbol },
    })

    if (r.status !== 200 || (r.data.return_code != null && r.data.return_code !== 0)) {
      return NextResponse.json({
        error: r.data.return_msg || `status ${r.status}`,
        raw: r.data,
      }, { status: 502 })
    }

    const d = r.data as Record<string, string>
    const cur  = parseKiwoomNum(d.cur_prc)
    const chg  = parseKiwoomNum(d.pred_pre)
    const rate = parseKiwoomNum(d.flu_rt)

    const sig = d.pred_pre_sig
    const isUp   = sig === '1' || sig === '2' || cur.sign === 'up'
    const isDown = sig === '4' || sig === '5' || cur.sign === 'down'

    return NextResponse.json({
      env,
      symbol: d.stk_cd || symbol,
      name: d.stk_nm || symbol,
      current: cur.value,
      change: isDown ? -chg.value : chg.value,
      changePercent: isDown ? -rate.value : rate.value,
      isUp,
      isDown,
      open: parseKiwoomNum(d.open_pric).value,
      high: parseKiwoomNum(d.high_pric).value,
      low:  parseKiwoomNum(d.low_pric).value,
      volume: parseKiwoomNum(d.trde_qty).value,
      upperLimit: parseKiwoomNum(d.upl_pric).value,
      lowerLimit: parseKiwoomNum(d.lst_pric).value,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
