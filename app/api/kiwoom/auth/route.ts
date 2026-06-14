import { NextRequest, NextResponse } from 'next/server'
import {
  getKiwoomToken, getCachedTokenExpiry, kiwoomAccount, kiwoomBase, kiwoomConfigured, parseEnv,
} from '@/app/lib/finance/kiwoom'

export const dynamic = 'force-dynamic'

// GET /api/kiwoom/auth?env=mock|prod
// env 미지정 시 양쪽 환경 모두 상태 보고
export async function GET(req: NextRequest) {
  const envParam = req.nextUrl.searchParams.get('env')

  if (!envParam) {
    return NextResponse.json({
      mock: await statusFor('mock'),
      prod: await statusFor('prod'),
      account: kiwoomAccount() ? `***${kiwoomAccount().slice(-4)}` : null,
    })
  }

  const env = parseEnv(envParam)
  return NextResponse.json({ ...(await statusFor(env)), account: kiwoomAccount() ? `***${kiwoomAccount().slice(-4)}` : null })
}

async function statusFor(env: 'mock' | 'prod') {
  const base = kiwoomBase(env)
  const configured = kiwoomConfigured(env)
  if (!configured) {
    return { env, base, configured: false, ok: false, error: '키 미설정' }
  }
  try {
    const token = await getKiwoomToken(env)
    const exp = getCachedTokenExpiry(env)
    return {
      env, base, configured: true, ok: true,
      tokenMask: token.slice(0, 13) + '...' + token.slice(-4),
      expiresAt: exp ? new Date(exp).toISOString() : null,
      expiresInMin: exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null,
    }
  } catch (e) {
    return { env, base, configured: true, ok: false, error: String(e) }
  }
}
