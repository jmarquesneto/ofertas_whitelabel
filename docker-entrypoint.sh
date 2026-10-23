#!/bin/sh
# Ajusta o dono da pasta de uploads (bind mount do OMV) para PUID:PGID
# e só então roda o app como esse usuário — sem precisar de chown manual.
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-100}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOAD_DIR/brand" "$UPLOAD_DIR/platforms" "$UPLOAD_DIR/offers"
  if ! chown -R "$PUID:$PGID" "$UPLOAD_DIR" 2>/dev/null; then
    echo "[entrypoint] AVISO: não foi possível mudar o dono de $UPLOAD_DIR para $PUID:$PGID (pasta de rede/NFS?)."
  fi
  if ! su-exec "$PUID:$PGID" sh -c "touch '$UPLOAD_DIR/.write-test' && rm -f '$UPLOAD_DIR/.write-test'" 2>/dev/null; then
    echo "[entrypoint] ERRO: o usuário $PUID:$PGID não consegue gravar em $UPLOAD_DIR. Uploads de imagem vão falhar."
  else
    echo "[entrypoint] uploads OK em $UPLOAD_DIR (usuário $PUID:$PGID)"
  fi
  exec su-exec "$PUID:$PGID" "$@"
fi

exec "$@"
