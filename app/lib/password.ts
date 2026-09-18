import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// 비밀번호 해싱.
//
// 기존 저장 형식은 솔트 없는 SHA-256(hex 64자)이라 레인보우 테이블에 그대로 뚫린다.
// 새 비밀번호는 scrypt + 임의 솔트로 저장하고, 기존 해시는 로그인에 성공하는 순간
// 조용히 새 형식으로 갈아끼운다(아래 needsUpgrade 참고). 별도 마이그레이션이 필요 없다.
//
// 새 형식:  scrypt$<salt(hex)>$<derived(hex)>
// 구 형식:  <sha256(hex 64자)>

const PREFIX = 'scrypt'
const KEYLEN = 64

export function hashPassword(pwd: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(pwd, salt, KEYLEN).toString('hex')
  return `${PREFIX}$${salt}$${derived}`
}

function legacyHash(pwd: string): string {
  return createHash('sha256').update(pwd).digest('hex')
}

export function verifyPassword(pwd: string, stored: string | null | undefined): boolean {
  if (!stored) return false

  if (stored.startsWith(`${PREFIX}$`)) {
    const [, salt, derived] = stored.split('$')
    if (!salt || !derived) return false
    const a = Buffer.from(derived, 'hex')
    const b = scryptSync(pwd, salt, KEYLEN)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  // 레거시 SHA-256
  const a = Buffer.from(stored, 'utf8')
  const b = Buffer.from(legacyHash(pwd), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

// 레거시 형식이면 true — 로그인 성공 시 새 해시로 교체한다
export function needsUpgrade(stored: string | null | undefined): boolean {
  return !!stored && !stored.startsWith(`${PREFIX}$`)
}

// 최소 요건. 강제는 느슨하게 두고 화면에서 안내한다.
export function validatePassword(pwd: string): string | null {
  if (typeof pwd !== 'string' || pwd.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (pwd.length > 200) return '비밀번호가 너무 깁니다.'
  return null
}
