"""Login no Mercado Livre por noVNC (o container não tem tela).

Ao iniciar, sobe uma tela virtual (Xvfb), um servidor VNC só para dentro do
container (x11vnc) e o noVNC (websockify) na porta NOVNC_PORT, com senha
aleatória. O Chrome abre no perfil do bot; você loga pelo navegador e, ao
concluir, tudo é fechado e a sessão é conferida.
"""
import logging
import os
import secrets
import shutil
import subprocess
import threading
import time

from .config import DATA_DIR
from .pipeline import CHROME_LOCK
from .sources import mercadolivre

log = logging.getLogger("ofertas.ml_login")

DISPLAY = ":99"
NOVNC_PORT = int(os.getenv("NOVNC_PORT_INTERNA", "6080"))
TEMPO_MAXIMO = 20 * 60  # fecha sozinho depois de 20 min

_lock = threading.Lock()
_procs: list[subprocess.Popen] = []
_estado = {"aberto": False, "senha": None, "desde": 0.0}


def aberto() -> bool:
    return _estado["aberto"]


def _limpar_travas() -> None:
    # Chrome fechado à força deixa travas no perfil que impedem a próxima abertura
    for nome in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        try:
            (mercadolivre.PERFIL_DIR / nome).unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def iniciar() -> dict:
    with _lock:
        if _estado["aberto"]:
            return {"ok": True, "senha": _estado["senha"], "mensagem": "O login já está aberto."}
        for bin_ in ("Xvfb", "x11vnc", "websockify"):
            if not shutil.which(bin_):
                raise RuntimeError(f"{bin_} não está instalado neste container")
        if not CHROME_LOCK.acquire(timeout=60):
            raise RuntimeError("O robô está usando o Chrome agora. Tente de novo em um minuto.")
        try:
            chrome = mercadolivre._achar_chrome()
            mercadolivre.PERFIL_DIR.mkdir(parents=True, exist_ok=True)
            _limpar_travas()
            senha = secrets.token_urlsafe(6)[:8]  # o VNC usa no máximo 8 caracteres
            env = {**os.environ, "DISPLAY": DISPLAY}
            senha_arq = DATA_DIR / ".vncpass"
            subprocess.run(["x11vnc", "-storepasswd", senha, str(senha_arq)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            _procs.append(subprocess.Popen(["Xvfb", DISPLAY, "-screen", "0", "1280x860x24", "-nolisten", "tcp"],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            # espera a tela virtual ficar pronta (o socket aparece em /tmp/.X11-unix)
            for _ in range(30):
                if os.path.exists(f"/tmp/.X11-unix/X{DISPLAY[1:]}"):
                    break
                time.sleep(0.2)
            else:
                raise RuntimeError("A tela virtual (Xvfb) não iniciou")
            _procs.append(subprocess.Popen(
                ["x11vnc", "-display", DISPLAY, "-rfbauth", str(senha_arq), "-localhost", "-forever",
                 "-shared", "-rfbport", "5900", "-quiet"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env))
            web = next((p for p in ("/usr/share/novnc", "/usr/share/webapps/novnc") if os.path.isdir(p)), None)
            _procs.append(subprocess.Popen(
                ["websockify", *(["--web", web] if web else []), str(NOVNC_PORT), "localhost:5900"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            # Log do Chrome em /data/chrome-login.log (diagnóstico se ele não abrir)
            log_chrome = open(DATA_DIR / "chrome-login.log", "wb")
            chrome_proc = subprocess.Popen(
                [chrome, f"--user-data-dir={mercadolivre.PERFIL_DIR}", "--no-first-run", "--no-default-browser-check",
                 "--no-sandbox", "--password-store=basic", "--disable-dev-shm-usage", "--disable-gpu",
                 "--use-gl=swiftshader", "--lang=pt-BR", "--window-position=0,0", "--window-size=1280,860",
                 mercadolivre.URL_LINKBUILDER],
                stdout=log_chrome, stderr=subprocess.STDOUT, env=env)
            _procs.append(chrome_proc)
            time.sleep(4)
            if chrome_proc.poll() is not None:
                log_chrome.close()
                fim = (DATA_DIR / "chrome-login.log").read_text(errors="ignore").strip().splitlines()[-6:]
                raise RuntimeError("O Chrome fechou ao abrir: " + " | ".join(fim)[-400:])
        except Exception:
            _matar()
            CHROME_LOCK.release()
            raise
        _estado.update(aberto=True, senha=senha, desde=time.time())
        threading.Thread(target=_vigiar, daemon=True).start()
        log.info("Login do ML aberto no noVNC (porta %d)", NOVNC_PORT)
        return {"ok": True, "senha": senha, "mensagem": "Chrome aberto. Faça o login e depois clique em Concluir."}


def _matar() -> None:
    for p in reversed(_procs):
        try:
            p.terminate()
            p.wait(timeout=8)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    _procs.clear()
    try:
        (DATA_DIR / ".vncpass").unlink()
    except FileNotFoundError:
        pass


def _vigiar() -> None:
    while _estado["aberto"]:
        time.sleep(15)
        if _estado["aberto"] and time.time() - _estado["desde"] > TEMPO_MAXIMO:
            log.warning("Login do ML aberto há mais de 20 min — fechando")
            parar(conferir=False)


def importar_cookies(texto: str) -> dict:
    """Alternativa ao noVNC: cookies exportados do navegador da pessoa."""
    if _estado["aberto"]:
        parar(conferir=False)
    if not CHROME_LOCK.acquire(timeout=90):
        raise RuntimeError("O robô está usando o Chrome agora. Tente de novo em um minuto.")
    try:
        _limpar_travas()
        n = mercadolivre.importar_cookies(texto)
        sessao = mercadolivre.verificar_sessao()
    finally:
        CHROME_LOCK.release()
    msg = (f"Pronto! {n} cookies importados e o Linkbuilder abriu logado."
           if sessao else f"{n} cookies importados, mas o Linkbuilder não abriu logado. "
                          "Exporte de novo estando logado em mercadolivre.com.br/afiliados/linkbuilder.")
    return {"ok": True, "sessao": sessao, "mensagem": msg}


def parar(conferir: bool = True) -> dict:
    with _lock:
        if not _estado["aberto"]:
            sessao = mercadolivre.verificar_sessao() if conferir else mercadolivre.tem_sessao()
            return {"ok": True, "sessao": sessao, "mensagem": "Nenhum login aberto."}
        _matar()
        _estado.update(aberto=False, senha=None)
        time.sleep(1.5)  # Chrome termina de gravar os cookies
        _limpar_travas()
        try:
            sessao = mercadolivre.verificar_sessao() if conferir else False
        except Exception as e:
            log.error("Não consegui conferir a sessão: %s", e)
            sessao = False
        finally:
            CHROME_LOCK.release()
    msg = ("Pronto! Sessão do Mercado Livre salva. O robô já pode gerar seus links."
           if sessao else "Não encontrei login no Linkbuilder. Abra de novo e confira se entrou na conta.")
    return {"ok": True, "sessao": sessao, "mensagem": msg}
