/**
 * Destaque do cupom ("15% OFF", "R$ 80 OFF", "FRETE GRÁTIS").
 * Usa a coluna `desconto` quando preenchida; senão tenta tirar do começo da descrição:
 *   "15% OFF | Limite de R$ 30"  →  destaque "15% OFF", resto "Limite de R$ 30"
 */
const START =
  /^\s*((?:até\s+)?\d{1,3}(?:[.,]\d+)?\s?%(?:\s*(?:off|de\s+desconto))?|R\$\s?\d[\d.]*(?:,\d{1,2})?(?:\s*(?:off|de\s+desconto))?|frete\s+gr[aá]tis)\s*(?:[|\-–—:·,]\s*)?/i;

function normalize(h: string) {
  let t = h.replace(/\s+/g, " ").trim();
  if (/frete/i.test(t)) return "FRETE GRÁTIS";
  t = t.replace(/de\s+desconto/i, "OFF").replace(/\boff\b/i, "OFF").replace(/^até/i, "ATÉ");
  if (!/OFF/.test(t)) t += " OFF";
  return t.replace(/R\$\s?/, "R$ ");
}

export function splitDiscount(description: string | null, discount?: string | null) {
  const desc = (description ?? "").trim();
  if (discount?.trim()) {
    // destaque escrito à mão: tira a repetição do começo da descrição, se houver
    const rest = desc.toLowerCase().startsWith(discount.trim().toLowerCase())
      ? desc.slice(discount.trim().length).replace(/^\s*[|\-–—:·,]\s*/, "")
      : desc;
    return { highlight: discount.trim().toUpperCase(), rest: rest || null };
  }
  const m = desc.match(START);
  if (!m) return { highlight: null, rest: desc || null };
  return { highlight: normalize(m[1]), rest: desc.slice(m[0].length).trim() || null };
}
