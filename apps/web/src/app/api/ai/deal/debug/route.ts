import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest']

const PROMPT = `Analyze this marketplace listing image (Vinted, eBay, LeBonCoin, etc.) and extract information about the Pokémon card being sold.

READ ALL TEXT in the image: listing title, description, price tag, condition notes.

Return ONLY this exact JSON structure, no other text:
{
  "cardName": "<name as shown, e.g. Dracaufeu ex>",
  "englishName": "<English name, e.g. Charizard ex>",
  "cardNumber": "<full number e.g. 006/165 or SV107/SV122>",
  "setName": "<expansion name e.g. 151 or Flammes Obsidiennes>",
  "setId": "<pokemontcg.io ID if certain e.g. sv3pt5, else empty string>",
  "language": "<FR or EN or JP>",
  "condition": "<Neuf or Comme neuf or Bon état or État correct or empty>",
  "listingPrice": <price as number e.g. 25.00>,
  "currency": "EUR",
  "listingTitle": "<full listing title text>"
}

Rules:
- listingPrice must be a NUMBER (not a string)
- If you cannot read a value, use empty string "" or 0 for price
- cardNumber must include both parts: "006/165" not just "006"
- Read the listing TITLE first — most reliable source`

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauth' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'no image' }, { status: 400 })

  const mime = file.type.startsWith('image/') ? file.type : 'image/jpeg'
  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const results: Record<string, any> = {}

  // Test Gemini models
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: PROMPT }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
          }),
          signal: AbortSignal.timeout(20000),
        }
      )
      const body = await res.json()
      if (!res.ok) {
        results[model] = { status: res.status, error: body?.error?.message }
      } else {
        const text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        results[model] = { status: 200, text, length: text.length }
      }
    } catch (e: any) {
      results[model] = { error: e.message }
    }
  }

  // Test Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            { type: 'text', text: PROMPT },
          ]}],
          max_tokens: 400, temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      })
      const body = await res.json()
      if (!res.ok) {
        results['groq'] = { status: res.status, error: body?.error?.message }
      } else {
        const text = body?.choices?.[0]?.message?.content ?? ''
        results['groq'] = { status: 200, text, length: text.length }
      }
    } catch (e: any) {
      results['groq'] = { error: (e as any).message }
    }
  }

  return NextResponse.json({ results })
}
