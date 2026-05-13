'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'

const TESTIMONIALS = [
  {
    name: 'Alexandre D.',
    role: 'Collectionneur & Investisseur',
    avatar: 'AD',
    text: 'PokeScard a complètement changé ma façon d\'évaluer ma collection. La prédiction PSA est incroyablement précise — ça m\'a évité de surpayer une carte qui était en réalité PSA 7.',
    stars: 5,
    avatarColor: '#2563EB',
  },
  {
    name: 'Marie-Laure G.',
    role: 'Joueuse & Collectionneuse',
    avatar: 'MG',
    text: 'Je scanne maintenant chaque carte que j\'acquiers. Les tendances de marché et l\'historique des prix sont exactement ce qu\'il me faut pour bien timer mes achats et ventes.',
    stars: 5,
    avatarColor: '#7C3AED',
  },
  {
    name: 'Thomas K.',
    role: 'Gradeur certifié PSA',
    avatar: 'TK',
    text: 'L\'analyse de condition de l\'IA est remarquablement proche de ce qu\'on observe en gradation professionnelle. Un excellent outil de pré-évaluation pour les collectionneurs sérieux.',
    stars: 5,
    avatarColor: '#059669',
  },
]

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
      ))}
    </div>
  )
}

export function SocialProof() {
  const t = useT()
  const sp = t.socialProof

  const STATS = [
    { value: '22 000+', label: sp.stat1Label },
    { value: '94%',     label: sp.stat2Label },
    { value: '< 2s',    label: sp.stat3Label },
    { value: '50k+',    label: sp.stat4Label },
  ]

  return (
    <section className="mt-16">
      {/* Stats strip */}
      <div className="rounded-2xl p-6 mb-12"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.04) 100%)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="text-center"
            >
              <div className="text-3xl font-bold font-mono mb-1 gradient-text-electric">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{sp.title}</h2>
        <p className="text-muted-foreground">{sp.subtitle}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {TESTIMONIALS.map(({ name, role, avatar, text, stars, avatarColor }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="glass-card p-5 flex flex-col gap-4"
          >
            <StarRating count={stars} />
            <p className="text-sm text-foreground/80 leading-relaxed flex-1">&quot;{text}&quot;</p>
            <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: avatarColor }}>
                {avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
