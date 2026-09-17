// Vercel 크론은 CRON_SECRET 환경변수가 설정돼 있으면
// 요청에 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동으로 붙여 보낸다.
// 이 헤더가 없는 외부 호출을 막아, URL만 아는 제3자가 LLM 호출·카카오 발송·DB 쓰기를
// 임의로 유발하지 못하게 한다.
//
// CRON_SECRET 이 없으면 검사를 건너뛴다 — 환경변수를 설정하기 전에도 크론이 깨지지 않는다.
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}
