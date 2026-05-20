import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-pro-latest']

export async function GET() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY not set' })

  const results: Record<string, any> = {}
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say "OK" in one word.' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      )
      const body = await res.json()
      if (!res.ok) {
        results[model] = { status: res.status, error: body?.error?.message ?? JSON.stringify(body).substring(0, 200) }
      } else {
        const text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        results[model] = { status: 200, text, finishReason: body?.candidates?.[0]?.finishReason }
      }
    } catch (e: any) {
      results[model] = { error: `${e?.name}: ${e?.message}` }
    }
  }

  // Also list available models
  let availableModels: string[] = []
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`, { signal: AbortSignal.timeout(10000) })
    if (listRes.ok) {
      const data = await listRes.json()
      availableModels = (data.models ?? []).filter((m: any) => m.supportedGenerationMethods?.includes('generateContent')).map((m: any) => m.name)
    }
  } catch {}

  return NextResponse.json({ keyPrefix: key.substring(0, 10) + '...', availableModels, results })
}
