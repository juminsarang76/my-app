import { NextResponse } from 'next/server'
import { getKiwoomToken, kiwoomEnv, kiwoomBase, kiwoomAccount, kiwoomConfigured, getCachedTokenExpiry } from '@/app/lib/kiwoom'

export const dynamic = 'force-dynamic'

export async function GET() {
  const env = kiwoomEnv()
  const base = kiwoomBase()
  const account = kiwoomAccount()
  const configured = kiwoomConfigured()

  if (!configured) {
    return NextResponse.json({
      ok: false,
      env, base,
      configured: false,
      error: 'KIWOOM_APPKEY / KIWOOM_SECRETKEY 환경변수 누락',
    })
  }

  try {
    const token = await getKiwoomToken()
    const exp = getCachedTokenExpiry()
    return NextResponse.json({
      ok: true,
      env, base,
      configured: true,
      account: account ? `***${account.slice(-4)}` : null,
      tokenMask: token.slice(0, 13) + '...' + token.slice(-4),
      expiresAt: exp ? new Date(exp).toISOString() : null,
      expiresInMin: exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      env, base,
      configured: true,
      error: String(e),
    }, { status: 500 })
  }
}
