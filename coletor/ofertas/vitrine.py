"""Cliente da API interna da vitrine (config, entrega de ofertas, status)."""
import logging
from datetime import datetime, timezone

import requests

from .config import BOT_TOKEN, VITRINE_URL
from .models import Oferta

log = logging.getLogger("ofertas.vitrine")


def _headers() -> dict:
    return {"Authorization": f"Bearer {BOT_TOKEN}", "Content-Type": "application/json"}


def buscar_config() -> dict:
    r = requests.get(f"{VITRINE_URL}/api/bot/config", headers=_headers(), timeout=20)
    if r.status_code == 401:
        raise RuntimeError("A vitrine recusou o BOT_TOKEN (confira se é o mesmo no app e no coletor)")
    r.raise_for_status()
    return r.json()


def oferta_para_json(o: Oferta) -> dict:
    return {
        "plataforma": o.plataforma,
        "id_produto": o.id_produto,
        "titulo": o.titulo,
        "url_afiliado": o.url_afiliado,
        "preco": o.preco,
        "preco_original": o.preco_original,
        "imagem": o.imagem if (o.imagem or "").startswith("http") else None,
        "extra": o.extra,
    }


def entregar(o: Oferta) -> dict:
    r = requests.post(f"{VITRINE_URL}/api/bot/ofertas", json=oferta_para_json(o), headers=_headers(), timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"vitrine HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def enviar_status(**dados) -> None:
    """Melhor esforço: se a vitrine estiver fora, só registra no log."""
    try:
        requests.post(f"{VITRINE_URL}/api/bot/status", json=dados, headers=_headers(), timeout=10)
    except Exception as e:
        log.debug("status não enviado: %s", e)
