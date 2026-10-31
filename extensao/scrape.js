/**
 * Lê os dados do produto na página aberta. Esta função roda DENTRO da aba da loja
 * (chrome.scripting.executeScript), por isso não pode usar nada de fora dela.
 */
export function scrapeProduct() {
  const host = location.hostname;
  const store = /mercadoli(vre|bre)\./.test(host) ? "mercadolivre"
    : /amazon\./.test(host) ? "amazon"
    : /shopee\./.test(host) ? "shopee" : null;

  const $ = (sel) => document.querySelector(sel);
  const text = (sel) => ($(sel)?.textContent || "").replace(/\s+/g, " ").trim();
  const meta = (sel) => $(sel)?.getAttribute("content")?.trim() || "";
  /** "R$ 1.299,90" → 1299.9 */
  const money = (t) => {
    const raw = String(t || "").replace(/[^\d,.]/g, "");
    if (!raw) return null;
    let n;
    if (raw.includes(",")) n = Number(raw.replace(/\./g, "").replace(",", "."));
    else if ((raw.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(raw)) n = Number(raw.replace(/\./g, ""));
    else n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  /** Preço do Mercado Livre em partes: fração + centavos */
  const mlMoney = (root) => {
    if (!root) return null;
    const f = root.querySelector(".andes-money-amount__fraction")?.textContent;
    const c = root.querySelector(".andes-money-amount__cents")?.textContent;
    return f ? money(f + (c ? "," + c : "")) : null;
  };

  // JSON-LD (várias lojas publicam o produto assim)
  let ld = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent);
      const list = Array.isArray(data) ? data : data["@graph"] || [data];
      ld = list.find((x) => x && (x["@type"] === "Product" || (Array.isArray(x["@type"]) && x["@type"].includes("Product"))));
      if (ld) break;
    } catch { /* ignora JSON inválido */ }
  }
  const ldOffer = ld && (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers);
  const ldImage = ld && (Array.isArray(ld.image) ? ld.image[0] : typeof ld.image === "object" ? ld.image?.url : ld.image);

  const r = {
    store,
    url: location.href.split("#")[0],
    productId: null,
    title: "",
    price: null,
    originalPrice: null,
    image: null,
    coupon: null,
  };

  if (store === "mercadolivre") {
    const m = location.href.match(/MLB-?(\d{6,})/i) || document.body.innerHTML.match(/"item_id":"MLB(\d{6,})"/);
    r.productId = m ? "MLB" + m[1] : null;
    r.title = text("h1.ui-pdp-title");
    r.price = money(meta('meta[itemprop="price"]')) || mlMoney($(".ui-pdp-price__second-line"));
    r.originalPrice = mlMoney($(".ui-pdp-price__original-value")) || mlMoney($("s.andes-money-amount--previous"));
    const img = $("figure.ui-pdp-gallery__figure img, .ui-pdp-gallery img");
    r.image = img?.getAttribute("data-zoom") || img?.getAttribute("src") || null;
    const cupom = text(".ui-pdp-promotions-pill-label, .ui-vpp-coupons-awareness__checkbox-label");
    const cm = cupom.match(/cupom\s+([A-Z0-9]{4,})/i);
    if (cm) r.coupon = cm[1].toUpperCase();
    // link limpo do produto (sem rastreio) para o Linkbuilder
    r.url = location.origin + location.pathname;
  } else if (store === "amazon") {
    const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    r.productId = ($("#ASIN")?.value || (m && m[1]) || "").toUpperCase() || null;
    r.title = text("#productTitle");
    r.price = money(text("#corePrice_feature_div .a-price .a-offscreen") || text(".priceToPay .a-offscreen")
      || text("#corePriceDisplay_desktop_feature_div .a-price .a-offscreen") || text("#priceblock_ourprice") || text("#priceblock_dealprice"));
    r.originalPrice = money(text(".basisPrice .a-offscreen") || text('span.a-price.a-text-price[data-a-strike="true"] .a-offscreen')
      || text("#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen"));
    const img = $("#landingImage, #imgBlkFront");
    r.image = img?.getAttribute("data-old-hires") || img?.getAttribute("src") || null;
    const cupom = text("#promoPriceBlockMessage_feature_div, #couponBadgeRegularVpc");
    const cm = cupom.match(/c[oó]digo[:\s]+([A-Z0-9]{4,})/i);
    if (cm) r.coupon = cm[1].toUpperCase();
    if (r.productId) r.url = `https://www.amazon.com.br/dp/${r.productId}`;
  } else if (store === "shopee") {
    const m = location.href.match(/i\.(\d+)\.(\d+)/) || location.href.match(/product\/(\d+)\/(\d+)/);
    r.productId = m ? `${m[1]}.${m[2]}` : null;
    r.url = location.origin + location.pathname;
  }

  // Complementos genéricos (JSON-LD / Open Graph)
  r.title = r.title || ld?.name || meta('meta[property="og:title"]') || document.title;
  r.title = r.title.replace(/\s*[|\-–]\s*(Shopee Brasil|Mercado Livre|Amazon\.com\.br).*$/i, "").trim();
  r.price = r.price || money(ldOffer?.price || ldOffer?.lowPrice);
  r.image = r.image || ldImage || meta('meta[property="og:image"]') || null;
  if (r.image && r.image.startsWith("//")) r.image = "https:" + r.image;
  if (r.originalPrice && r.price && r.originalPrice <= r.price) r.originalPrice = null;
  return r;
}

/**
 * Gera o link de afiliado do Mercado Livre com a sessão logada no navegador
 * (a mesma API do Linkbuilder). Roda na aba do ML quando ela é do www; senão,
 * a própria extensão chama a API com os cookies do navegador.
 */
export async function mlCreateLink(productUrl, tag) {
  const resp = await fetch("https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ urls: [productUrl], tag }),
  });
  const body = await resp.text();
  let data = null;
  try { data = JSON.parse(body); } catch { /* resposta não é JSON (ex.: página de login) */ }
  const link = data?.urls?.[0]?.short_url;
  if (link) return { link };
  if (resp.status === 401 || resp.status === 403 || /login/i.test(resp.url))
    return { erro: "Entre na sua conta do Mercado Livre neste navegador e tente de novo." };
  return { erro: `O Linkbuilder respondeu HTTP ${resp.status}${data?.message ? `: ${data.message}` : ""}` };
}
