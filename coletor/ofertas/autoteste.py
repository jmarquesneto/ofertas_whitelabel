"""Autoteste do Chrome: abre o mesmo Chrome que o robô usa e carrega uma página.

    python -m ofertas autoteste

Roda no build da imagem (falha o build se o Chrome não abrir) e pode ser
usado no container para diagnóstico.
"""
import shutil
import sys
import tempfile
from pathlib import Path


def main() -> int:
    from playwright.sync_api import sync_playwright

    from .sources import mercadolivre

    tmp = Path(tempfile.mkdtemp(prefix="autoteste-"))
    perfil_original = mercadolivre.PERFIL_DIR
    mercadolivre.PERFIL_DIR = tmp / "perfil"
    try:
        print("Chrome:", mercadolivre._achar_chrome())
        with sync_playwright() as pw:
            ctx = mercadolivre._abrir_contexto(pw, headless=True)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.set_content("<title>ok</title><h1>autoteste</h1>")
            titulo = page.title()
            versao = ctx.browser.version if ctx.browser else "?"
            ctx.close()
        print(f"✅ Chrome abriu (versão {versao}) e renderizou a página: {titulo}")
        return 0
    except Exception as e:
        print(f"❌ {e}")
        return 1
    finally:
        mercadolivre.PERFIL_DIR = perfil_original
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
