import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ScanUpload } from '@/components/scan/ScanUpload'
import { Camera, CheckCircle2, Shield, TrendingUp, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Scan a Card — PokeScan',
  description: 'Upload or photograph any Pokémon card and get instant AI-powered identification, PSA grade prediction, and real-time market value.',
}

const steps = [
  { icon: Camera,       title: 'Scan or Upload',    desc: 'Take a photo or upload an image of your card' },
  { icon: Zap,          title: 'AI Analysis',        desc: 'Our AI identifies the card in under 2 seconds' },
  { icon: TrendingUp,   title: 'Price & Grade',      desc: 'Get real-time value, PSA prediction and market data' },
  { icon: CheckCircle2, title: 'Track & Invest',     desc: 'Add to your portfolio or set price alerts' },
]

const features = [
  { icon: Shield,     label: '94% AI Accuracy',      desc: 'Trained on 22,000+ Pokémon cards' },
  { icon: Zap,        label: 'Instant Results',       desc: 'Analysis in under 2 seconds' },
  { icon: TrendingUp, label: 'Live Market Prices',   desc: 'Connected to Cardmarket & PSA' },
]

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 max-w-5xl py-10">

        {/* ── Page header ──────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#93C5FD',
            }}
          >
            <Camera className="w-4 h-4" />
            AI Card Scanner
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
            <span className="text-white">Scan your </span>
            <span className="gradient-text-electric">Pokémon Card</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload a photo or use your camera. Our AI instantly identifies the card, predicts the PSA grade, and shows real-time market prices.
          </p>
        </div>

        {/* ── Main content: upload + features ─────────────────── */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start mb-16">

          {/* Upload zone */}
          <ScanUpload />

          {/* Feature sidebar */}
          <div className="space-y-4 lg:sticky lg:top-24">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="glass-card p-4 flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <Icon className="w-5 h-5 text-electric-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-0.5">{label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}

            {/* Tip */}
            <div
              className="rounded-2xl p-4 text-sm"
              style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#FBBF24' }}>💡 Best results</p>
              <p className="text-muted-foreground leading-relaxed">
                Good lighting, flat surface, no glare. Keep the full card in frame including the border.
              </p>
            </div>
          </div>
        </div>

        {/* ── How it works ─────────────────────────────────────── */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">How it works</h2>
          <p className="text-muted-foreground text-sm">Four steps to unlock your card&apos;s full potential</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="glass-card p-5 text-center relative">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(59,130,246,0.1) 100%)',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}
              >
                <Icon className="w-6 h-6 text-electric-400" />
              </div>
              <div
                className="absolute top-3 right-3 text-xs font-bold"
                style={{ color: 'rgba(59,130,246,0.4)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <p className="font-semibold text-white text-sm mb-1.5">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  )
}
