'use client'

import { motion } from 'framer-motion'
import {
  BarChart3, Camera, Package, Shield, Sparkles, Star, TrendingUp, Zap,
} from 'lucide-react'

const features = [
  {
    icon: Camera,
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50',
    title: 'Scan IA instantané',
    desc: "Photographiez n'importe quelle carte Pokémon et obtenez l'identification en moins de 2 secondes. Fonctionne même avec des cartes en japonais ou en anglais.",
    badge: 'Nouveau',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    icon: TrendingUp,
    gradient: 'from-green-500 to-emerald-700',
    bg: 'bg-green-50',
    title: 'Prix Cardmarket en temps réel',
    desc: 'Valeur de marché quotidiennement actualisée depuis Cardmarket en euros. Historique 30 jours inclus pour chaque carte.',
    badge: 'Live',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    icon: Package,
    gradient: 'from-violet-500 to-purple-700',
    bg: 'bg-violet-50',
    title: 'Gestion de collection',
    desc: "Construisez votre portfolio de cartes, suivez la valeur totale de votre collection et exportez vos données au format CSV.",
    badge: null,
    badgeColor: '',
  },
  {
    icon: Star,
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    title: 'Pré-grading PSA IA',
    desc: "Notre IA analyse l'état de votre carte (centrage, coins, surface, edges) et estime la note PSA probable avant envoi en grading.",
    badge: 'Pro',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    icon: BarChart3,
    gradient: 'from-sky-500 to-cyan-700',
    bg: 'bg-sky-50',
    title: 'Tendances & investissement',
    desc: 'Score d\'investissement, volatilité 30 jours, RSI et projection de valeur à 1, 3, 5 et 10 ans basées sur les tendances historiques.',
    badge: null,
    badgeColor: '',
  },
  {
    icon: Shield,
    gradient: 'from-rose-500 to-pink-700',
    bg: 'bg-rose-50',
    title: 'Détection de faux',
    desc: "L'IA analyse la texture d'impression, le hologramme et les proportions pour détecter les cartes contrefaites avant achat ou vente.",
    badge: 'Bientôt',
    badgeColor: 'bg-gray-100 text-gray-500',
  },
] as const

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      {/* Header */}
      <div className="text-center mb-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex mb-4"
        >
          <span className="section-label">
            <Sparkles className="w-3.5 h-3.5" />
            Fonctionnalités
          </span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          Tout ce qu'il faut pour votre collection
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.14 }}
          className="text-gray-500 text-lg max-w-lg mx-auto"
        >
          De la simple identification à l'analyse d'investissement avancée.
        </motion.p>
      </div>

      {/* Features grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-200 hover:shadow-[0_4px_24px_rgba(59,130,246,0.08)] transition-all duration-300"
          >
            {/* Icon + badge */}
            <div className="flex items-start justify-between mb-5">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200`}>
                <feat.icon className="w-6 h-6 text-white" />
              </div>
              {feat.badge && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${feat.badgeColor}`}>
                  {feat.badge}
                </span>
              )}
            </div>

            <h3 className="font-bold text-gray-900 mb-2 text-lg">{feat.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
