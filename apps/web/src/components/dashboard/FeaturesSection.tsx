'use client'

import { motion } from 'framer-motion'
import { BarChart3, Camera, Package, Shield, Sparkles, Star, TrendingUp } from 'lucide-react'

const features = [
  {
    icon: Camera,
    color: '#FFCB05',
    bg: 'rgba(255,203,5,0.10)',
    border: 'rgba(255,203,5,0.25)',
    title: 'Scan IA instantané',
    desc: "Photographiez n'importe quelle carte Pokémon et obtenez l'identification en moins de 2 secondes. Fonctionne même avec des cartes japonaises ou anglaises.",
    badge: 'Nouveau',
    badgeBg: 'rgba(255,203,5,0.12)',
    badgeColor: '#FFCB05',
  },
  {
    icon: TrendingUp,
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.25)',
    title: 'Prix Cardmarket live',
    desc: 'Valeur de marché actualisée quotidiennement depuis Cardmarket en euros. Historique 30 jours et variation de prix inclus.',
    badge: 'Live',
    badgeBg: 'rgba(34,197,94,0.12)',
    badgeColor: '#22C55E',
  },
  {
    icon: Package,
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.25)',
    title: 'Gestion de collection',
    desc: "Construisez votre portfolio, suivez la valeur totale et les performances de votre collection en temps réel.",
    badge: null,
    badgeBg: '',
    badgeColor: '',
  },
  {
    icon: Star,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.25)',
    title: 'Pré-grading PSA IA',
    desc: "Notre IA analyse l'état de votre carte (centrage, coins, surface) et estime la note PSA probable avant envoi en grading.",
    badge: 'Premium',
    badgeBg: 'rgba(255,203,5,0.10)',
    badgeColor: '#FFCB05',
  },
  {
    icon: BarChart3,
    color: '#60A5FA',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.25)',
    title: "Analyses d'investissement",
    desc: "Score d'investissement, RSI, volatilité 30j et picks du mois générés par IA. Identifiez les meilleures opportunités du marché Pokémon.",
    badge: 'Premium',
    badgeBg: 'rgba(255,203,5,0.10)',
    badgeColor: '#FFCB05',
  },
  {
    icon: Shield,
    color: '#F87171',
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.25)',
    title: 'Détection de faux',
    desc: "L'IA analyse la texture d'impression, le hologramme et les proportions pour détecter les contrefaçons avant achat.",
    badge: 'Bientôt',
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeColor: 'rgba(255,255,255,0.35)',
  },
] as const

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="text-center mb-14">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="inline-flex mb-4">
          <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.20)', color: '#FFCB05' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Fonctionnalités
          </span>
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.08 }} className="text-3xl md:text-4xl font-bold text-white mb-4">
          Tout ce qu'il faut pour votre collection
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.14 }} className="text-white/45 text-lg max-w-lg mx-auto">
          De la simple identification à l'analyse d'investissement avancée.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="group rounded-2xl p-6 transition-all duration-300 cursor-default"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                style={{ background: feat.bg, border: `1px solid ${feat.border}` }}>
                <feat.icon className="w-6 h-6" style={{ color: feat.color }} />
              </div>
              {feat.badge && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: feat.badgeBg, color: feat.badgeColor }}>
                  {feat.badge}
                </span>
              )}
            </div>
            <h3 className="font-bold text-white mb-2 text-lg">{feat.title}</h3>
            <p className="text-white/40 text-sm leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
