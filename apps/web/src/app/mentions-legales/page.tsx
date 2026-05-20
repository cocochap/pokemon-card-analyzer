import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales de PokeScard.',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <LegalHeader title="Mentions légales" date="18 mai 2026" />

        <Section title="1. Éditeur du site">
          <ul>
            <li><strong>Nom de l'éditeur</strong> : [À COMPLÉTER — nom ou raison sociale]</li>
            <li><strong>Adresse</strong> : [À COMPLÉTER]</li>
            <li><strong>Email</strong> : [À COMPLÉTER]</li>
            <li><strong>Directeur de la publication</strong> : [À COMPLÉTER]</li>
          </ul>
        </Section>

        <Section title="2. Hébergement">
          <ul>
            <li><strong>Hébergeur</strong> : Vercel Inc.</li>
            <li><strong>Adresse</strong> : 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis</li>
            <li><strong>Site</strong> : vercel.com</li>
          </ul>
        </Section>

        <Section title="3. Propriété intellectuelle">
          <p>L'ensemble du contenu du site PokeScard (textes, images, design, algorithmes) est protégé par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
          <p>Les noms, logos et marques Pokémon sont la propriété exclusive de Nintendo / The Pokémon Company International. PokeScard n'est pas affilié à ces sociétés.</p>
        </Section>

        <Section title="4. Données personnelles">
          <p>Le traitement des données personnelles est détaillé dans notre <a href="/privacy" className="underline">Politique de confidentialité</a>. Conformément au RGPD, vous pouvez exercer vos droits en nous contactant à l'adresse indiquée ci-dessus.</p>
        </Section>

        <Section title="5. Cookies">
          <p>Le site utilise des cookies strictement nécessaires à son fonctionnement (authentification, session) ainsi que des outils d'analyse d'audience (Vercel Analytics, PostHog) dans le but d'améliorer le service. Aucun cookie publicitaire n'est utilisé.</p>
        </Section>

        <Section title="6. Limitation de responsabilité">
          <p>PokeScard s'efforce de fournir des informations exactes et à jour. Cependant, nous ne pouvons garantir l'exactitude, l'exhaustivité ou l'actualité des informations diffusées. Les prix et analyses affichés sont fournis à titre indicatif uniquement et ne constituent pas des conseils financiers.</p>
        </Section>

        <Section title="7. Droit applicable">
          <p>Les présentes mentions légales sont soumises au droit français. Tout litige relève de la compétence exclusive des tribunaux français.</p>
        </Section>
      </main>
      <Footer />
    </div>
  )
}

function LegalHeader({ title, date }: { title: string; date: string }) {
  return (
    <div className="mb-10">
      <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
      <p className="text-sm text-white/30">Dernière mise à jour : {date}</p>
      <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,203,5,0.3), transparent)' }} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="text-white/55 text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-white/80 [&_a]:text-pokemon-yellow">
        {children}
      </div>
    </section>
  )
}
