"""Coletor de ofertas — processo principal.

    python -m ofertas            # roda o coletor (API interna + ciclos agendados)
    python -m ofertas testar ml  # testa uma loja sem entregar nada
    python -m ofertas autoteste  # confere se o Chrome abre neste container
"""
import logging
import sys
import time

from . import pipeline, vitrine
from .config import BOT_TOKEN, VITRINE_URL, config

log = logging.getLogger("ofertas")


def _log():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for ruidoso in ("urllib3", "httpx"):
        logging.getLogger(ruidoso).setLevel(logging.WARNING)


def rodar() -> None:
    from .servidor import iniciar_servidor
    from .sources import mercadolivre

    if len(BOT_TOKEN) < 16:
        raise SystemExit("Defina BOT_TOKEN (16+ caracteres), o mesmo do app, no compose.")
    iniciar_servidor()
    log.info("Coletor iniciado. Vitrine: %s", VITRINE_URL)

    ultimo_ciclo = time.time() - 10**9
    primeiro = time.time() + 60  # dá tempo da vitrine subir antes do 1º ciclo
    ultimo_sinal = 0.0
    while True:
        agora = time.time()
        try:
            config.atualizar(vitrine.buscar_config())
            if agora - ultimo_sinal >= 25:  # sinal de vida para o painel
                vitrine.enviar_status(mlSession=mercadolivre.tem_sessao())
                ultimo_sinal = agora
            vencido = agora - ultimo_ciclo >= config.intervalo_minutos * 60
            if config.ativo and vencido and agora >= primeiro:
                ultimo_ciclo = agora
                pipeline.executar_ciclo()
        except Exception as e:
            log.warning("Sem contato com a vitrine (%s). Tentando de novo em 30s.", e)
        time.sleep(30)


def testar(fonte: str) -> None:
    from .servidor import testar as t
    alias = {"ml": "mercadolivre"}.get(fonte, fonte)
    r = t(alias)
    for o in r["ofertas"]:
        print(f"[-{o['desconto'] or 0:>2}%] R$ {o['preco']} (de {o['preco_original']}) — {o['titulo'][:70]}")
    print(f"\nTotal: {r['total']} ofertas")


def main() -> None:
    _log()
    args = sys.argv[1:]
    if not args or args[0] == "run":
        rodar()
    elif args[0] == "testar" and len(args) > 1:
        testar(args[1])
    elif args[0] == "autoteste":
        from .autoteste import main as autoteste
        raise SystemExit(autoteste())
    else:
        raise SystemExit(__doc__)
