// 공용 LLM 호출 — Claude CLI(구독, 1순위) → Gemini → Groq → Cerebras 폴백 체인
// JSON 모드(callLLM)와 평문 모드(callLLMText) 모두 지원
// (검색·RSS 파서는 ./search 로 분리)

import { spawn } from 'child_process'

const GROQ_API_KEY      = process.env.GROQ_API_KEY
const CEREBRAS_API_KEY  = process.env.CEREBRAS_API_KEY
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY

// Claude Code CLI 헤드리스 호출 — 별도 API 키 없이 기존 Claude 구독 사용량으로 동작.
// claude CLI가 설치·로그인된 환경(로컬 PC 등)에서만 작동하며, 없으면(예: Vercel) ENOENT로
// 즉시 실패해 다음 프로바이더로 폴백된다. USE_CLAUDE_CLI=1 일 때만 시도.
const CLAUDE_CLI_ENABLED = process.env.USE_CLAUDE_CLI === '1'
const CLAUDE_CLI_BIN     = process.env.CLAUDE_CLI_PATH || 'claude'
const CLAUDE_CLI_MODEL   = process.env.CLAUDE_CLI_MODEL || 'sonnet'

export interface ChatOpts {
  json?: boolean          // true면 JSON 응답 강제
  maxTokens?: number
  temperature?: number
}

function callClaudeCLI(messages: { role: string; content: string }[], opts: ChatOpts): Promise<string> {
  const system = messages.find(m => m.role === 'system')?.content ?? ''
  const user   = messages.find(m => m.role === 'user')?.content ?? ''
  const jsonNote = opts.json
    ? '\n\n반드시 유효한 JSON 값 하나만 출력하세요. 설명·머리말·코드펜스(```) 없이 JSON만.'
    : ''
  const prompt = `${system ? system + '\n\n' : ''}${user}${jsonNote}`

  return new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_CLI_BIN, ['-p', '--model', CLAUDE_CLI_MODEL], {
      timeout: 120000,
      windowsHide: true,
    })
    let out = '', err = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', reject)  // ENOENT(예: Vercel) → 다음 프로바이더로 폴백
    child.on('close', code => {
      const text = out.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
      if (code === 0 && text) resolve(text)
      else reject(new Error(`claude CLI exit=${code} ${err.slice(0, 150)}`))
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

// OpenAI-compatible LLM 호출 (Groq / Cerebras 공용)
async function callOpenAICompat(
  baseUrl: string, apiKey: string, model: string, messages: object[], providerName: string, opts: ChatOpts
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`${providerName} ${res.status}: ${err.slice(0, 120)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content ?? ''
}

// Gemini (generateContent API) — 모델 단종 대비 다중 모델 순회
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

async function callGemini(messages: { role: string; content: string }[], opts: ChatOpts): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsg   = messages.find(m => m.role === 'user')?.content ?? ''
  let lastErr = ''
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )
    if (res.ok) {
      const data = await res.json()
      const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? []
      const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('').trim()
        || parts.map(p => p.text ?? '').join('').trim()
      if (text) return text
      lastErr = `${model} 빈 응답`
      continue
    }
    lastErr = `${model} ${res.status}: ${(await res.text().catch(() => res.statusText)).slice(0, 100)}`
    if (res.status !== 404) break  // 404(모델 없음)만 다음 모델 시도
  }
  throw new Error(`Gemini ${lastErr}`)
}

// 폴백 체인: Claude CLI(구독, 1순위) → Gemini → Groq → Cerebras
async function callChat(
  systemPrompt: string, userPrompt: string, opts: ChatOpts
): Promise<{ text: string; provider: string }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]

  if (CLAUDE_CLI_ENABLED) {
    try {
      return { text: await callClaudeCLI(messages, opts), provider: 'Claude(구독)' }
    } catch (e) {
      console.warn('Claude CLI 실패, Gemini 시도:', (e as Error).message)
    }
  }

  if (GEMINI_API_KEY) {
    try {
      return { text: await callGemini(messages, opts), provider: 'Gemini' }
    } catch (e) {
      console.warn('Gemini 실패, Groq 시도:', (e as Error).message)
    }
  }

  if (GROQ_API_KEY) {
    try {
      const text = await callOpenAICompat(
        'https://api.groq.com/openai/v1', GROQ_API_KEY,
        'llama-3.3-70b-versatile', messages, 'Groq', opts
      )
      return { text, provider: 'Groq' }
    } catch (e) {
      console.warn('Groq 실패, Cerebras 시도:', (e as Error).message)
    }
  }

  if (CEREBRAS_API_KEY) {
    const text = await callOpenAICompat(
      'https://api.cerebras.ai/v1', CEREBRAS_API_KEY,
      'llama-3.3-70b', messages, 'Cerebras', opts
    )
    return { text, provider: 'Cerebras' }
  }

  throw new Error('사용 가능한 LLM API 키가 없습니다. GEMINI_API_KEY / GROQ_API_KEY / CEREBRAS_API_KEY 중 하나 이상 필요.')
}

// JSON 응답 (temperature/maxTokens 등 opts 선택)
export function callLLM(systemPrompt: string, userPrompt: string, opts: Omit<ChatOpts, 'json'> = {}) {
  return callChat(systemPrompt, userPrompt, { ...opts, json: true })
}

// 평문 응답
export function callLLMText(systemPrompt: string, userPrompt: string, opts: ChatOpts = {}) {
  return callChat(systemPrompt, userPrompt, { ...opts, json: false })
}
