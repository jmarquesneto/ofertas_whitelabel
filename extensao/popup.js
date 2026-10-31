/**
 * Popup da extensão: login (e-mail, senha, 2FA) → lê o produto da aba → monta a oferta → publica.
 * Guarda só o endereço do site e a chave deste navegador (nunca a senha).
 */
import { mlCreateLink, scrapeProduct } from "./scrape.js";

const app = document.getElementById("app");
const state = { site: "", token: "", me: null, product: null, tabId: null, ticket: null };

/* ----------------------------- utilidades ----------------------------- */
const store = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
  clear: (k) => chrome.storage.local.remove(k),
};
const render = (id) => {
  app.replaceChildren(document.getElementById(id).content.cloneNode(true));
  return app;
};
const showError = (root, msg) => {
  const p = root.querySelector(".error");
  if (!p) return;
  p.hidden = !msg;
  p.textContent = msg || "";
};
const brl = (n) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));
const STORE_NAME = { mercadolivre: "Mercado Livre", amazon: "Amazon", shopee: "Shopee" };
const STORE_SLUG = { mercadolivre: "mercado-livre", amazon: "amazon", shopee: "shopee" };

async function api(path, { method = "GET", body, auth = true } = {}) {
  let r;
  try {
    r = await fetch(state.site + path, {
      method,
      headers: { "content-type": "application/json", ...(auth && state.token ? { authorization: `Bearer ${state.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error(`Não consegui falar com ${state.site}. Confira o endereço e a internet.`), { status: 0 });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (data.sair) await logout(false);
    throw Object.assign(new Error(data.erro || `Erro ${r.status}`), { status: r.status, data });
  }
  return data;
}

function deviceName() {
  const ua = navigator.userAgent;
  const so = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "computador";
  const nav = /Edg\//.test(ua) ? "Edge" : /Brave/.test(ua) ? "Brave" : "Chrome";
  return `${nav} · ${so}`;
}

/* ------------------------------- login ------------------------------- */
async function showLogin(defaultSite) {
  const root = render("tpl-login");
  const f = root.querySelector("#f-login");
  if (defaultSite) {
    f.site.value = defaultSite;
    root.querySelector("#site-field").classList.add("hidden");
  }
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    showError(root, "");
    state.site = f.site.value.trim().replace(/\/+$/, "");
    try {
      const r = await api("/api/ext/login", { method: "POST", auth: false, body: { email: f.email.value, password: f.password.value } });
      state.ticket = r.ticket;
      await store.set({ site: state.site });
      showTotp(defaultSite);
    } catch (err) {
      showError(root, err.message);
      btn.disabled = false;
    }
  });
}

function showTotp(defaultSite) {
  const root = render("tpl-totp");
  const f = root.querySelector("#f-totp");
  root.querySelector("#back").addEventListener("click", () => showLogin(defaultSite));
  f.code.focus();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    showError(root, "");
    try {
      const r = await api("/api/ext/totp", { method: "POST", auth: false, body: { ticket: state.ticket, code: f.code.value, device: deviceName() } });
      state.token = r.token;
      await store.set({ token: r.token });
      await start();
    } catch (err) {
      if (err.data?.reiniciar) return showLogin(defaultSite);
      showError(root, err.message);
      btn.disabled = false;
      f.code.select();
    }
  });
}

async function logout(callApi = true) {
  if (callApi && state.token) await api("/api/ext/logout", { method: "POST" }).catch(() => {});
  state.token = "";
  state.me = null;
  await store.clear(["token"]);
  document.getElementById("who").textContent = "";
  document.getElementById("logout").classList.add("hidden");
  const cfg = await loadConfig();
  showLogin(cfg.site || state.site);
}

/* ------------------------------- oferta ------------------------------- */
async function readProduct() {
  // ?tabId= só é usado nos testes automáticos (popup aberto como página)
  const forced = Number(new URLSearchParams(location.search).get("tabId"));
  const [tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return null;
  state.tabId = tab.id;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeProduct });
    return res?.result?.store ? res.result : null;
  } catch {
    return null; // página que a extensão não pode ler (ex.: Chrome Web Store)
  }
}

async function affiliateLink(p) {
  const af = state.me.afiliados;
  if (p.store === "amazon") {
    if (!af.amazonTag) return { erro: "Configure a tag da Amazon no painel (Robô › Amazon)" };
    if (!p.productId) return { erro: "Não achei o código do produto (ASIN)" };
    return { link: `https://www.amazon.com.br/dp/${p.productId}?tag=${encodeURIComponent(af.amazonTag)}` };
  }
  if (p.store === "mercadolivre") {
    if (!af.mlEtiqueta) return { erro: "Configure a etiqueta do Mercado Livre no painel (Robô › Mercado Livre)" };
    // Na aba do www do ML a chamada é da própria página; nos outros subdomínios, a extensão chama com os cookies do navegador
    const tabUrl = new URL(p.url);
    if (tabUrl.hostname === "www.mercadolivre.com.br") {
      try {
        const [res] = await chrome.scripting.executeScript({ target: { tabId: state.tabId }, func: mlCreateLink, args: [p.url, af.mlEtiqueta] });
        if (res?.result?.link) return res.result;
      } catch { /* tenta pela extensão */ }
    }
    try { return await mlCreateLink(p.url, af.mlEtiqueta); }
    catch (e) { return { erro: `Linkbuilder do ML: ${e.message}` }; }
  }
  if (p.store === "shopee") {
    if (!af.shopeeApi) return { erro: "Cole o seu link de afiliado da Shopee (a Open API ainda não está configurada)" };
    try { return await api("/api/ext/shopee-link", { method: "POST", body: { url: p.url } }); }
    catch (e) { return { erro: e.message }; }
  }
  return { erro: "Loja não suportada" };
}

async function showForm() {
  const p = state.product;
  const me = state.me;
  const root = render("tpl-form");
  const f = root.querySelector("#f-offer");

  const img = root.querySelector("#img");
  img.onerror = () => { img.onerror = null; img.src = "icons/128.png"; };
  img.src = p.image || "icons/128.png";
  root.querySelector("#store-badge").textContent = STORE_NAME[p.store];
  f.title.value = p.title || "";
  f.price.value = brl(p.price);
  f.originalPrice.value = brl(p.originalPrice);
  f.coupon.value = p.coupon || "";
  f.hours.value = me.validadeHoras;

  for (const l of me.lojas) f.platformId.add(new Option(l.name, l.id, false, l.slug === STORE_SLUG[p.store]));
  if (!me.lojas.some((l) => l.slug === STORE_SLUG[p.store])) f.platformId.insertBefore(new Option("Escolha a loja…", "", true, true), f.platformId.firstChild);
  const roots = me.categorias.filter((c) => !c.parentId);
  for (const r of roots) {
    const g = document.createElement("optgroup");
    g.label = r.name;
    g.append(new Option(`${r.name} (geral)`, r.id));
    for (const s of me.categorias.filter((c) => c.parentId === r.id)) g.append(new Option(s.name, s.id));
    f.categoryId.append(g);
  }

  // Lembra a última escolha de modo e WhatsApp
  const prefs = await store.get(["mode", "sendWhatsapp"]);
  if (prefs.mode) f.querySelector(`input[name=mode][value=${prefs.mode}]`).checked = true;
  if (prefs.sendWhatsapp === false) f.sendWhatsapp.checked = false;
  const waLine = root.querySelector("#wa-line");
  const syncWa = () => waLine.classList.toggle("hidden", !me.whatsapp || f.mode.value !== "publish");
  f.addEventListener("change", syncWa);
  syncWa();

  // Link de afiliado em segundo plano
  const st = root.querySelector("#aff-status");
  st.className = "status wait";
  st.textContent = "gerando…";
  affiliateLink(p).then((r) => {
    if (r.link) {
      if (!f.affiliateUrl.value) f.affiliateUrl.value = r.link;
      st.className = "status ok";
      st.textContent = "✓ gerado";
    } else {
      st.className = "status err";
      st.textContent = r.erro;
    }
  });

  const submit = async (force = false) => {
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    showError(root, "");
    const body = {
      platformId: Number(f.platformId.value),
      categoryId: f.categoryId.value ? Number(f.categoryId.value) : null,
      title: f.title.value.trim(),
      description: f.description.value.trim() || null,
      price: f.price.value || null,
      originalPrice: f.originalPrice.value || null,
      coupon: f.coupon.value.trim() || null,
      imageUrl: p.image && /^https?:/.test(p.image) ? p.image : null,
      affiliateUrl: f.affiliateUrl.value.trim(),
      productKey: p.productId ? `${p.store}:${p.productId}` : null,
      mode: f.mode.value,
      sendWhatsapp: me.whatsapp && f.mode.value === "publish" && f.sendWhatsapp.checked,
      isFeatured: f.isFeatured.checked,
      hours: Number(f.hours.value) || undefined,
      force,
    };
    await store.set({ mode: body.mode, sendWhatsapp: f.sendWhatsapp.checked });
    try {
      const r = await api("/api/ext/offers", { method: "POST", body });
      showDone(r);
    } catch (err) {
      btn.disabled = false;
      if (err.status === 409 && err.data?.duplicada) {
        if (confirm(`${err.message}\n\nPublicar mesmo assim?`)) return submit(true);
        return showError(root, err.message);
      }
      showError(root, err.message);
    }
  };
  f.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
}

function showDone(r) {
  const root = render("tpl-done");
  root.querySelector("#done-title").textContent = r.status === "aprovacao" ? "Enviada para Aprovação" : "Publicada!";
  root.querySelector("#done-sub").textContent = r.status === "aprovacao"
    ? "Revise e aprove no painel."
    : r.whatsappGrupos ? `Na fila do WhatsApp (${r.whatsappGrupos} grupo${r.whatsappGrupos > 1 ? "s" : ""}).` : "Já está no site.";
  const input = root.querySelector("#short");
  input.value = r.linkCurto;
  root.querySelector("#copy").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(r.linkCurto).catch(() => input.select());
    e.target.textContent = "Copiado!";
  });
  root.querySelector("#open-panel").href = r.painel;
  root.querySelector("#again").addEventListener("click", () => start());
}

/* ------------------------------- início ------------------------------- */
async function loadConfig() {
  try { return await (await fetch(chrome.runtime.getURL("config.json"))).json(); }
  catch { return {}; }
}

async function start() {
  const cfg = await loadConfig();
  const saved = await store.get(["site", "token"]);
  state.site = (saved.site || cfg.site || "").replace(/\/+$/, "");
  state.token = saved.token || "";
  if (cfg.nome) document.getElementById("brand").textContent = cfg.nome;
  if (!state.token || !state.site) return showLogin(cfg.site);

  try {
    state.me = await api("/api/ext/me");
  } catch (err) {
    if (!state.token) return; // a chave caiu: logout() já mostrou o login
    app.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = err.message;
    return app.append(p);
  }
  document.getElementById("brand").textContent = state.me.site.nome || "Publicador de Ofertas";
  document.getElementById("who").textContent = `${state.me.usuario.nome} · ${state.me.usuario.grupo}`;
  document.getElementById("logout").classList.remove("hidden");

  if (!state.me.pode.publicar) {
    app.innerHTML = '<p class="error">Seu grupo não tem permissão para publicar ofertas. Fale com um administrador.</p>';
    return;
  }
  state.product = await readProduct();
  if (!state.product) return render("tpl-unsupported");
  await showForm();
}

document.getElementById("logout").addEventListener("click", () => logout(true));
start();
