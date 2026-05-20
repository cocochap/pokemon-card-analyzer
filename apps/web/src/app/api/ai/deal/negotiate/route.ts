import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

async function callAI(prompt: string): Promise<string | null> {
  // Gemini text-only (no image needed)
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 300 } }),
          signal: AbortSignal.timeout(15000) }
      )
      if (res.status === 429 || !res.ok) continue
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text) return text
    } catch {}
  }

  // Fallback Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'meta-llama/llama-4-scout-17b-16e-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.7 }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const json = await res.json()
        return json?.choices?.[0]?.message?.content ?? null
      }
    } catch {}
  }
  return null
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ ok: false, error: 'Connexion requise' }, { status: 401 })

  const { cardName, listingPrice, marketPrice, condition, listingTitle, dealScore } = await req.json()

  if (!cardName || !listingPrice) return NextResponse.json({ ok: false, error: 'Données manquantes' }, { status: 400 })

  const priceDiff = marketPrice > 0 ? ((listingPrice - marketPrice) / marketPrice * 100).toFixed(1) : null
  const isOverpriced = priceDiff !== null && parseFloat(priceDiff) > 5
  const suggestedPrice = marketPrice > 0
    ? (listingPrice > marketPrice
      ? (marketPrice * 0.93).toFixed(2)
      : (listingPrice * 0.95).toFixed(2))
    : (listingPrice * 0.92).toFixed(2)

  const prompt = `Tu es un expert en cartes Pokémon qui aide à négocier sur Vinted.

Génère UN message de négociation court, naturel et poli en français pour cette annonce Vinted :
- Carte : ${cardName}
- Prix demandé : ${listingPrice}€
- Prix du marché CardMarket : ${marketPrice > 0 ? marketPrice + '€' : 'inconnu'}
- État mentionné : ${condition || 'non précisé'}
- Titre annonce : ${listingTitle || cardName}
- Score deal : ${dealScore}/100 ${isOverpriced ? '(prix au-dessus du marché)' : ''}

Le message doit :
- Être court (2-3 phrases max)
- Commencer par "Bonjour !"
- Montrer un intérêt sincère pour la carte
- ${isOverpriced && marketPrice > 0 ? `Proposer ${suggestedPrice}€ en mentionnant le prix CardMarket comme référence` : `Proposer ${suggestedPrice}€ de manière positive`}
- Rester courtois et non-agressif
- Ne pas mentionner de site concurrent (juste "le marché" ou "les prix actuels")

Réponds avec UNIQUEMENT le message, sans introduction ni explication.`

  const message = await callAI(prompt)

  if (!message) {
    // Fallback template si l'IA échoue
    const fallback = marketPrice > 0
      ? `Bonjour ! Je suis très intéressé(e) par votre ${cardName}. En me basant sur les prix du marché actuels (${marketPrice.toFixed(2)}€), seriez-vous d'accord pour ${suggestedPrice}€ ? Merci !`
      : `Bonjour ! Je suis très intéressé(e) par votre ${cardName}. Seriez-vous d'accord pour ${suggestedPrice}€ ? Merci !`
    return NextResponse.json({ ok: true, message: fallback, source: 'template' })
  }

  return NextResponse.json({ ok: true, message: message.trim(), source: 'ai' })
}
