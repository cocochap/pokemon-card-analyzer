import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db/prisma'

export const revalidate = 86400 // 24h

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pokemon-card-analyzer-web-git-main-cocochaps-projects.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const statics: MetadataRoute.Sitemap = [
    { url: BASE,              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/cards`,   lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/sets`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/ai`,      lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  // All sets
  const sets = await prisma.pokemonSet.findMany({
    select: { externalId: true, updatedAt: true },
    orderBy: { releaseDate: 'desc' },
  })
  const setUrls: MetadataRoute.Sitemap = sets.map(s => ({
    url: `${BASE}/sets/${s.externalId}`,
    lastModified: s.updatedAt ?? now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Top cards: those with prices first, then by investment score
  const cards = await prisma.card.findMany({
    where: { imageSmUrl: { not: null } },
    select: {
      id: true,
      updatedAt: true,
      marketData: { select: { investmentScore: true } },
      prices: { where: { source: 'cardmarket' }, select: { market: true }, take: 1 },
    },
    orderBy: [
      { marketData: { investmentScore: 'desc' } },
    ],
    take: 10000,
  })

  const cardUrls: MetadataRoute.Sitemap = cards.map(c => {
    const hasPrice = (c.prices?.length ?? 0) > 0
    const score = (c.marketData?.investmentScore ?? 0)
    return {
      url: `${BASE}/cards/${c.id}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: hasPrice ? 'daily' : 'weekly',
      priority: score >= 70 ? 0.8 : score >= 40 ? 0.6 : 0.5,
    }
  })

  return [...statics, ...setUrls, ...cardUrls]
}
