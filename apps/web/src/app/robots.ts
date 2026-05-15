import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pokescard.fr'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/portfolio',
          '/alerts',
          '/scan',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
