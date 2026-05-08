#!/bin/bash
# ============================================================
# Script de setup VPS Hostinger — à lancer UNE SEULE FOIS
# en tant que root sur votre VPS Ubuntu 22.04
#
# Usage :
#   1. Connectez-vous via SSH : ssh root@VOTRE_IP
#   2. curl -sSL https://raw.githubusercontent.com/VOTRE_REPO/main/infrastructure/scripts/setup-vps.sh | bash
#      OU copiez et collez ce script directement.
# ============================================================

set -e
DOMAIN="${1:-pokemarket.io}"
APP_USER="pokemarket"
APP_DIR="/opt/pokemarket"

echo "============================================================"
echo " PokeMarket VPS Setup"
echo " Domain : $DOMAIN"
echo " User   : $APP_USER"
echo "============================================================"

# ─── 1. Mises à jour système ─────────────────────────────────────────────────
echo ""
echo ">>> [1/9] Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git ufw fail2ban \
    ca-certificates gnupg lsb-release \
    htop unzip jq

# ─── 2. Docker ───────────────────────────────────────────────────────────────
echo ""
echo ">>> [2/9] Installation de Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker déjà installé."
fi

# Docker Compose v2 (plugin)
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

echo "Docker $(docker --version)"
echo "Docker Compose $(docker compose version)"

# ─── 3. Utilisateur applicatif ───────────────────────────────────────────────
echo ""
echo ">>> [3/9] Création de l'utilisateur $APP_USER..."
if ! id "$APP_USER" &> /dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG docker "$APP_USER"
fi

# ─── 4. Répertoire de l'application ──────────────────────────────────────────
echo ""
echo ">>> [4/9] Création du répertoire de l'application..."
mkdir -p "$APP_DIR"/{infrastructure/docker,infrastructure/nginx/conf.d,backups}
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ─── 5. Firewall (UFW) ───────────────────────────────────────────────────────
echo ""
echo ">>> [5/9] Configuration du firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "UFW status :"
ufw status numbered

# ─── 6. Fail2ban ─────────────────────────────────────────────────────────────
echo ""
echo ">>> [6/9] Configuration de Fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ─── 7. Swap (recommandé pour VPS 2-4 Go RAM) ────────────────────────────────
echo ""
echo ">>> [7/9] Configuration du swap (2 Go)..."
if ! swapon --show | grep -q '/swapfile'; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "vm.swappiness=10" >> /etc/sysctl.conf
    sysctl -p
    echo "Swap activé : $(free -h | grep Swap)"
else
    echo "Swap déjà configuré."
fi

# ─── 8. SSH Keys pour GitHub Actions ────────────────────────────────────────
echo ""
echo ">>> [8/9] Génération de la clé SSH pour GitHub Actions..."
SSH_DIR="/root/.ssh"
KEY_FILE="$SSH_DIR/github_actions"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ ! -f "$KEY_FILE" ]; then
    ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "github-actions@pokemarket"
    cat "$KEY_FILE.pub" >> "$SSH_DIR/authorized_keys"
    chmod 600 "$SSH_DIR/authorized_keys"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  IMPORTANT — Copiez cette clé privée dans GitHub Secrets ║"
echo "║  Settings → Secrets → Actions → VPS_SSH_KEY              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
cat "$KEY_FILE"
echo ""

# ─── 9. Let's Encrypt (Certbot via Docker) ───────────────────────────────────
echo ""
echo ">>> [9/9] Obtention du certificat SSL Let's Encrypt..."
echo "  → Assurez-vous que le DNS $DOMAIN pointe sur cette IP avant de continuer."
echo "  → Votre IP publique : $(curl -s ifconfig.me)"
echo ""
read -p "Le DNS est-il configuré ? (oui/non) : " dns_ready

if [ "$dns_ready" = "oui" ]; then
    # Certificat initial via certbot standalone (avant Nginx)
    docker run --rm \
        -v /opt/pokemarket/certbot_www:/var/www/certbot \
        -v /opt/pokemarket/certbot_certs:/etc/letsencrypt \
        -p 80:80 \
        certbot/certbot certonly \
        --standalone \
        --email "admin@$DOMAIN" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    echo "✅ Certificat SSL obtenu !"
else
    echo "⚠️  Sautez l'étape SSL — obtenez le certificat plus tard avec :"
    echo "    cd /opt/pokemarket && docker compose -f infrastructure/docker/docker-compose.prod.yml run --rm certbot certonly --webroot ..."
fi

# ─── Résumé ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " ✅ Setup VPS terminé !"
echo "============================================================"
echo ""
echo " Prochaines étapes :"
echo ""
echo " 1. Ajoutez ces secrets dans GitHub :"
echo "    → VPS_HOST       = $(curl -s ifconfig.me)"
echo "    → VPS_USER       = root"
echo "    → VPS_PORT       = 22"
echo "    → VPS_SSH_KEY    = (clé affichée ci-dessus)"
echo "    → DOMAIN         = $DOMAIN"
echo "    → POSTGRES_PASSWORD = (mot de passe fort)"
echo "    → REDIS_PASSWORD    = (mot de passe fort)"
echo "    → CLERK_SECRET_KEY  = sk_live_..."
echo "    → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_..."
echo "    → STRIPE_SECRET_KEY = sk_live_..."
echo "    → STRIPE_WEBHOOK_SECRET = whsec_..."
echo "    → POKEMON_TCG_API_KEY = ..."
echo "    → RESEND_API_KEY = re_..."
echo ""
echo " 2. Configurez le domaine Nginx :"
echo "    Remplacez DOMAIN_PLACEHOLDER par $DOMAIN dans :"
echo "    infrastructure/nginx/conf.d/pokemarket.conf"
echo ""
echo " 3. Faites un git push sur main → le déploiement démarre automatiquement !"
echo ""
echo " Monitoring :"
echo "    docker stats                    (ressources)"
echo "    docker compose logs -f          (logs)"
echo "    journalctl -u docker -f         (docker daemon)"
