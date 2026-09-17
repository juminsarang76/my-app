import { createHmac, timingSafeEqual } from 'crypto'

// 서버 전용 세션 토큰.
// 기존에는 관리자 판별을 x-admin-email 헤더 하나로만 했는데, 그 값은 누구나 붙일 수 있고
// ADMIN_EMAIL 자체가 클라이언트 번들에 노출돼 있어 사실상 인가가 없는 상태였다.
// 로그인 시 서버가 서명한 토큰을 발급하고, 보호가 필요한 라우트는 그 서명을 검증한다.

const TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14일

function secret(): string | null {
  return process.env.AUTH_SECRET || null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

export function createSessionToken(email: string): string | null {
  const key = secret()
  if (!key) return null
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), x: Date.now() + TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload, key)}`
}

// 유효하면 토큰에 담긴 이메일, 아니면 null
export function verifySessionToken(token: string | null | undefined): string | null {
  const key = secret()
  if (!key || !token) return null

  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const given = token.slice(dot + 1)

  const expected = sign(payload, key)
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof e !== 'string' || typeof x !== 'number' || Date.now() > x) return null
    return e
  } catch {
    return null
  }
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

// AUTH_SECRET 미설정 시에는 검증이 불가능하므로 통과시키지 않는다(fail-closed).
export function sessionEmail(req: Request): string | null {
  return verifySessionToken(bearerFrom(req))
}

export function isSecretConfigured(): boolean {
  return secret() !== null
}
