import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions générales d'utilisation de PokeScard.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <LegalHeader title="Conditions d'utilisation" date="13 mai 2026" />

        <Section title="1. Acceptation des conditions">
          <p>En accédant à PokeScard, vous acceptez sans réserve les présentes conditions d'utilisation. Si vous ne les acceptez pas, veuillez ne pas utiliser le service.</p>
        </Section>

        <Section title="2. Description du service">
          <p>PokeScard est une plateforme en ligne permettant d'analyser des cartes Pokémon TCG par intelligence artificielle, de consulter les prix de marché Cardmarket, et de gérer un portfolio de collection. Le service est proposé en version gratuite et en version Premium.</p>
        </Section>

        <Section title="3. Compte utilisateur">
          <ul>
            <li>Vous devez avoir au moins 16 ans pour créer un compte</li>
            <li>Vous êtes responsable de la confidentialité de vos identifiants</li>
            <li>Vous vous engagez à fournir des informations exactes lors de l'inscription</li>
            <li>Nous nous réservons le droit de suspendre tout compte en cas d'utilisation abusive</li>
          </ul>
        </Section>

        <Section title="4. Abonnement Premium">
          <ul>
            <li>L'abonnement Premium est proposé au tarif de <strong>7€ par mois</strong></li>
            <li>Le paiement est prélevé automatiquement chaque mois via Stripe</li>
            <li>Vous pouvez annuler votre abonnement à tout moment depuis votre espace client</li>
            <li>L'annulation prend effet à la fin de la période de facturation en cours</li>
            <li>Aucun remboursement n'est effectué pour les périodes déjà facturées, sauf obligation légale</li>
          </ul>
        </Section>

        <Section title="5. Utilisation acceptable">
          <p>Il est interdit de :</p>
          <ul>
            <li>Utiliser le service à des fins illégales ou frauduleuses</li>
            <li>Tenter de contourner les limitations du compte gratuit de manière non autorisée</li>
            <li>Extraire massivement les données du service (scraping) sans autorisation</li>
            <li>Usurper l'identité d'un autre utilisateur</li>
            <li>Perturber le fonctionnement du service</li>
          </ul>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>Le code source, le design, les algorithmes d'analyse et les contenus de PokeScard sont la propriété exclusive de PokeScard. Les noms, images et marques Pokémon sont la propriété de Nintendo / The Pokémon Company. PokeScard n'est pas affilié à Nintendo ou The Pokémon Company.</p>
        </Section>

        <Section title="7. Limitation de responsabilité">
          <p>PokeScard fournit les analyses et prix à titre informatif uniquement. Nous ne garantissons pas l'exactitude des prix affichés ni les performances futures des cartes. PokeScard ne peut être tenu responsable des décisions d'investissement prises sur la base des informations du service.</p>
        </Section>

        <Section title="8. Disponibilité du service">
          <p>Nous mettons tout en œuvre pour assurer une disponibilité maximale du service. Cependant, des interruptions peuvent survenir pour maintenance ou en cas de force majeure. Aucune garantie de disponibilité n'est donnée.</p>
        </Section>

        <Section title="9. Modifications">
          <p>Nous nous réservons le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés par e-mail des modifications importantes. La poursuite de l'utilisation du service vaut acceptation des nouvelles conditions.</p>
        </Section>

        <Section title="10. Droit applicable">
          <p>Les présentes conditions sont soumises au droit français. Tout litige relève de la compétence exclusive des tribunaux français.</p>
        </Section>

        <Section title="11. Contact">
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
