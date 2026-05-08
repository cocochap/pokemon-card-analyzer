# Déploiement sur Hostinger VPS

## Prérequis

- Un **VPS Hostinger** (KVM2 minimum recommandé : 2 vCPU, 8 Go RAM, 100 Go SSD)
  - Plan recommandé : KVM4 (4 vCPU, 16 Go RAM) pour un usage en production avec trafic
  - Ubuntu 22.04 LTS
- Un **nom de domaine** pointant sur l'IP du VPS (A record)
- Un compte **GitHub** avec le repo

---

## 1. Choisir le bon plan Hostinger VPS

| Plan   | vCPU | RAM   | SSD    | Prix/mois | Usage                         |
|--------|------|-------|--------|-----------|-------------------------------|
| KVM1   | 1    | 4 Go  | 50 Go  | ~5€       | Dev / test                    |
| KVM2   | 2    | 8 Go  | 100 Go | ~9€       | ✅ Minimum production         |
| KVM4   | 4    | 16 Go | 200 Go | ~15€      | ✅ Production confortable     |
| KVM8   | 8    | 32 Go | 400 Go | ~28€      | Production avec beaucoup de trafic |

---

## 2. Configurer le DNS

Dans le panel Hostinger → Domains → votre domaine → DNS :

```
Type  Nom   Valeur              TTL
A     @     VOTRE_IP_VPS        300
A     www   VOTRE_IP_VPS        300
```

Attendez 5-15 minutes que le DNS se propage.

---

## 3. Setup initial du VPS (une seule fois)

Connectez-vous en SSH depuis votre terminal :

```bash
ssh root@VOTRE_IP_VPS
```

Lancez le script de setup :

```bash
curl -sSL https://raw.githubusercontent.com/VOTRE_USERNAME/pokemon-card-analyzer/main/infrastructure/scripts/setup-vps.sh \
  | bash -s -- votre-domaine.com
```

Ce script installe automatiquement :
- Docker + Docker Compose
- Firewall UFW (ports 80, 443, 22 ouverts)
- Fail2ban (protection brute force SSH)
- Swap 2 Go
- Certificat SSL Let's Encrypt
- Génère une clé SSH pour GitHub Actions

**À la fin du script, copiez la clé SSH privée affichée** — vous en aurez besoin à l'étape suivante.

---

## 4. Configurer les secrets GitHub

Dans votre repo GitHub → **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|--------|--------|
| `VPS_HOST` | IP publique de votre VPS (ex: `185.238.x.x`) |
| `VPS_USER` | `root` (ou l'utilisateur créé) |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | Clé privée affichée par le script setup (commence par `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `DOMAIN` | `votre-domaine.com` |
| `POSTGRES_PASSWORD` | Mot de passe fort (ex: généré avec `openssl rand -base64 32`) |
| `REDIS_PASSWORD` | Mot de passe fort |
| `CLERK_SECRET_KEY` | `sk_live_...` depuis dashboard.clerk.com |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_SECRET_KEY` | `sk_live_...` depuis dashboard.stripe.com |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `POKEMON_TCG_API_KEY` | Clé depuis pokemontcg.io/develop |
| `RESEND_API_KEY` | `re_...` depuis resend.com |

---

## 5. Configurer le domaine dans Nginx

Dans le fichier `infrastructure/nginx/conf.d/pokemarket.conf`, remplacez `DOMAIN_PLACEHOLDER` par votre vrai domaine :

```bash
# Sur votre machine locale
sed -i 's/DOMAIN_PLACEHOLDER/votre-domaine.com/g' \
  infrastructure/nginx/conf.d/pokemarket.conf

git add infrastructure/nginx/conf.d/pokemarket.conf
git commit -m "chore: configure domain for nginx"
git push
```

---

## 6. Premier déploiement

```bash
git push origin main
```

GitHub Actions va :
1. Lancer les tests
2. Construire les 3 images Docker (web, api, ai)
3. Les pousser sur GitHub Container Registry (GHCR)
4. Se connecter en SSH au VPS Hostinger
5. Tirer les nouvelles images
6. Lancer les migrations Prisma
7. Redémarrer les containers

Suivez le déploiement dans l'onglet **Actions** de votre repo GitHub.

---

## 7. Premier seed de la base de données

Après le premier déploiement, peuplez la BDD avec toutes les cartes :

```bash
ssh root@VOTRE_IP_VPS

cd /opt/pokemarket
docker compose -f infrastructure/docker/docker-compose.prod.yml exec api \
  npx ts-node prisma/seed.ts
```

Cette commande récupère toutes les cartes depuis l'API Pokémon TCG (peut prendre 30-60 min selon le nombre de sets).

---

## 8. Vérifications post-déploiement

```bash
# Sur le VPS

# Statut de tous les containers
docker compose -f /opt/pokemarket/infrastructure/docker/docker-compose.prod.yml ps

# Logs en direct
docker compose -f /opt/pokemarket/infrastructure/docker/docker-compose.prod.yml logs -f

# Health checks individuels
curl https://votre-domaine.com/api/v1/health
curl https://votre-domaine.com

# Ressources système
docker stats
htop
```

---

## 9. Backups automatiques

Ajoutez ce cron sur le VPS pour des backups PostgreSQL quotidiens à 2h du matin :

```bash
crontab -e
# Ajoutez cette ligne :
0 2 * * * /opt/pokemarket/infrastructure/scripts/backup.sh >> /var/log/pokemarket-backup.log 2>&1
```

Les backups sont conservés 7 jours dans `/opt/pokemarket/backups/`.

---

## Flux CI/CD complet

```
Votre machine locale
    │
    │  git push origin main
    ▼
GitHub
    │
    ├─ CI (ci.yml) → Tests + lint sur chaque PR
    │
    └─ Deploy (deploy-hostinger.yml) → sur push main
         │
         ├─ 1. Tests
         ├─ 2. Build images Docker → GHCR
         └─ 3. SSH → Hostinger VPS
                  │
                  ├─ docker pull (nouvelles images)
                  ├─ prisma migrate deploy
                  ├─ rolling update (zero downtime)
                  └─ docker image prune
```

---

## Coûts estimés

| Service | Coût/mois |
|---------|-----------|
| Hostinger KVM2 VPS | ~9€ |
| Domaine (Hostinger) | ~1€ |
| Clerk (Free tier) | 0€ |
| Stripe (commissions) | 1.4% + 0.25€/transaction |
| Pokemon TCG API | 0€ |
| Resend (3000 emails/mois gratuits) | 0€ |
| **Total infra** | **~10€/mois** |

---

## Commandes utiles sur le VPS

```bash
# Voir tous les containers
docker ps

# Logs d'un service
docker logs pokemarket-api -f --tail 100

# Accéder à la BDD
docker exec -it pokemarket-postgres psql -U pokemarket

# Redémarrer un service
docker restart pokemarket-api

# Mettre à jour manuellement (sans CI)
cd /opt/pokemarket
docker compose -f infrastructure/docker/docker-compose.prod.yml pull
docker compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Voir l'espace disque
df -h
docker system df
```
