#!/bin/sh
# Ajusta o dono da pasta de dados (bind mount do OMV) e roda como PUID:PGID
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-100}"
mkdir -p /data/home
if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID:$PGID" /data 2>/dev/null || echo "[coletor] aviso: não consegui ajustar o dono de /data"
  exec gosu "$PUID:$PGID" "$@"
fi
exec "$@"
