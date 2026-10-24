"""Mercado Livre: scraping da página de ofertas + link de afiliado via Linkbuilder.

O ML não tem API pública para afiliados, mas o Linkbuilder do painel usa uma API
interna simples (createLink), autenticada só pelos cookies da sessão. O bot chama
essa API de dentro de uma página logada (perfil persistente do Chrome em
DATA_DIR/ml_profile). O login é feito uma vez pelo painel da vitrine
(Robô › Mercado Livre › Fazer login), que abre esse mesmo Chrome via noVNC.
"""
import logging
import os
import re
import subprocess
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup

from ..config import DATA_DIR, config
from ..models import Oferta
from ..utils import USER_AGENT, parse_preco_br, sessao

log = logging.getLogger("ofertas.ml")

URL_OFERTAS = "https://www.mercadolivre.com.br/ofertas"
URL_LINKBUILDER = "https://www.mercadolivre.com.br/afiliados/linkbuilder"
API_CREATELINK = "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink"
PERFIL_DIR = DATA_DIR / "ml_profile"

_RE_ID = re.compile(r"(MLB-?\d{6,})")


def e_link(url: str) -> bool:
    return any(d in url for d in ("mercadolivre.com", "mercadolibre.com", "meli.la/"))


def tem_sessao() -> bool:
    return PERFIL_DIR.exists() and any(PERFIL_DIR.iterdir())


def verificar_sessao() -> bool:
    """Abre o Linkbuilder em segundo plano e confere se continua logado."""
    from playwright.sync_api import sync_playwright

    if not tem_sessao():
        return False
    with sync_playwright() as pw:
        ctx = _abrir_contexto(pw, headless=True)
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto(URL_LINKBUILDER, wait_until="domcontentloaded", timeout=45_000)
            page.wait_for_timeout(1500)
            return not ("login" in page.url or "registration" in page.url)
        finally:
            ctx.close()


# ── Busca de ofertas (scraping, sem login) ───────────────────────────

def _categorias() -> dict[str, str]:
    """{id: nome} das categorias do config (aceita dict ou lista de ids); vazio = todas."""
    cats = config.fonte_ml.get("categorias") or {}
    return dict(cats) if isinstance(cats, dict) else {str(c): str(c) for c in cats}


