import "server-only";
import { and, asc, desc, eq, gt, ilike, or, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { clicks, offers, platforms } from "@/db/schema";

/** Condição de "oferta visível": ativa, dentro da validade e plataforma ativa */
const visible = () => and(eq(offers.isActive, true), gt(offers.expiresAt, sql`now()`), eq(platforms.isActive, true));

export async function listPublicOffers(opts: { q?: string; platform?: string; limit?: number }) {
  const conds = [visible()];
  const q = opts.q?.trim().slice(0, 80);
  if (q) {
    const term = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(offers.title, term), ilike(offers.description, term), ilike(offers.coupon, term)));
  }
  if (opts.platform) conds.push(eq(platforms.slug, opts.platform));

  return db
    .select({
      id: offers.id,
      title: offers.title,
      description: offers.description,
      slug: offers.slug,
      coupon: offers.coupon,
      imagePath: offers.imagePath,
      expiresAt: offers.expiresAt,
      createdAt: offers.createdAt,
      platformName: platforms.name,
      platformSlug: platforms.slug,
      platformLogo: platforms.logoPath,
    })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(and(...conds))
    .orderBy(desc(offers.createdAt))
    .limit(opts.limit ?? 60);
}

/** Plataformas que têm pelo menos uma oferta visível (chips de filtro) */
export async function listPublicPlatforms() {
  return db
    .select({ id: platforms.id, name: platforms.name, slug: platforms.slug, logoPath: platforms.logoPath, n: count(offers.id) })
    .from(platforms)
    .innerJoin(offers, eq(offers.platformId, platforms.id))
    .where(visible())
    .groupBy(platforms.id)
    .orderBy(asc(platforms.sortOrder), asc(platforms.name));
}

/* ----------------------------- Analytics ----------------------------- */

export async function dashboardStats() {
  const [totals] = await db
    .select({
      total: count(),
      last24h: sql<number>`count(*) filter (where ${clicks.createdAt} > now() - interval '24 hours')`.mapWith(Number),
      last7d: sql<number>`count(*) filter (where ${clicks.createdAt} > now() - interval '7 days')`.mapWith(Number),
      unique7d: sql<number>`count(distinct ${clicks.ipHash}) filter (where ${clicks.createdAt} > now() - interval '7 days')`.mapWith(Number),
    })
    .from(clicks);

  const [live] = await db
    .select({ n: count() })
    .from(offers)
    .where(and(eq(offers.isActive, true), gt(offers.expiresAt, sql`now()`)));

  // Série diária dos últimos 14 dias (dias sem clique aparecem com 0)
  const tz = process.env.TZ || "America/Sao_Paulo";
  const daily = await db.execute<{ day: string; n: number }>(sql`
    select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
    from generate_series((now() at time zone ${tz})::date - 13, (now() at time zone ${tz})::date, interval '1 day') as d(day)
    left join (
      select (created_at at time zone ${tz})::date as day, count(*) as n
      from clicks where created_at > now() - interval '15 days' group by 1
    ) c on c.day = d.day::date
    order by d.day`);

  return { ...totals, liveOffers: live.n, daily: daily.rows };
}

/** Ranking de cliques por oferta (total + últimos 7 dias) */
export async function clicksByOffer(limit = 50) {
  return db
    .select({
      id: offers.id,
      title: offers.title,
      slug: offers.slug,
      platform: platforms.name,
      total: offers.clicksCount,
      last7d: sql<number>`(select count(*) from ${clicks} c where c.offer_id = ${offers.id} and c.created_at > now() - interval '7 days')`.mapWith(Number),
      expiresAt: offers.expiresAt,
      isActive: offers.isActive,
    })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .orderBy(desc(offers.clicksCount), desc(offers.createdAt))
    .limit(limit);
}

export async function listAdminOffers(filter: "live" | "expired" | "all", q?: string) {
  const conds = [];
  if (filter === "live") conds.push(and(eq(offers.isActive, true), gt(offers.expiresAt, sql`now()`)));
  if (filter === "expired") conds.push(or(eq(offers.isActive, false), sql`${offers.expiresAt} <= now()`));
  if (q) conds.push(ilike(offers.title, `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`));
  return db
    .select({ offer: offers, platformName: platforms.name })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(offers.createdAt))
    .limit(200);
}

export async function listAllPlatforms() {
  return db
    .select({
      id: platforms.id, name: platforms.name, slug: platforms.slug, logoPath: platforms.logoPath,
      isActive: platforms.isActive, sortOrder: platforms.sortOrder,
      offers: sql<number>`(select count(*) from ${offers} o where o.platform_id = ${platforms.id})`.mapWith(Number),
    })
    .from(platforms)
    .orderBy(asc(platforms.sortOrder), asc(platforms.name));
}
