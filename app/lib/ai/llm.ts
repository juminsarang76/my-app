// 공용 LLM 호출 — Claude(1순위) → Gemini → Groq → Cerebras 폴백 체인
// JSON 모드(callLLM)와 평문 모드(callLLMText) 모두 지원
// (검색·RSS 파서는 ./search 로 분리)

import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY      = process.env.GROQ_API_KEY
const CEREBRAS_API_KEY  = process.env.CEREBRAS_API_KEY
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY

// Anthropic Claude (공식 SDK) — Sonnet 4.6
async function callAnthropic(messages: { role: string; content: string }[], opts: ChatOpts): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsg   = messages.find(m => m.role === 'user')?.content ?? ''
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens ?? 8192,
    // JSON 모드: 스키마 없이 시스템 지시로 강제 (callers가 JSON.parse)
    system: opts.json
      ? `${systemMsg}\n\n반드시 유효한 JSON만 출력하세요. 설명, 머리말, 코드펜스(\`\`\`) 없이 JSON 값 하나만 반환합니다.`
      : systemMsg,
    messages: [{ role: 'user', content: userMsg }],
  })
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim()
  // 혹시 코드펜스가 붙으면 제거
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

export interface ChatOpts {
  json?: boolean          // true면 JSON 응답 강제
  maxTokens?: number
  temperature?: number
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

// 폴백 체인: Claude(1순위) → Gemini → Groq → Cerebras
async function callChat(
  systemPrompt: string, userPrompt: string, opts: ChatOpts
): Promise<{ text: string; provider: string }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]

  if (ANTHROPIC_API_KEY) {
    try {
      return { text: await callAnthropic(messages, opts), provider: 'Claude' }
    } catch (e) {
      console.warn('Claude 실패, Gemini 시도:', (e as Error).message)
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
