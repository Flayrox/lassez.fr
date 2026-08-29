#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dev tout-en-un — domaines .test SANS port (via le Caddy local) ou avec ports
# dédiés jamais utilisés.
#
#   http://lassez.test        → Front Next.js (site public)    [port 2500]
#   http://studio.lassez.test → Studio Vue (pilote le daemon)    [port 4405]
#   Daemon Go : 127.0.0.1:4406
#
# Les entrées /etc/hosts sont ajoutées au premier lancement (sudo demandé une
# fois). Le routage sans port est assuré par le Caddyfile.dev déjà lancé pour
# qoe.fi (blocs lassez.test + studio.lassez.test) — un caddy reload est tenté
# automatiquement. Sans Caddy, les URL avec port fonctionnent quand même.
#
# Surcharge : STUDIO_HOST, FRONT_HOST, STUDIO_PORT, DAEMON_PORT, NEXT_PORT,
# CADDY_CONFIG (chemin du Caddyfile.dev à recharger).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

STUDIO_HOST="${STUDIO_HOST:-studio.lassez.test}"
FRONT_HOST="${FRONT_HOST:-lassez.test}"
STUDIO_PORT="${STUDIO_PORT:-4405}"
DAEMON_PORT="${DAEMON_PORT:-4406}"
NEXT_PORT="${NEXT_PORT:-2500}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1) Entrée /etc/hosts (idempotente)
if ! grep -qE "[[:space:]]${STUDIO_HOST}([[:space:]]|$)" /etc/hosts; then
  echo "→ Ajout de « 127.0.0.1 ${STUDIO_HOST} ${FRONT_HOST} » dans /etc/hosts (mot de passe admin requis)"
  sudo sh -c "printf '%s\n' '127.0.0.1 ${STUDIO_HOST} ${FRONT_HOST}' >> /etc/hosts"
fi

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

# 2) Daemon Go sur 127.0.0.1:${DAEMON_PORT}
echo "→ Daemon : build + lancement sur 127.0.0.1:${DAEMON_PORT}"
(cd "$ROOT/daemon" && go build -o bin/daemon ./cmd/daemon)
(cd "$ROOT/daemon" && STUDIO_API_ADDR="127.0.0.1:${DAEMON_PORT}" ./bin/daemon) &
PIDS+=($!)

# 3) Studio Vite sur :${STUDIO_PORT} (proxy /api → daemon)
echo "→ Studio (Vue) : http://${STUDIO_HOST}:${STUDIO_PORT}"
STUDIO_PORT="$STUDIO_PORT" DAEMON_PORT="$DAEMON_PORT" npm --prefix "$ROOT/apps/studio" run dev &
PIDS+=($!)

# 4) Front Next.js sur :${NEXT_PORT}
echo "→ Front Next.js : http://${FRONT_HOST}:${NEXT_PORT}"
(cd "$ROOT" && npm run dev) &
PIDS+=($!)

# 5) Rechargement du Caddy local (routage sans port) si disponible
CADDY_CONFIG="${CADDY_CONFIG:-}"
if [ -z "$CADDY_CONFIG" ] && command -v caddy >/dev/null 2>&1 && command -v pgrep >/dev/null 2>&1; then
  CPID="$(pgrep -x caddy 2>/dev/null | head -1 || true)"
  if [ -n "$CPID" ] && command -v lsof >/dev/null 2>&1; then
    CWD="$(lsof -a -p "$CPID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)"
    [ -n "$CWD" ] && [ -f "$CWD/Caddyfile.dev" ] && CADDY_CONFIG="$CWD/Caddyfile.dev"
  fi
fi
if [ -n "$CADDY_CONFIG" ] && [ -f "$CADDY_CONFIG" ]; then
  echo "→ Caddy reload ($CADDY_CONFIG)"
  caddy reload --config "$CADDY_CONFIG" >/dev/null 2>&1 \
    || echo "  ⚠ caddy reload a échoué — relance-le manuellement (caddy reload --config $CADDY_CONFIG)"
else
  echo "→ Caddy introuvable — URL sans port indisponibles, utilise les ports ci-dessous."
fi

echo
echo "  🟢 Studio (studio)  : http://${STUDIO_HOST}      (sans port, via Caddy)"
echo "  🟢 Front site     : http://${FRONT_HOST}"
echo "  🔸 Direct         : http://${STUDIO_HOST}:${STUDIO_PORT} · http://${FRONT_HOST}:${NEXT_PORT}"
echo "  🔸 Daemon API     : 127.0.0.1:${DAEMON_PORT}/api"
echo "  Stop : Ctrl-C"
wait
