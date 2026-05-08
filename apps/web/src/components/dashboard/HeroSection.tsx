'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, BarChart2, Brain, Shield, TrendingUp, Zap } from 'lucide-react'

const stats = [
  { label: 'Cards tracked', value: '250,000+' },
  { label: 'Daily data points', value: '5M+' },
  { label: 'Active investors', value: '42K+' },
  { label: 'Avg accuracy AI', value: '84%' },
]

const features = [
  { icon: BarChart2, label: 'Live prices' },
  { icon: Brain, label: 'AI predictions' },
  { icon: TrendingUp, label: 'Market trends' },
  { icon: Shield, label: 'Portfolio tracking' },
]

export function HeroSection() {
  return (
    <section className="py-12 text-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-pokemon-yellow/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-pokemon-blue/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-pokemon-yellow/10 border border-pokemon-yellow/30 rounded-full text-pokemon-yellow text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          <span>The Bloomberg Terminal of Pokémon TCG</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
          Invest in Pokémon
          <br />
          <span className="gradient-text">like a Pro</span>
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
          Real-time prices, AI-powered predictions, and advanced analytics for every Pokémon TCG card.
          Track your portfolio like a hedge fund manager.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 px-6 py-3 bg-pokemon-yellow text-background font-semibold rounded-xl hover:bg-pokemon-yellow/90 transition-all duration-200 shadow-glow hover:scale-105"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/cards"
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-foreground font-medium rounded-xl hover:bg-white/10 transition-all duration-200"
          >
            Browse Cards
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-muted-foreground"
            >
              <Icon className="w-4 h-4 text-pokemon-yellow" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
      >
        {stats.map(({ label, value }) => (
          <div key={label} className="glass-card py-4 px-6">
            <div className="text-2xl font-bold text-pokemon-yellow font-mono">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
