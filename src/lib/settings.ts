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
  primaryColor: "#C2410C",
  secondaryColor: "#14423C",
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
