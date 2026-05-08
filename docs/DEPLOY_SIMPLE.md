# Déploiement — Version simple et gratuite

**10 à 15 minutes, aucun serveur à gérer.**

---

## Stack gratuite

| Service | Gratuit | Rôle |
|---------|---------|------|
| **Vercel** | ✅ Toujours gratuit | Héberge le site Next.js |
| **Neon.tech** | ✅ 512 Mo PostgreSQL | Base de données |
| **Upstash** | ✅ 10k req/jour Redis | Cache |
| **Clerk** | ✅ 10k utilisateurs | Authentification |
| **GitHub** | ✅ | Code + déploiement auto |
| **Hostinger** | Déjà payé | Votre domaine |

---

## Étape 1 — Base de données Neon

1. Allez sur **[neon.tech](https://neon.tech)** → Sign up (gratuit)
2. **New Project** → choisissez `eu-central-1` (Europe)
3. Copiez la **Connection string** (format `postgresql://...?sslmode=require`)

---

## Étape 2 — Cache Upstash

1. Allez sur **[console.upstash.com](https://console.upstash.com)** → Sign up (gratuit)
2. **Create Database** → type `Redis` → region `eu-west-1`
3. Copiez **REST URL** et **REST Token**

---

## Étape 3 — Auth Clerk

1. Allez sur **[dashboard.clerk.com](https://dashboard.clerk.com)** → Create application
2. Choisissez les providers (Google, email, etc.)
3. Copiez **Publishable key** et **Secret key**

---

## Étape 4 — Déployer sur Vercel

### Option A — Interface web (la plus simple)

1. Allez sur **[vercel.com](https://vercel.com)** → Sign up avec GitHub
2. **Add New Project** → importez votre repo GitHub
3. **Root Directory** : `apps/web`
4. **Environment Variables** — ajoutez toutes les variables de `.env.example`
5. Cliquez **Deploy** ✅

Vercel redéploie automatiquement à chaque `git push` sur `main`.

### Option B — Via GitHub Actions

Ajoutez ces secrets dans GitHub (Settings → Secrets → Actions) :

| Secret | Où le trouver |
|--------|---------------|
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID` | vercel.com → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | votre projet Vercel → Settings → General |
| `DATABASE_URL` | Neon dashboard |

Puis faites un `git push origin main` — le workflow `.github/workflows/deploy-vercel.yml` s'exécute automatiquement.

---

## Étape 5 — Migrations base de données

Après le premier déploiement, initialisez la BDD :

```bash
# Sur votre machine locale
cd apps/web
cp ../.env.example .env.local
# Remplissez DATABASE_URL avec votre URL Neon

pnpm db:generate   # génère le client Prisma
pnpm db:migrate    # crée les tables
pnpm db:seed       # importe toutes les cartes Pokémon (30-60 min)
```

---

## Étape 6 — Connecter votre domaine Hostinger

1. Dans **Vercel** → votre projet → **Settings → Domains**
2. Ajoutez `votre-domaine.com`
3. Dans **Hostinger** → Domains → votre domaine → DNS :

```
Type    Nom   Valeur
A       @     76.76.21.21      (IP fournie par Vercel)
CNAME   www   cname.vercel-dns.com
```

Vercel gère le SSL automatiquement. ✅

---

## Développement local

```bash
git clone https://github.com/VOTRE_USERNAME/pokemon-card-analyzer
cd pokemon-card-analyzer
pnpm install

cd apps/web
cp .env.example .env.local
# Remplissez les variables

pnpm db:generate
pnpm db:migrate
pnpm dev          # → http://localhost:3000
```

---

## Structure finale (tout dans apps/web)

```
apps/web/
├── prisma/
│   ├── schema.prisma     # schéma BDD
│   └── seed.ts           # import des cartes
├── src/
│   ├── app/
│   │   ├── api/          # Route Handlers (remplace NestJS)
│   │   │   ├── cards/
│   │   │   ├── market/
│   │   │   ├── portfolio/
│   │   │   ├── alerts/
│   │   │   ├── ai/
│   │   │   └── health/
│   │   ├── (pages)/      # Pages Next.js
│   │   └── layout.tsx
│   ├── components/       # Composants React
│   ├── lib/
│   │   ├── db/
│   │   │   ├── prisma.ts    # Client Prisma singleton
│   │   │   └── redis.ts     # Client Upstash Redis
│   │   ├── ai/
│   │   │   └── scorer.ts    # Moteur de scoring IA
│   │   ├── api.ts           # Client fetch (URLs relatives)
│   │   └── formatters.ts
│   └── stores/           # Zustand
└── .env.local            # Variables d'environnement
```
