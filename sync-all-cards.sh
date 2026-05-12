#!/bin/bash
# Synchronise TOUS les sets pokemontcg.io manquants dans notre DB.
# Usage: VERCEL_URL=https://ton-app.vercel.app bash sync-all-cards.sh
#
# Ou depuis Claude Code: ! VERCEL_URL=https://... bash sync-all-cards.sh

URL="${VERCEL_URL:-$1}"
if [ -z "$URL" ]; then
  echo "Usage: VERCEL_URL=https://ton-app.vercel.app bash sync-all-cards.sh"
  exit 1
fi

echo "🔍 Vérification des sets manquants..."
STATE=$(curl -s "${URL}/api/admin/sync-all")
TOTAL=$(echo $STATE | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalPtcgSets',0))")
MISSING=$(echo $STATE | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('missingSets',0))")
COVERAGE=$(echo $STATE | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('coverage','?'))")

echo "📊 Total pokemontcg.io: $TOTAL sets"
echo "✅ En base: $((TOTAL - MISSING)) sets ($COVERAGE)"
echo "❌ Manquants: $MISSING sets"
echo ""

if [ "$MISSING" = "0" ]; then
  echo "✨ Tous les sets sont déjà importés !"
  exit 0
fi

echo "🚀 Démarrage de l'import (5 sets par appel)..."
RUN=1
while true; do
  echo -n "Run $RUN... "
  RESULT=$(curl -s -X POST "${URL}/api/admin/sync-all?batchSize=5")
  IMPORTED=$(echo $RESULT | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('imported',0))" 2>/dev/null)
  REMAINING=$(echo $RESULT | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('remaining',0))" 2>/dev/null)
  echo "✅ $IMPORTED importés | $REMAINING restants"

  if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
    echo ""
    echo "🎉 Synchronisation terminée !"
    break
  fi

  RUN=$((RUN + 1))
  sleep 3
done
