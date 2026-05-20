import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { TierProvider } from '@/components/providers/TierProvider'
import { TierWelcomeBanner } from '@/components/ui/TierWelcomeBanner'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { LanguageModal } from '@/components/ui/LanguageModal'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { SplashScreen } from '@/components/ui/SplashScreen'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/next'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import '@/styles/globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pokescard.fr'),
  title: {
    default: 'PokeScard — Prix & Analyse Cartes Pokémon TCG',
    template: '%s | PokeScard',
  },
  description:
    'Scanner, analyser et suivre vos cartes Pokémon TCG avec l\'IA. Prix Cardmarket en temps réel, analyse d\'investissement, coffrets scellés et portfolio. La référence française du marché Pokémon.',
  keywords: [
    'prix carte pokémon',
    'carte pokémon tcg',
    'scanner carte pokémon',
    'valeur carte pokémon',
    'analyse carte pokémon',
    'investissement carte pokémon',
    'cardmarket pokémon',
    'coffret pokémon scellé',
    'pokémon tcg france',
    'prix booster pokémon',
    'carte pokémon rare',
    'pokémon portfolio',
    'pokémon psa',
    'pokémon card price',
    'scan carte pokemon',
  ],
  authors: [{ name: 'PokeScard' }],
  creator: 'PokeScard',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://www.pokescard.fr',
    siteName: 'PokeScard',
    title: 'PokeScard — Prix & Analyse Cartes Pokémon TCG',
    description: 'Scanner vos cartes Pokémon avec l\'IA, suivre les prix Cardmarket en temps réel et analyser vos investissements TCG.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PokeScard — Prix & Analyse Cartes Pokémon TCG',
    description: 'Scanner vos cartes Pokémon avec l\'IA, suivre les prix Cardmarket en temps réel et analyser vos investissements TCG.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.json',
  verification: {
    google: 'gYkdX2fbKndhGRQWCiam8XO5QuX0qnSo27m3uuw3xL4',
  },
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
          <PostHogProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
            <QueryProvider>
              <TierProvider>
              <LanguageProvider>
                <SplashScreen />
                <LanguageModal />
                <TierWelcomeBanner />
                <div className="pb-mobile-nav md:pb-0">
                  {children}
                </div>
                <MobileBottomNav />
              </LanguageProvider>
              </TierProvider>
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
          </PostHogProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
