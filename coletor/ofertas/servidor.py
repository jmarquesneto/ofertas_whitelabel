"""API interna do coletor (só a vitrine fala com ela, pela rede do compose)."""
import hmac
import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import ml_login, pipeline, vitrine
from .config import BOT_TOKEN, PORTA_API, config
from .sources import amazon, detectar_fonte, mercadolivre, shopee

log = logging.getLogger("ofertas.api")


def _atualizar_config() -> None:
    config.atualizar(vitrine.buscar_config())


def testar(fonte: str) -> dict:
    _atualizar_config()
    if fonte == "mercadolivre":
        ofertas = mercadolivre.buscar_ofertas()
    elif fonte == "shopee":
        if not (config.shopee_app_id and config.shopee_app_secret):
            raise RuntimeError("Preencha App ID e Secret e salve antes de testar")
        ofertas = shopee.buscar_ofertas(10)
    elif fonte == "amazon":
        if not config.amazon_tag:
            raise RuntimeError("Preencha a tag de associado e salve antes de testar")
        ofertas = amazon.buscar_ofertas()
    else:
        raise RuntimeError("Loja desconhecida")
    ofertas.sort(key=lambda o: o.desconto or 0, reverse=True)
    return {
        "total": len(ofertas),
        "ofertas": [{"titulo": o.titulo[:120], "preco": o.preco, "preco_original": o.preco_original,
                     "desconto": o.desconto} for o in ofertas[:10]],
    }


def converter(url: str) -> dict:
    _atualizar_config()
    fonte = detectar_fonte(url)
    if not fonte:
        raise RuntimeError("Link não reconhecido (Mercado Livre, Shopee ou Amazon)")
    if fonte is mercadolivre:
        if not config.ml_etiqueta:
            raise RuntimeError("Configure a etiqueta do Mercado Livre no painel")
        if ml_login.aberto():
            raise RuntimeError("Conclua o login do Mercado Livre antes de importar")
        if not pipeline.CHROME_LOCK.acquire(timeout=90):
            raise RuntimeError("O Chrome está ocupado; tente de novo em instantes")
        try:
            o = fonte.converter(url)
        finally:
            pipeline.CHROME_LOCK.release()
    elif fonte is amazon and not config.amazon_tag:
        raise RuntimeError("Configure a tag da Amazon no painel")
    elif fonte is shopee and not (config.shopee_app_id and config.shopee_app_secret):
        raise RuntimeError("Configure App ID e Secret da Shopee no painel")
    else:
        o = fonte.converter(url)
    return vitrine.oferta_para_json(o)


class Handler(BaseHTTPRequestHandler):
    server_version = "coletor/1.0"

    def log_message(self, fmt, *args):
        log.debug(fmt, *args)

    def _json(self, obj: dict, code: int = 200) -> None:
        corpo = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _autorizado(self) -> bool:
        got = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
        return bool(BOT_TOKEN) and hmac.compare_digest(got.encode(), BOT_TOKEN.encode())

    def _corpo(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(min(n, 500_000)) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        if self.path == "/saude":
            return self._json({"ok": True, "ml_login_aberto": ml_login.aberto()})
        self._json({"erro": "não encontrado"}, 404)

    def do_POST(self):
        if not self._autorizado():
            return self._json({"erro": "não autorizado"}, 401)
        corpo = self._corpo()
        try:
            if self.path == "/ciclo":
                if not pipeline.CICLO_LOCK.acquire(blocking=False):
                    return self._json({"erro": "Já tem um ciclo rodando agora"}, 409)
                pipeline.CICLO_LOCK.release()
                threading.Thread(target=pipeline.executar_ciclo, kwargs={"forcar": True}, daemon=True).start()
                return self._json({"ok": True})
            if self.path == "/testar":
                return self._json(testar(str(corpo.get("fonte", ""))))
            if self.path == "/converter":
                return self._json(converter(str(corpo.get("url", ""))))
            if self.path == "/ml-login/iniciar":
                r = ml_login.iniciar()
                vitrine.enviar_status(mlLoginOpen=True)
                return self._json(r)
            if self.path == "/ml-login/cookies":
                r = ml_login.importar_cookies(str(corpo.get("cookies", "")))
                vitrine.enviar_status(mlLoginOpen=False, mlSession=r.get("sessao", False))
                return self._json(r)
            if self.path == "/ml-login/parar":
                r = ml_login.parar()
                vitrine.enviar_status(mlLoginOpen=False, mlSession=r.get("sessao", False))
                return self._json(r)
            self._json({"erro": "não encontrado"}, 404)
        except Exception as e:
            log.exception("Erro em %s", self.path)
            self._json({"erro": str(e)[:300]}, 500)


def iniciar_servidor() -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer(("0.0.0.0", PORTA_API), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    log.info("API do coletor na porta %d", PORTA_API)
    return srv
