"""Configuração do coletor.

Antes ficava em .env + config.yaml; agora tudo vem do painel da vitrine
(GET /api/bot/config) e é relido a cada ciclo. Só ficam em variáveis de
ambiente o endereço da vitrine, a chave compartilhada e a pasta de dados.
"""
import os
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

VITRINE_URL = os.getenv("VITRINE_URL", "http://app:3000").rstrip("/")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
PORTA_API = int(os.getenv("COLETOR_PORT", "8000"))


class Config:
    """Mesmos nomes que as fontes (sources/*) já usavam."""

    def __init__(self):
        self.atualizar({})

    def atualizar(self, d: dict) -> None:
        f = d.get("filtros") or {}
        fontes = d.get("fontes") or {}
        ml = fontes.get("mercadolivre") or {}
        az = fontes.get("amazon") or {}
        sp = fontes.get("shopee") or {}

        self.ativo: bool = bool(d.get("ativo", False))
        self.modo: str = d.get("modo", "review")
        self.intervalo_minutos: int = int(d.get("intervalo_minutos", 45))
        self.max_posts_por_ciclo: int = int(d.get("max_posts_por_ciclo", 3))
        self.espacamento_segundos: int = int(d.get("espacamento_segundos", 0))
        self.horario_ativo: str = str(d.get("horario_ativo") or "").strip()

        self.desconto_minimo: int = int(f.get("desconto_minimo", 0))
        self.desconto_maximo: int = int(f.get("desconto_maximo", 100))
        self.preco_minimo: float = float(f.get("preco_minimo", 0) or 0)
        self.preco_maximo: float = float(f.get("preco_maximo", 0) or 0)
        self.palavras_bloqueadas: list[str] = [str(p).lower() for p in (f.get("palavras_bloqueadas") or [])]

        self.ml_etiqueta: str = (ml.get("etiqueta") or "").strip()
        self.amazon_tag: str = (az.get("tag") or "").strip()
        self.amazon_credential_id: str = (az.get("credential_id") or "").strip()
        self.amazon_credential_secret: str = (az.get("credential_secret") or "").strip()
        self.shopee_app_id: str = (sp.get("app_id") or "").strip()
        self.shopee_app_secret: str = (sp.get("app_secret") or "").strip()

        self.fonte_ml: dict = {"ativa": bool(ml.get("ativa")), "paginas": ml.get("paginas", 1),
                               "categorias": ml.get("categorias") or {}}
        self.fonte_amazon: dict = {"ativa": bool(az.get("ativa")), "paginas": az.get("paginas", 1),
                                   "requisicoes_por_ciclo": az.get("requisicoes_por_ciclo", 4),
                                   "departamentos": az.get("departamentos") or {},
                                   "buscas": az.get("buscas") or []}
        self.fonte_shopee: dict = {"ativa": bool(sp.get("ativa")), "limite": sp.get("limite", 40),
                                   "buscas": sp.get("buscas") or []}

        self.ja_usados: set[str] = set(d.get("ja_usados") or [])


config = Config()


def dentro_do_horario(agora: datetime | None = None) -> bool:
    """True se agora está dentro do horário ativo (aceita janela virando a noite; 24:00 = fim do dia)."""
    if not config.horario_ativo:
        return True
    try:
        inicio, fim = config.horario_ativo.split("-")
        h1, m1 = (int(x) for x in inicio.strip().split(":"))
        h2, m2 = (int(x) for x in fim.strip().split(":"))
    except ValueError:
        return True  # formato inválido: não bloqueia
    agora = agora or datetime.now()
    t, a, b = agora.hour * 60 + agora.minute, h1 * 60 + m1, h2 * 60 + m2
    if a == b:
        return True
    return a <= t < b if a <= b else (t >= a or t < b)
