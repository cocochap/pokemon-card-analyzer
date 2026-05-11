import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { LanguageModal } from '@/components/ui/LanguageModal'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'PokeMarket — Pokémon TCG Intelligence Platform',
    template: '%s | PokeMarket',
  },
  description:
    'The most advanced Pokémon TCG market analysis platform. Track prices, discover investment opportunities, and predict market trends with AI-powered insights.',
  keywords: [
    'pokemon cards',
    'pokemon tcg',
    'pokemon card prices',
    'pokemon investment',
    'card market',
    'pokemon portfolio',
    'psa prices',
    'card analytics',
    'pokemon market',
  ],
  authors: [{ name: 'PokeMarket' }],
  creator: 'PokeMarket',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pokemarket.io',
    siteName: 'PokeMarket',
    title: 'PokeMarket — Pokémon TCG Intelligence Platform',
    description: 'Advanced market analytics for Pokémon card investors',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PokeMarket — Pokémon TCG Intelligence Platform',
    description: 'Advanced market analytics for Pokémon card investors',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0e1a' },
    { media: '(prefers-color-scheme: light)', color: '#0a0e1a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
            <QueryProvider>
              <LanguageProvider>
                <LanguageModal />
                <div className="pb-mobile-nav md:pb-0">
                  {children}
                </div>
                <MobileBottomNav />
              </LanguageProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    backdropFilter: 'blur(10px)',
                  },
                  success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
                }}
              />

            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
