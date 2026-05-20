import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de PokeScard — comment nous collectons et utilisons vos données.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <LegalHeader title="Politique de confidentialité" date="13 mai 2026" />

        <Section title="1. Qui sommes-nous ?">
          <p>PokeScard est une plateforme d'analyse et d'investissement dédiée aux cartes Pokémon TCG. Le responsable du traitement des données est PokeScard (ci-après « nous »).</p>
        </Section>

        <Section title="2. Données collectées">
          <p>Nous collectons les données suivantes :</p>
          <ul>
            <li><strong>Données de compte</strong> : adresse e-mail, nom d'utilisateur, photo de profil (via Clerk)</li>
            <li><strong>Données d'utilisation</strong> : scans effectués, cartes consultées, alertes créées, portfolio</li>
            <li><strong>Données de paiement</strong> : gérées exclusivement par Stripe — nous ne stockons aucune information bancaire</li>
            <li><strong>Données techniques</strong> : adresse IP, type de navigateur, pages visitées (logs serveur)</li>
          </ul>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul>
            <li>Fourniture et amélioration du service</li>
            <li>Gestion de votre compte et abonnement</li>
            <li>Envoi de notifications d'alertes de prix (si activées)</li>
            <li>Sécurité et prévention des fraudes</li>
            <li>Analyse statistique anonymisée de l'utilisation</li>
          </ul>
        </Section>

        <Section title="4. Base légale">
          <p>Le traitement est fondé sur :</p>
          <ul>
            <li><strong>L'exécution du contrat</strong> : fourniture du service souscrit</li>
            <li><strong>L'intérêt légitime</strong> : amélioration du service, sécurité</li>
            <li><strong>Le consentement</strong> : communications marketing (révocable à tout moment)</li>
          </ul>
        </Section>

        <Section title="5. Conservation des données">
          <p>Vos données sont conservées :</p>
          <ul>
            <li>Pendant la durée de votre compte actif</li>
            <li>3 ans après la suppression du compte (obligations légales)</li>
            <li>Les données de paiement sont conservées par Stripe selon leurs propres politiques</li>
          </ul>
        </Section>

        <Section title="6. Partage des données">
          <p>Nous ne vendons jamais vos données. Nous pouvons les partager avec :</p>
          <ul>
            <li><strong>Clerk</strong> : authentification et gestion des comptes</li>
            <li><strong>Stripe</strong> : traitement des paiements</li>
            <li><strong>Vercel / Neon</strong> : hébergement et base de données</li>
            <li><strong>PostHog</strong> : analyse du comportement utilisateur (événements anonymisés)</li>
            <li><strong>Vercel Analytics</strong> : statistiques de trafic agrégées et anonymes</li>
          </ul>
          <p>Ces sous-traitants sont engagés contractuellement à protéger vos données.</p>
        </Section>

        <Section title="7. Vos droits">
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul>
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement (« droit à l'oubli »)</li>
            <li>Droit à la portabilité</li>
            <li>Droit d'opposition au traitement</li>
          </ul>
          <p>Pour exercer ces droits, contactez-nous à <strong>contact@pokescard.com</strong>. Nous répondons sous 30 jours.</p>
        </Section>

        <Section title="8. Cookies et analytics">
          <p>Nous utilisons :</p>
          <ul>
            <li><strong>Cookies de session</strong> : strictement nécessaires à l'authentification et au fonctionnement du service</li>
            <li><strong>Vercel Analytics</strong> : mesure d'audience anonyme (pages vues, pays, appareils) — aucune donnée personnelle collectée</li>
            <li><strong>PostHog</strong> : analyse du comportement utilisateur (actions réalisées sur la plateforme) afin d'améliorer le service — les données sont pseudonymisées</li>
          </ul>
          <p>Aucun cookie publicitaire ou de ciblage n'est utilisé.</p>
        </Section>

        <Section title="9. Sécurité">
          <p>Vos données sont chiffrées en transit (HTTPS/TLS) et au repos. L'accès est restreint aux personnes autorisées. En cas de violation de données, vous serez notifié dans les 72 heures conformément au RGPD.</p>
        </Section>

        <Section title="10. Contact">
          <p>Pour toute question relative à vos données personnelles : <strong>contact@pokescard.com</strong></p>
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
