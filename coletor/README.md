# Coletor de ofertas

Serviço em Python que garimpa promoções no **Mercado Livre, Amazon e Shopee**, gera os links de afiliado e entrega as ofertas para a vitrine. A vitrine decide o resto: esteira de aprovação ou publicação direta, site e WhatsApp.

> Baseado no **Bot de Ofertas para Telegram (Linux)**, um projeto público distribuído pelo autor original. As fontes (`ofertas/sources/`) e as regras de escolha das ofertas vieram dele. Aqui o Telegram, o painel próprio e os arquivos `.env`/`config.yaml` foram substituídos pela integração com a vitrine.

## Como funciona

```
coletor  ──GET /api/bot/config──▶  vitrine   (configurações, segredos, nichos, produtos já usados)
coletor  ──POST /api/bot/ofertas─▶  vitrine   (uma oferta por vez, já com link de afiliado)
coletor  ──POST /api/bot/status──▶  vitrine   (sinal de vida, resultado do ciclo, status de cada loja)
vitrine  ──POST :8000/…──────────▶  coletor   (/ciclo, /testar, /converter, /ml-login/iniciar|parar)
```

Tudo protegido pelo `BOT_TOKEN`, pela rede interna do compose. A configuração fica no painel (menu **Robô**) e é relida a cada ciclo.

| Loja | Busca | Link de afiliado |
| :--- | :--- | :--- |
| Shopee | Open API oficial | vem da API |
| Amazon | Creators API (se a conta for elegível) ou páginas de busca | `?tag=` |
| Mercado Livre | página de ofertas | Linkbuilder, com a sua conta logada no Chrome do coletor |

## Login do Mercado Livre

O container não tem tela. No painel, **Robô › Mercado Livre › Fazer login** sobe uma tela virtual (Xvfb), um VNC local e o noVNC na porta `6080`, com uma senha nova a cada login. Você entra na conta pelo navegador e clica em **Concluir**: o coletor fecha tudo e confere se o Linkbuilder ficou logado. A sessão fica em `/data/ml_profile`.

## Rodar fora do Docker (desenvolvimento)

```bash
pip install -r requirements.txt
VITRINE_URL=http://localhost:3000 BOT_TOKEN=... DATA_DIR=./data python -m ofertas
python -m ofertas testar shopee    # testa uma loja sem entregar nada
```
