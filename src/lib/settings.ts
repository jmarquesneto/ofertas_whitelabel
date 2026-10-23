import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, type SiteSettings } from "@/db/schema";

const FALLBACK: SiteSettings = {
  id: 1,
  siteName: "Minha Vitrine",
  tagline: null,
  logoPath: null,
  faviconPath: null,
  primaryColor: "#FFC107",
  secondaryColor: "#111827",
  heroTitle: "As melhores ofertas,",
  heroHighlight: "todos os dias!",
  heroSubtitle: "A gente garimpa as melhores promoções da internet para você economizar.",
  heroImagePath: null,
  heroBadges: [],
  bannerIntervalSec: 6,
  affiliateTitle: "Somos uma página de afiliados",
  affiliateText: "Indicamos ofertas de lojas parceiras e podemos receber comissão pelas compras feitas pelos nossos links.",
  footerText: "Este site participa de programas de afiliados.",
  updatedAt: new Date(0),
};

/** Lê a linha única de configurações (memoizado por requisição) */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    return row ?? FALLBACK;
  } catch {
    return FALLBACK; // banco indisponível no build/primeiro boot
  }
});
