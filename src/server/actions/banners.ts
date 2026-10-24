"use server";
/** CONTROLLER — Banners do topo da home (carrossel) */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { banners, siteSettings } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { HEX_RE } from "@/lib/color";
import { removeUploadIfUnused, saveUpload, UploadError, copyUpload } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";

const TZ = process.env.TZ || "America/Sao_Paulo";

/** "2026-11-27T00:00" (datetime-local, horário do site) → Date | null */
function localToDate(v: string): Date | null {
  if (!v) return null;
  // Calcula o deslocamento do fuso do site nessa data (sem dependências)
  const guess = new Date(`${v}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asTz = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asTz - guess.getTime()));
}

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const schema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome ao banner (só aparece no painel)").max(80),
    kind: z.enum(["text", "image"]),
    headline: optText(120),
    highlight: optText(80),
    subtitle: optText(240),
    ctaLabel: optText(40),
    ctaUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null)
      .refine((v) => !v || /^(https?:\/\/|\/|#)/i.test(v), "O link deve começar com https://, / ou #"),
    openNewTab: z.boolean(),
    bgColor: z.union([z.string().regex(HEX_RE, "Cor de fundo deve ser #RRGGBB"), z.literal("")]).optional().transform((v) => (v ? v.toUpperCase() : null)),
    showBadges: z.boolean(),
    isActive: z.boolean(),
    startsAt: z.string().optional().transform((v) => localToDate(v ?? "")),
    endsAt: z.string().optional().transform((v) => localToDate(v ?? "")),
  })
  .refine((d) => d.kind === "image" || d.headline, { message: "Banner de texto precisa de um título", path: ["headline"] })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt > d.startsAt, { message: "O fim precisa ser depois do início", path: ["endsAt"] });

const parse = (f: FormData) =>
  schema.safeParse({
    name: f.get("name"),
    kind: f.get("kind"),
    headline: f.get("headline") ?? undefined,
    highlight: f.get("highlight") ?? undefined,
    subtitle: f.get("subtitle") ?? undefined,
    ctaLabel: f.get("ctaLabel") ?? undefined,
    ctaUrl: f.get("ctaUrl") ?? undefined,
    openNewTab: f.get("openNewTab") === "on",
    bgColor: f.get("useBg") === "on" ? f.get("bgColor") ?? "" : "",
    showBadges: f.get("showBadges") === "on",
    isActive: f.get("isActive") === "on",
    startsAt: f.get("startsAt") ?? undefined,
    endsAt: f.get("endsAt") ?? undefined,
  });

function done() {
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

export async function createBannerAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("banners");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const imagePath = await saveUpload(form.get("image"), "brand");
    const mobileImagePath = await saveUpload(form.get("mobileImage"), "brand");
    if (p.data.kind === "image" && !imagePath) return { error: "Envie a arte do banner (versão computador)" };
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${banners.sortOrder}), 0)`.mapWith(Number) }).from(banners);
    await db.insert(banners).values({ ...p.data, imagePath, mobileImagePath, sortOrder: max + 1 });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  done();
  redirect("/admin/banners?saved=1");
}

export async function updateBannerAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("banners");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const [cur] = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  if (!cur) return { error: "Banner não encontrado" };
  try {
    const up = await saveUpload(form.get("image"), "brand");
    const upMobile = await saveUpload(form.get("mobileImage"), "brand");
    const imagePath = up ?? (form.get("removeImage") === "on" ? null : cur.imagePath);
    const mobileImagePath = upMobile ?? (form.get("removeMobileImage") === "on" ? null : cur.mobileImagePath);
    if (p.data.kind === "image" && !imagePath) return { error: "Envie a arte do banner (versão computador)" };
    await db.update(banners).set({ ...p.data, imagePath, mobileImagePath, updatedAt: sql`now()` }).where(eq(banners.id, id));
    if (imagePath !== cur.imagePath) await removeUploadIfUnused(cur.imagePath);
    if (mobileImagePath !== cur.mobileImagePath) await removeUploadIfUnused(cur.mobileImagePath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  done();
  redirect("/admin/banners?saved=1");
}

export async function deleteBannerAction(id: number) {
  await requirePage("banners");
  const [gone] = await db.delete(banners).where(eq(banners.id, id)).returning();
  await removeUploadIfUnused(gone?.imagePath);
  await removeUploadIfUnused(gone?.mobileImagePath);
  done();
}

export async function toggleBannerAction(id: number) {
  await requirePage("banners");
  await db.update(banners).set({ isActive: sql`not ${banners.isActive}`, updatedAt: sql`now()` }).where(eq(banners.id, id));
  done();
}

/** Sobe/desce uma posição e renumera tudo (1, 2, 3…) */
export async function moveBannerAction(id: number, dir: "up" | "down") {
  await requirePage("banners");
  const list = await db.select({ id: banners.id }).from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
  const i = list.findIndex((b) => b.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (const [n, b] of list.entries()) await tx.update(banners).set({ sortOrder: n + 1 }).where(eq(banners.id, b.id));
  });
  done();
}

export async function duplicateBannerAction(id: number) {
  await requirePage("banners");
  const [b] = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  if (!b) return;
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${banners.sortOrder}), 0)`.mapWith(Number) }).from(banners);
  const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = b;
  const [copy] = await db
    .insert(banners)
    .values({
      ...rest, name: `${b.name} (cópia)`, isActive: false, sortOrder: max + 1,
      imagePath: await copyUpload(b.imagePath), mobileImagePath: await copyUpload(b.mobileImagePath),
    })
    .returning({ id: banners.id });
  redirect(`/admin/banners/${copy.id}`);
}

export async function setBannerIntervalAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("banners");
  const n = Number(form.get("interval"));
  if (!Number.isInteger(n) || n < 3 || n > 30) return { error: "Use de 3 a 30 segundos" };
  await db.update(siteSettings).set({ bannerIntervalSec: n, updatedAt: sql`now()` }).where(eq(siteSettings.id, 1));
  done();
  return { ok: true, message: `Os banners trocam a cada ${n} segundos` };
}
