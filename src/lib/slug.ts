import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { categories, offers, platforms } from "@/db/schema";

/** Rotas de primeiro nível que um slug de oferta jamais pode ocupar */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "uploads", "_next", "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json", "health",
  "oferta", "ofertas", "favoritos", "categoria", "categorias", "c", "cupom", "cupons",
]);

export function slugify(input: string, max = 80): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "") || "oferta";
}

/** Gera slug único para ofertas: "fone-bluetooth", "fone-bluetooth-2"… */
export async function uniqueOfferSlug(base: string, ignoreId?: number): Promise<string> {
  let root = slugify(base);
  if (RESERVED_SLUGS.has(root)) root = `${root}-oferta`;
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const where = ignoreId ? and(eq(offers.slug, candidate), ne(offers.id, ignoreId)) : eq(offers.slug, candidate);
    const hit = await db.select({ id: offers.id }).from(offers).where(where).limit(1);
    if (hit.length === 0) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function uniquePlatformSlug(base: string, ignoreId?: number): Promise<string> {
  const root = slugify(base, 60);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const where = ignoreId
      ? and(eq(platforms.slug, candidate), ne(platforms.id, ignoreId))
      : eq(platforms.slug, candidate);
    const hit = await db.select({ id: platforms.id }).from(platforms).where(where).limit(1);
    if (hit.length === 0) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function uniqueCategorySlug(base: string, ignoreId?: number): Promise<string> {
  const root = slugify(base, 70);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const where = ignoreId
      ? and(eq(categories.slug, candidate), ne(categories.id, ignoreId))
      : eq(categories.slug, candidate);
    const hit = await db.select({ id: categories.id }).from(categories).where(where).limit(1);
    if (hit.length === 0) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
