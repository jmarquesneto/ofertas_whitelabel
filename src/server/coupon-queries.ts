import "server-only";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { coupons, platforms } from "@/db/schema";

const live = () =>
  and(eq(coupons.isActive, true), eq(platforms.isActive, true), or(isNull(coupons.expiresAt), gt(coupons.expiresAt, sql`now()`)));

/** "Hoje" no horário de Brasília */
const today = sql`(${coupons.createdAt} at time zone 'America/Bahia')::date = (now() at time zone 'America/Bahia')::date`;

/** Lojas com cupons valendo: total e quantos foram postados hoje */
export async function couponStores() {
  return db
    .select({
      id: platforms.id, name: platforms.name, slug: platforms.slug, logoPath: platforms.logoPath,
      total: sql<number>`count(*)`.mapWith(Number),
      today: sql<number>`count(*) filter (where ${today})`.mapWith(Number),
    })
    .from(coupons)
    .innerJoin(platforms, eq(platforms.id, coupons.platformId))
    .where(live())
    .groupBy(platforms.id)
    .orderBy(desc(sql`count(*) filter (where ${today})`), desc(sql`count(*)`), asc(platforms.sortOrder));
}

export async function couponStore(slug: string) {
  const [p] = await db.select().from(platforms).where(and(eq(platforms.slug, slug), eq(platforms.isActive, true))).limit(1);
  if (!p) return null;
  const list = await db
    .select({ c: coupons, isToday: sql<boolean>`${today}` })
    .from(coupons)
    .innerJoin(platforms, eq(platforms.id, coupons.platformId))
    .where(and(eq(coupons.platformId, p.id), live()))
    .orderBy(desc(coupons.createdAt), asc(coupons.code));
  return { p, list };
}
