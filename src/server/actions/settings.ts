"use server";
/**
 * CONTROLLER — Configurações White Label
 * Salva nome, logo, favicon, cores, hero, faixa de afiliados e rodapé na linha única site_settings (id=1).
 * revalidatePath("/", "layout") faz toda a vitrine refletir a mudança na hora.
 */
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { HEX_RE } from "@/lib/color";
import { getSettings } from "@/lib/settings";
import { removeUpload, removeUploadIfUnused, saveUpload, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";
import { ICONS } from "@/components/Icon";

const schema = z.object({
  siteName: z.string().trim().min(2, "Nome muito curto").max(80),
  tagline: z.string().trim().max(160).optional().transform((v) => v || null),
  primaryColor: z.string().regex(HEX_RE, "Cor primária deve ser #RRGGBB").transform((v) => v.toUpperCase()),
  secondaryColor: z.string().regex(HEX_RE, "Cor secundária deve ser #RRGGBB").transform((v) => v.toUpperCase()),
  footerText: z.string().trim().min(10, "O aviso legal é obrigatório").max(2000),
  heroBadges: z
    .array(z.object({ icon: z.string().refine((v) => v in ICONS, "Ícone inválido"), label: z.string().trim().max(40) }))
    .max(3),
  affiliateTitle: z.string().trim().min(2, "Título da faixa de afiliados muito curto").max(120),
  affiliateText: z.string().trim().min(10, "Explique na faixa de afiliados como o site ganha comissão").max(600),
});

export async function updateSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    siteName: form.get("siteName"),
    tagline: form.get("tagline") ?? undefined,
    primaryColor: form.get("primaryColor"),
    secondaryColor: form.get("secondaryColor"),
    footerText: form.get("footerText"),
    heroBadges: [0, 1, 2]
      .map((i) => ({ icon: String(form.get(`badgeIcon${i}`) ?? "tag"), label: String(form.get(`badgeLabel${i}`) ?? "") }))
      .filter((b) => b.label.trim()),
    affiliateTitle: form.get("affiliateTitle"),
    affiliateText: form.get("affiliateText"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const current = await getSettings();
  try {
    const logoPath = await saveUpload(form.get("logo"), "brand");
    const faviconPath = await saveUpload(form.get("favicon"), "brand");
    const removeLogo = form.get("removeLogo") === "on";
    const removeFavicon = form.get("removeFavicon") === "on";
    const heroImagePath = await saveUpload(form.get("heroImage"), "brand");
    const removeHero = form.get("removeHeroImage") === "on";

    const values = {
      ...parsed.data,
      logoPath: logoPath ?? (removeLogo ? null : current.logoPath),
      faviconPath: faviconPath ?? (removeFavicon ? null : current.faviconPath),
      heroImagePath: heroImagePath ?? (removeHero ? null : current.heroImagePath),
      updatedAt: sql`now()`,
    };

    await db
      .insert(siteSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: siteSettings.id, set: values });

    if (logoPath || removeLogo) await removeUpload(current.logoPath);
    if (faviconPath || removeFavicon) await removeUpload(current.faviconPath);
    if (heroImagePath || removeHero) await removeUploadIfUnused(current.heroImagePath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações salvas" };
}