def _titulo_html(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html[:20000], re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip()[:80] if m else "sem título"


def _pagina_pelo_chrome(urls: list[str]) -> list[str]:
    """Plano B: abre as páginas no Chrome logado (renderiza como um navegador de verdade)."""
    from playwright.sync_api import sync_playwright

    from ..travas import CHROME_LOCK

    if not CHROME_LOCK.acquire(timeout=60):
        raise RuntimeError("Chrome ocupado (login do ML aberto?)")
    htmls: list[str] = []
    try:
        with sync_playwright() as pw:
            ctx = _abrir_contexto(pw, headless=True)
            try:
                page = ctx.pages[0] if ctx.pages else ctx.new_page()
                for url in urls:
                    page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                    try:
                        page.wait_for_selector(".poly-card", timeout=12_000)
                    except Exception:
                        pass
                    page.mouse.wheel(0, 4000)  # força o carregamento preguiçoso das imagens
                    page.wait_for_timeout(1500)
                    htmls.append(page.content())
            finally:
                ctx.close()
    finally:
        CHROME_LOCK.release()
    return htmls


def buscar_ofertas() -> list[Oferta]:
    """Página de ofertas do ML, filtrada pelas categorias do config (ofertas?category=MLB...).

    Primeiro tenta uma requisição simples; se a página vier sem produtos (bloqueio,
    página de verificação, layout novo), abre as mesmas páginas no Chrome logado.
    """
    from urllib.parse import urlencode

    paginas = max(1, int(config.fonte_ml.get("paginas", 1)))
    categorias = _categorias() or {"": "todas"}
    s = sessao()
    ofertas: dict[str, Oferta] = {}
    vazias: list[tuple[str, str]] = []  # (url, nome) sem produtos na requisição simples
    diag: list[str] = []
    for cat_id, nome in categorias.items():
        for pagina in range(1, paginas + 1):
            params = {}
            if cat_id:
                params["category"] = cat_id
            if pagina > 1:
                params["page"] = pagina
            url = URL_OFERTAS + (("?" + urlencode(params)) if params else "")
            try:
                r = s.get(url, timeout=30)
                achadas = _parse_pagina(r.text) if r.status_code == 200 else []
                if not achadas:
                    diag.append(f"HTTP {r.status_code}, “{_titulo_html(r.text)}”, {r.url[:90]}")
                    (DATA_DIR / "debug_ml_ofertas.html").write_text(r.text, encoding="utf-8")
            except Exception as e:
                achadas = []
                diag.append(f"erro de rede: {e}"[:150])
            if achadas:
                for o in achadas:
                    ofertas.setdefault(o.id_produto, o)
                log.info("Mercado Livre %s: %d ofertas", nome, len(achadas))
            else:
                vazias.append((url, nome))
            time.sleep(1)

    if vazias:
        log.warning("Mercado Livre: %d página(s) sem produtos na leitura simples (%s) — tentando pelo Chrome",
                    len(vazias), diag[0] if diag else "")
        if tem_sessao():
            try:
                for (url, nome), html in zip(vazias, _pagina_pelo_chrome([u for u, _ in vazias])):
                    achadas = _parse_pagina(html)
                    for o in achadas:
                        ofertas.setdefault(o.id_produto, o)
                    log.info("Mercado Livre %s (Chrome): %d ofertas", nome, len(achadas))
                    if not achadas:
                        (DATA_DIR / "debug_ml_ofertas.html").write_text(html, encoding="utf-8")
                        diag.append(f"pelo Chrome: “{_titulo_html(html)}”")
            except Exception as e:
                diag.append(f"pelo Chrome: {e}"[:200])
        else:
            diag.append("sem sessão do ML para tentar pelo Chrome")

    log.info("Mercado Livre: %d ofertas coletadas", len(ofertas))
    if not ofertas:
        raise RuntimeError("A página de ofertas do ML veio sem produtos (" + " · ".join(diag[-2:])[:350] +
                           "). HTML salvo em debug_ml_ofertas.html na pasta do coletor.")
    return list(ofertas.values())


def _preco_de(card, seletor_base: str) -> float | None:
    fracao = card.select_one(f"{seletor_base} .andes-money-amount__fraction")
    if not fracao:
        return None
    centavos = card.select_one(f"{seletor_base} .andes-money-amount__cents")
    texto = fracao.get_text(strip=True) + ("," + centavos.get_text(strip=True) if centavos else "")
    return parse_preco_br(texto)


# ── Sessão por cookies (login feito no navegador da pessoa) ─────────

_SAMESITE = {"no_restriction": "None", "none": "None", "lax": "Lax", "strict": "Strict"}


def _cookies_de_texto(texto: str) -> list[dict]:
    """Aceita o JSON exportado por extensões (Cookie-Editor, EditThisCookie, Get cookies.txt)
    ou o cabeçalho "Cookie: a=b; c=d" copiado do DevTools. Retorna cookies no formato do Playwright."""
    import json

    texto = (texto or "").strip()
    if not texto:
        raise RuntimeError("Cole os cookies exportados do Mercado Livre")
    cookies: list[dict] = []
    if texto[:1] in "[{":
        try:
            dados = json.loads(texto)
        except ValueError:
            raise RuntimeError("O texto colado não é um JSON válido")
        if isinstance(dados, dict):
            dados = dados.get("cookies") or [dados]
        for c in dados:
            if not isinstance(c, dict) or not c.get("name"):
                continue
            dominio = str(c.get("domain") or ".mercadolivre.com.br")
            if not any(d in dominio for d in ("mercadolivre", "mercadolibre", "meli")):
                continue  # só cookies do Mercado Livre
            novo = {
                "name": str(c["name"]),
                "value": str(c.get("value", "")),
                "domain": dominio,
                "path": str(c.get("path") or "/"),
                "httpOnly": bool(c.get("httpOnly", False)),
                "secure": bool(c.get("secure", True)),
            }
            exp = c.get("expirationDate", c.get("expires"))
            # Cookie "de sessão" morre quando o Chrome fecha: damos 30 dias para ele sobreviver
            novo["expires"] = float(exp) if exp and float(exp) > 0 else time.time() + 30 * 86400
            ss = _SAMESITE.get(str(c.get("sameSite") or "").lower())
            if ss:
                novo["sameSite"] = ss
                if ss == "None":
                    novo["secure"] = True
            cookies.append(novo)
    else:
        linha = texto.split(":", 1)[1] if texto.lower().startswith("cookie:") else texto
        for parte in linha.split(";"):
            if "=" in parte:
                nome, valor = parte.strip().split("=", 1)
                if nome:
                    cookies.append({"name": nome, "value": valor, "domain": ".mercadolivre.com.br",
                                    "path": "/", "secure": True, "expires": time.time() + 30 * 86400})
    if not cookies:
        raise RuntimeError("Não achei cookies do Mercado Livre no texto colado. "
                           "Exporte estando na página do mercadolivre.com.br")
    return cookies


def importar_cookies(texto: str) -> int:
    """Grava os cookies no perfil do Chrome do robô. Retorna quantos foram importados."""
    from playwright.sync_api import sync_playwright

    cookies = _cookies_de_texto(texto)
    PERFIL_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx = _abrir_contexto(pw, headless=True)
        try:
            ctx.clear_cookies()
            ctx.add_cookies(cookies)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            try:
                page.goto("https://www.mercadolivre.com.br/", wait_until="domcontentloaded", timeout=45_000)
            except Exception as e:
                log.warning("Não abri o ML depois de importar os cookies: %s", e)
            page.wait_for_timeout(1500)  # deixa o Chrome gravar os cookies no perfil
        finally:
            ctx.close()
    log.info("Mercado Livre: %d cookies importados", len(cookies))
    return len(cookies)


def _parse_card(card) -> Oferta | None:
    a = card.select_one("a.poly-component__title")
    if not (a and a.get("href")):
        return None
    titulo = a.get_text(strip=True)
    url = a["href"].split("#")[0].split("?")[0]

    m = _RE_ID.search(a["href"])
    id_produto = m.group(1).replace("-", "") if m else url.rstrip("/").rsplit("/", 1)[-1][:40]

    preco = _preco_de(card, ".poly-price__current")
    preco_original = _preco_de(card, "s.andes-money-amount--previous")

    desconto = None
    selo = card.select_one(".poly-price__discount-polylabel, .andes-money-amount__discount")
    if selo:
        m = re.search(r"(\d+)\s*%", selo.get_text())
        desconto = int(m.group(1)) if m else None

    img = card.select_one("img.poly-component__picture")
    imagem = (img.get("data-src") or img.get("src")) if img else None
    if imagem and imagem.startswith("data:"):
        imagem = None  # placeholder de lazy-load

    partes = []
    review = card.select_one(".poly-component__review-compacted")
    if review:
        partes.append("⭐ " + re.sub(r"\s*\|\s*", " · ", review.get_text(" ", strip=True)))
    if "Frete grátis" in card.get_text():
        partes.append("🚚 Frete grátis")
    pix = card.select_one(".poly-price__unit-description")
    if pix and "pix" in pix.get_text().lower():
        partes.append("💠 preço no Pix")

    return Oferta(
        plataforma="mercadolivre",
        id_produto=id_produto,
        titulo=titulo,
        url_afiliado="",  # preenchido depois pelo Linkbuilder
        url_produto=url,
        preco=preco,
        preco_original=preco_original,
        desconto_pct=desconto,
        imagem=imagem,
        extra=" · ".join(partes) or None,
    )


def _parse_pagina(html: str) -> list[Oferta]:
    soup = BeautifulSoup(html, "lxml")
    cards = soup.select(".poly-card")
    ofertas = [o for o in (_parse_card(c) for c in cards) if o]
    if cards and not ofertas:
        log.warning("Página de ofertas do ML mudou de layout? %d cards, 0 parseados", len(cards))
    return ofertas


# ── Link de afiliado via Linkbuilder (Playwright + sessão logada) ────

CHROME_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--password-store=basic",       # mesmo jeito de guardar cookies que o Chrome do login (noVNC)
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-crash-reporter",     # crashpad derruba o Chrome em container sem pasta pessoal
    "--disable-breakpad",
    "--no-first-run",
]


