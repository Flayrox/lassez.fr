#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  RADAR L'ASSEZ — Installation RSS-Bridge Docker
#  
#  RSS-Bridge convertit les comptes X/Twitter en flux RSS
#  exploitables par le daemon Radar.
#
#  Usage : sudo bash rss-bridge-setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo "======================================"
echo " 📡 Installation de RSS-Bridge Docker"
echo "======================================"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "🔧 Installation de Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Arrêter l'ancien container si existant
docker stop rss-bridge 2>/dev/null || true
docker rm rss-bridge 2>/dev/null || true

# Lancer RSS-Bridge
echo "🚀 Démarrage de RSS-Bridge sur le port 3300..."
docker run -d \
    --name rss-bridge \
    --restart unless-stopped \
    -p 3300:80 \
    -e RSSBRIDGE_WHITELIST="TwitterBridge,XBridge" \
    rssbridge/rss-bridge:latest

echo ""
echo "✅ RSS-Bridge démarré sur http://localhost:3300"
echo ""
echo "Comptes X/Twitter configurés pour le Radar :"
echo "  - @JLMelenchon"
echo "  - @MathildePanot"
echo "  - @RimaHas"
echo "  - @FranceInsoumise"
echo "  - @ImpactMediaFR"
echo ""
echo "⚠️  IMPORTANT : Pour ajouter ces flux RSS au Radar,"
echo "   utilise ces URLs dans le dashboard Studio :"
echo ""
echo "   http://localhost:3300/?action=display&bridge=TwitterBridge&context=By+username&u=JLMelenchon&format=Atom"
echo "   http://localhost:3300/?action=display&bridge=TwitterBridge&context=By+username&u=MathildePanot&format=Atom"
echo "   http://localhost:3300/?action=display&bridge=TwitterBridge&context=By+username&u=RimaHas&format=Atom"
echo "   http://localhost:3300/?action=display&bridge=TwitterBridge&context=By+username&u=FranceInsoumise&format=Atom"
echo "   http://localhost:3300/?action=display&bridge=TwitterBridge&context=By+username&u=ImpactMediaFR&format=Atom"
echo ""
echo "📌 N'oublie pas d'ajouter ces URLs aux rss_feeds dans le Studio !"
echo "======================================"
