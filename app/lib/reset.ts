import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { getState, setState } from './state'

// 비밀번호 재설정용 1회성 토큰.
//
// 링크에 담기는 값은 난수 원문이고, 서버에는 해시만 저장한다(링크가 새도 DB 값으로는 복원 불가).
// 사용하는 즉시 저장분을 지워 재사용을 막는다. app_state 를 쓰므로 배포·재시작에도 살아남는다.

const KEY = 'password_reset'
const TTL_MS = 30 * 60 * 1000

type Stored = { email: string; hash: string; expiresAt: number }

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// 발급된 원문 토큰을 돌려준다. 같은 시점에 유효한 토큰은 하나뿐이다.
export async function issueResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await setState(KEY, {
    email: email.toLowerCase(),
    hash: hash(token),
    expiresAt: Date.now() + TTL_MS,
  } satisfies Stored)
  return token
}

// 유효하면 이메일을 돌려주고 토큰을 소비(삭제)한다. 아니면 null.
export async function consumeResetToken(token: string): Promise<string | null> {
  const stored = await getState<Stored>(KEY)
  if (!stored) return null
  if (Date.now() > stored.expiresAt) return null

  const a = Buffer.from(hash(token))
  const b = Buffer.from(stored.hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // 1회성 — 성공 즉시 무효화
  await setState(KEY, { email: '', hash: '', expiresAt: 0 } satisfies Stored)
  return stored.email
}
