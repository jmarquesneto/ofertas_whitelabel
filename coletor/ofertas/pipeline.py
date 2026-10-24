"""Um ciclo: coletar → filtrar → escolher → gerar links → entregar à vitrine."""
import logging
import re
import threading
import time

from . import vitrine
from .config import config, dentro_do_horario
from .models import Oferta
from .sources import amazon, mercadolivre, shopee

log = logging.getLogger("ofertas.pipeline")

# Um Chrome por vez no perfil do ML (ciclo, conversor e login dividem o mesmo perfil)
CHROME_LOCK = threading.Lock()
CICLO_LOCK = threading.Lock()


def _st(ok: bool, msg: str) -> dict:
    return {"ok": ok, "msg": msg, "at": vitrine.agora_iso()}


def coletar() -> tuple[list[Oferta], dict]:
    """Busca nas lojas ligadas no painel. Retorna (ofertas, status por loja)."""
    todas: list[Oferta] = []
    status: dict = {}

    def rodar(nome: str, ativa: bool, falta: str | None, fn):
        if not ativa:
            return
        if falta:
            status[nome] = _st(False, falta)
            log.warning("%s: %s", nome, falta)
            return
        try:
            achadas = fn()
            todas.extend(achadas)
            status[nome] = _st(True, f"{len(achadas)} ofertas lidas no último ciclo")
        except Exception as e:
            log.error("%s: %s", nome, e)
            status[nome] = _st(False, str(e)[:200])

    rodar("shopee", config.fonte_shopee.get("ativa"),
          None if (config.shopee_app_id and config.shopee_app_secret) else "Falta App ID e Secret da Open API",
          lambda: shopee.buscar_ofertas(int(config.fonte_shopee.get("limite", 40))))
    rodar("amazon", config.fonte_amazon.get("ativa"),
          None if config.amazon_tag else "Falta a tag de associado",
          amazon.buscar_ofertas)
    rodar("mercadolivre", config.fonte_ml.get("ativa"),
          None if config.ml_etiqueta else "Falta a etiqueta do Linkbuilder",
          mercadolivre.buscar_ofertas)
    return todas, status


def filtrar(ofertas: list[Oferta]) -> list[Oferta]:
    aprovadas = []
    for o in ofertas:
        if not o.titulo or o.uid in config.ja_usados:
            continue
        d = o.desconto or 0
        if config.desconto_minimo and d < config.desconto_minimo:
            continue
        if config.desconto_maximo and config.desconto_maximo < 100 and d > config.desconto_maximo:
            continue
        if o.preco is not None:
            if config.preco_minimo and o.preco < config.preco_minimo:
                continue
            if config.preco_maximo and o.preco > config.preco_maximo:
                continue
        titulo = o.titulo.lower()
        if any(p in titulo for p in config.palavras_bloqueadas):
            continue
        aprovadas.append(o)
    return aprovadas


def _chave_similar(titulo: str) -> str:
    """Variações do mesmo produto (cor, tamanho) costumam repetir as primeiras palavras."""
    return " ".join(re.findall(r"\w+", titulo.lower())[:5])


def escolher(ofertas: list[Oferta], n: int) -> list[Oferta]:
    """Top N por desconto, alternando plataformas e pulando variações do mesmo produto."""
    filas: dict[str, list[Oferta]] = {}
    for o in sorted(ofertas, key=lambda o: o.desconto or 0, reverse=True):
        filas.setdefault(o.plataforma, []).append(o)
    ordem = sorted(filas.values(), key=lambda f: f[0].desconto or 0, reverse=True)
    escolhidas: list[Oferta] = []
    vistas: set[str] = set()
    while len(escolhidas) < n and any(ordem):
        for fila in ordem:
            while fila:
                o = fila.pop(0)
                chave = _chave_similar(o.titulo)
                if chave not in vistas:
                    vistas.add(chave)
                    escolhidas.append(o)
                    break
            if len(escolhidas) >= n:
                break
    return escolhidas


def gerar_links_ml(ofertas: list[Oferta], status: dict) -> None:
    pend = [o for o in ofertas if o.plataforma == "mercadolivre" and not o.url_afiliado]
    if not pend:
        return
    if not CHROME_LOCK.acquire(timeout=5):
        status["mercadolivre"] = _st(False, "Login do ML aberto: os links ficam para o próximo ciclo")
        return
    try:
        mercadolivre.gerar_links_afiliado(pend)
    except Exception as e:
        log.error("Linkbuilder ML falhou: %s", e)
        status["mercadolivre"] = _st(False, str(e)[:200])
        if "Sessão" in str(e) or "sessão" in str(e):
            vitrine.enviar_status(mlSession=False)
    finally:
        CHROME_LOCK.release()


def executar_ciclo(forcar: bool = False) -> dict:
    """Ciclo completo. forcar=True ignora horário (botão "Rodar agora")."""
    if not CICLO_LOCK.acquire(blocking=False):
        return {"erro": "Já tem um ciclo rodando"}
    try:
        cfg = vitrine.buscar_config()
        config.atualizar(cfg)
        if not forcar and not dentro_do_horario():
            log.info("Fora do horário ativo (%s) — ciclo pulado", config.horario_ativo)
            return {"pulado": True}

        vitrine.enviar_status(running=True)
        brutas, status = coletar()
        boas = filtrar(brutas)
        escolhidas = escolher(boas, config.max_posts_por_ciclo)
        gerar_links_ml(escolhidas, status)

        entregues = 0
        for i, o in enumerate(escolhidas):
            if not o.url_afiliado:
                log.warning("Sem link de afiliado, pulando: %s", o.titulo[:60])
                continue
            try:
                r = vitrine.entregar(o)
            except Exception as e:
                log.error("Falha ao entregar '%s': %s", o.titulo[:60], e)
                continue
            if r.get("status") != "duplicate":
                entregues += 1
                log.info("Entregue (%s): %s", r.get("status"), o.titulo[:70])
                # Modo direto: pausa entre uma oferta e outra (a vitrine manda 0 no modo aprovação)
                if config.espacamento_segundos and i < len(escolhidas) - 1:
                    time.sleep(config.espacamento_segundos)

        resumo = {"coletadas": len(brutas), "aprovadas": len(boas), "enviadas": entregues}
        log.info("Ciclo: %(coletadas)d coletadas, %(aprovadas)d passaram nos filtros, %(enviadas)d entregues", resumo)
        vitrine.enviar_status(running=False, lastCycleAt=vitrine.agora_iso(), lastCycle=resumo, sources=status,
                              mlSession=mercadolivre.tem_sessao())
        return resumo
    except Exception as e:
        log.exception("Ciclo falhou")
        vitrine.enviar_status(running=False, lastCycleAt=vitrine.agora_iso(),
                              lastCycle={"coletadas": 0, "aprovadas": 0, "enviadas": 0, "erro": str(e)[:200]})
        return {"erro": str(e)}
    finally:
        CICLO_LOCK.release()