def _abrir_contexto(pw, headless: bool):
    """Google Chrome instalado (build de produção) + perfil persistente do projeto.

    O ML recusa login no "Chrome for Testing" do Playwright, então usamos o
    Chrome real (/opt/google/chrome) e removemos as marcas de automação.
    """
    kwargs = dict(
        executable_path=_achar_chrome(),
        headless=headless,
        locale="pt-BR",
        args=CHROME_ARGS,
        ignore_default_args=["--enable-automation"],
        chromium_sandbox=False,
    )
    if headless:
        kwargs["user_agent"] = USER_AGENT  # o headless real se anuncia como HeadlessChrome
    else:
        kwargs["no_viewport"] = True
    try:
        return pw.chromium.launch_persistent_context(str(PERFIL_DIR), **kwargs)
    except Exception as e:
        # Mostra o motivo real (as primeiras linhas do erro do Chrome), sem a moldura do Playwright
        linhas = [l.strip(" ║╔╗╚╝═") for l in str(e).splitlines() if l.strip(" ║╔╗╚╝═")]
        raise RuntimeError("O Chrome não abriu: " + " | ".join(linhas[:6])[:500]) from None


def _achar_chrome() -> str:
    """Caminho do Google Chrome instalado (Windows, macOS ou Linux)."""
    import shutil
    candidatos: list[str] = []

    if sys.platform == "win32":
        try:
            import winreg
            for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                try:
                    chave = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
                    with winreg.OpenKey(hive, chave) as k:
                        candidatos.append(winreg.QueryValueEx(k, None)[0])
                except OSError:
                    continue
        except ImportError:
            pass
        for base in (os.environ.get("ProgramFiles", r"C:\Program Files"),
                     os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
                     os.environ.get("LOCALAPPDATA", "")):
            if base:
                candidatos.append(str(Path(base) / "Google/Chrome/Application/chrome.exe"))
    elif sys.platform == "darwin":
        candidatos += [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            str(Path.home() / "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
    else:  # Linux e afins
        candidatos.append("/opt/google/chrome/chrome")  # binário real do pacote google-chrome-stable
        for nome in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser",
                     "brave-browser", "microsoft-edge"):
            achado = shutil.which(nome)
            if achado:
                candidatos.append(achado)
        candidatos += ["/usr/bin/google-chrome", "/usr/bin/chromium",
                       "/snap/bin/chromium", "/usr/bin/chromium-browser"]

    for c in candidatos:
        if c and Path(c).exists():
            return c
    raise RuntimeError("Google Chrome não encontrado — instale o Google Chrome e tente de novo.")


def _criar_links_api(page, urls: list[str], etiqueta: str) -> list[str]:
    """Chama a API interna do Linkbuilder de dentro da página logada; retorna os short links.

    Payload/resposta observados em 2026-08-21:
    POST createLink {"urls": [...], "tag": "<etiqueta>"} ->
    {"status": 200, "urls": [{"id", "created", "short_url": "https://meli.la/...", ...}]}
    """
    r = page.evaluate(
        """async ({api, urls, tag}) => {
            const resp = await fetch(api, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({urls, tag}),
            });
            const corpo = await resp.text();
            try { return {http: resp.status, dados: JSON.parse(corpo)}; }
            catch (e) { return {http: resp.status, texto: corpo.slice(0, 300)}; }
        }""",
        {"api": API_CREATELINK, "urls": urls, "tag": etiqueta},
    )
    if r.get("http") != 200 or not r.get("dados"):
        raise RuntimeError(f"createLink respondeu HTTP {r.get('http')}: {r.get('texto', '')}")
    itens = (r["dados"].get("urls")) or []
    links = [i.get("short_url") or "" for i in itens]
    if len(links) != len(urls) or not all(links):
        raise RuntimeError(f"createLink devolveu {sum(1 for l in links if l)} links "
                           f"para {len(urls)} URLs: {r['dados']}")
    return links


def gerar_links_afiliado(ofertas: list[Oferta]) -> None:
    """Preenche oferta.url_afiliado via API do Linkbuilder (lotes de 10 URLs)."""
    from playwright.sync_api import sync_playwright

    if not tem_sessao():
        raise RuntimeError("Sessão do ML não encontrada — faça o login no painel (Robô › Mercado Livre)")
    if not config.ml_etiqueta:
        raise RuntimeError("Etiqueta do ML não configurada no painel (Robô › Mercado Livre)")
    pendentes = [o for o in ofertas if not o.url_afiliado and o.url_produto]
    if not pendentes:
        return

    with sync_playwright() as pw:
        ctx = _abrir_contexto(pw, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(URL_LINKBUILDER, wait_until="domcontentloaded")
            if "login" in page.url or "registration" in page.url:
                raise RuntimeError("Sessão do ML expirou — refaça o login no painel (Robô › Mercado Livre)")
            page.wait_for_timeout(1500)  # deixa os scripts de sessão da página rodarem
            for i in range(0, len(pendentes), 10):
                lote = pendentes[i:i + 10]
                links = _criar_links_api(page, [o.url_produto for o in lote], config.ml_etiqueta)
                for o, link in zip(lote, links):
                    o.url_afiliado = link
            log.info("Mercado Livre: %d links de afiliado gerados", len(pendentes))
        finally:
            ctx.close()


def converter(url: str) -> Oferta:
    """Link de produto -> Oferta com dados da página + link de afiliado."""
    url = url.split("#")[0]
    if "meli.la/" in url:  # link de afiliado encurtado: expande até o produto
        try:
            url = sessao().get(url, allow_redirects=True, timeout=20).url.split("#")[0]
        except Exception as e:
            log.warning("Não consegui expandir o link meli.la: %s", e)
    titulo = preco = preco_original = imagem = None
    try:
        r = sessao().get(url, timeout=25)
        soup = BeautifulSoup(r.text, "lxml")
        el = soup.select_one("h1.ui-pdp-title")
        titulo = el.get_text(strip=True) if el else None
        el = soup.select_one('meta[property="og:image"]')
        imagem = el.get("content") if el else None
        el = soup.select_one('meta[itemprop="price"]')
        if el and el.get("content"):
            preco = float(el["content"])
        else:
            el = soup.select_one(".ui-pdp-price__second-line .andes-money-amount__fraction")
            preco = parse_preco_br(el.get_text()) if el else None
        el = soup.select_one("s.andes-money-amount--previous .andes-money-amount__fraction")
        preco_original = parse_preco_br(el.get_text()) if el else None
    except Exception as e:
        log.warning("Não consegui ler a página do produto: %s", e)

    m = _RE_ID.search(url)
    oferta = Oferta(
        plataforma="mercadolivre",
        id_produto=m.group(1).replace("-", "") if m else url.rstrip("/").rsplit("/", 1)[-1][:40],
        titulo=titulo or "Oferta Mercado Livre",
        url_afiliado="",
        url_produto=url.split("?")[0],
        preco=preco,
        preco_original=preco_original,
        imagem=imagem,
    )
    gerar_links_afiliado([oferta])
    if not oferta.url_afiliado:
        raise RuntimeError("Linkbuilder não devolveu o link de afiliado")
    return oferta
