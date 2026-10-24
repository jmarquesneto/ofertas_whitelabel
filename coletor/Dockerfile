# Coletor de ofertas (Python + Google Chrome + noVNC para o login do Mercado Livre)
# Só amd64: o Google Chrome não tem versão Linux para ARM.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DATA_DIR=/data \
    HOME=/data/home \
    TZ=America/Bahia

# Chrome real (o ML recusa o "Chrome for Testing"), tela virtual + VNC + noVNC, fontes com emoji.
# Não remova o wget depois: o pacote do Google Chrome depende dele (apagar um apaga o outro).
# O build falha se o Chrome ou as ferramentas do login não estiverem na imagem.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget gnupg tzdata gosu \
      xvfb x11vnc novnc websockify fonts-liberation fonts-noto-color-emoji \
 && wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google.gpg \
 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-chrome-stable \
 && rm -rf /var/lib/apt/lists/* \
 && google-chrome --version \
 && for b in Xvfb x11vnc websockify; do command -v $b >/dev/null || { echo "falta $b"; exit 1; }; done

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ofertas ./ofertas
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Autoteste: abre o Chrome como usuário comum, do mesmo jeito que o robô. Se falhar, o build falha.
RUN mkdir -p /tmp/autoteste-home && chown 1000:100 /tmp/autoteste-home \
 && gosu 1000:100 env HOME=/tmp/autoteste-home DATA_DIR=/tmp/autoteste-home/data python -m ofertas autoteste \
 && rm -rf /tmp/autoteste-home

# 8000 = API interna (só a vitrine usa) · 6080 = noVNC (login do ML)
EXPOSE 8000 6080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/saude', timeout=4)" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["python", "-m", "ofertas"]
