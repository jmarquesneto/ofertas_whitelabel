#!/bin/sh
# Ajusta o dono da pasta de dados (bind mount do OMV) e roda como PUID:PGID
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-100}"
mkdir -p /data/home
if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID:$PGID" /data 2>/dev/null || echo "[coletor] aviso: não consegui ajustar o dono de /data"
  # O gosu troca o HOME para "/" quando o PUID não existe no container; o Chrome
  # precisa de uma pasta pessoal com escrita (senão o crashpad derruba o navegador)
  exec gosu "$PUID:$PGID" env HOME=/data/home XDG_CONFIG_HOME=/data/home/.config XDG_CACHE_HOME=/data/home/.cache "$@"
fi
exec "$@"
