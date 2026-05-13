import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Avertissement',
  description: "Avertissement légal de PokeScard — informations sur les risques d'investissement.",
}

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <LegalHeader title="Avertissement" date="13 mai 2026" />

        <div className="mb-8 p-4 rounded-xl"
          style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.20)' }}>
          <p className="text-sm text-pokemon-yellow font-semibold">
            ⚠️ Les informations fournies par PokeScard ne constituent pas des conseils financiers ou d'investissement.
          </p>
        </div>

        <Section title="1. Nature des informations">
          <p>PokeScard est une plateforme d'analyse de marché dédiée aux cartes Pokémon TCG. Les prix, scores d'investissement, analyses et projections affichés sont fournis à titre <strong>purement informatif et éducatif</strong>.</p>
          <p>Ces informations ne constituent en aucun cas :</p>
          <ul>
            <li>Des conseils financiers ou d'investissement</li>
            <li>Des recommandations d'achat ou de vente</li>
            <li>Une garantie de performance future</li>
            <li>Une évaluation officielle de la valeur des cartes</li>
          </ul>
        </Section>

        <Section title="2. Risques liés aux cartes à collectionner">
          <p>L'investissement dans les cartes à collectionner comporte des risques significatifs :</p>
          <ul>
            <li><strong>Perte en capital</strong> : la valeur des cartes peut baisser significativement</li>
            <li><strong>Liquidité limitée</strong> : il peut être difficile de revendre rapidement une carte au prix souhaité</li>
            <li><strong>Réimpressions</strong> : The Pokémon Company peut réimprimer des cartes, affectant leur valeur</li>
            <li><strong>Volatilité</strong> : les prix peuvent fluctuer fortement en peu de temps</li>
            <li><strong>Authenticité</strong> : le risque d'acquérir des contrefaçons existe sur le marché secondaire</li>
            <li><strong>Condition</strong> : l'état d'une carte impacte fortement sa valeur</li>
          </ul>
        </Section>

        <Section title="3. Sources de données">
          <p>Les prix affichés proviennent de Cardmarket (prix moyens observés sur le marché). Ces prix sont indicatifs et peuvent différer du prix réel auquel vous pourrez vendre ou acheter une carte. PokeScard ne garantit pas l'exactitude ou l'exhaustivité de ces données.</p>
        </Section>

        <Section title="4. Analyses IA">
          <p>Les scores d'investissement et analyses générés par intelligence artificielle sont basés sur des données historiques et des modèles statistiques. <strong>Les performances passées ne préjugent pas des performances futures.</strong> Ces algorithmes peuvent comporter des erreurs ou des biais.</p>
        </Section>

        <Section title="5. Votre responsabilité">
          <p>Toute décision d'achat, de vente ou de conservation de cartes Pokémon est prise sous votre entière responsabilité. Nous vous recommandons de :</p>
          <ul>
            <li>Faire vos propres recherches avant tout investissement</li>
            <li>Ne jamais investir plus que ce que vous pouvez vous permettre de perdre</li>
            <li>Consulter un conseiller financier agréé pour des montants significatifs</li>
            <li>Diversifier vos investissements</li>
          </ul>
        </Section>

        <Section title="6. Propriété intellectuelle Pokémon">
          <p>Pokémon, les noms des Pokémon et tous les personnages associés sont des marques déposées de Nintendo, Game Freak et Creatures Inc. The Pokémon Company International gère les droits du TCG. PokeScard n'est pas affilié, sponsorisé ou approuvé par ces entités.</p>
        </Section>

        <Section title="7. Contact">
          <p>Pour toute question : <strong>contact@pokescard.com</strong></p>
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
      <div className="text-white/55 text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-white/80">
        {children}
      </div>
    </section>
  )
}
