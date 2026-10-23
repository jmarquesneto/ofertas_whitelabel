import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, or, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { categories, clicks, offers, platforms, type Category } from "@/db/schema";

/** Condição de "oferta visível": ativa, dentro da validade e plataforma ativa */
const visible = () => and(eq(offers.isActive, true), gt(offers.expiresAt, sql`now()`), eq(platforms.isActive, true));

const like = (q: string) => `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

/** Campos usados pelos cards da vitrine */
const cardFields = {
  id: offers.id,
  title: offers.title,
  description: offers.description,
  slug: offers.slug,
  coupon: offers.coupon,
  imagePath: offers.imagePath,
  price: offers.price,
  originalPrice: offers.originalPrice,
  expiresAt: offers.expiresAt,
  createdAt: offers.createdAt,
  platformName: platforms.name,
  platformSlug: platforms.slug,
  platformLogo: platforms.logoPath,
};
export type CardOffer = Awaited<ReturnType<typeof listPublicOffers>>[number];

export type SortKey = "recentes" | "populares" | "desconto" | "menor-preco" | "maior-preco";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "recentes", label: "Mais recentes" },
  { key: "populares", label: "Mais populares" },
  { key: "desconto", label: "Maior desconto" },
  { key: "menor-preco", label: "Menor preço" },
  { key: "maior-preco", label: "Maior preço" },
];

const discountExpr = sql`case when ${offers.originalPrice} > ${offers.price} and ${offers.price} > 0
  then 1 - ${offers.price} / ${offers.originalPrice} else 0 end`;

export async function listPublicOffers(opts: {
  q?: string;
  platform?: string;
  categoryIds?: number[];
  sort?: SortKey;
  featured?: boolean;
  limit?: number;
}) {
  const conds = [visible()];
  const q = opts.q?.trim().slice(0, 80);
  if (q) conds.push(or(ilike(offers.title, like(q)), ilike(offers.description, like(q)), ilike(offers.coupon, like(q))));
  if (opts.platform) conds.push(eq(platforms.slug, opts.platform));
  if (opts.categoryIds?.length) conds.push(inArray(offers.categoryId, opts.categoryIds));

  const order = {
    recentes: [desc(offers.createdAt)],
    populares: [desc(offers.clicksCount), desc(offers.createdAt)],
    desconto: [desc(discountExpr), desc(offers.createdAt)],
    "menor-preco": [sql`${offers.price} asc nulls last`, desc(offers.createdAt)],
    "maior-preco": [sql`${offers.price} desc nulls last`, desc(offers.createdAt)],
  }[opts.sort ?? "recentes"];
  if (opts.featured) order.unshift(desc(offers.isFeatured));

  return db
    .select(cardFields)
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(and(...conds))
    .orderBy(...order)
    .limit(opts.limit ?? 60);
}

/** Ofertas visíveis por id (página de favoritos) */
export async function offersByIds(ids: number[]) {
  if (!ids.length) return [];
  return db
    .select(cardFields)
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(and(visible(), inArray(offers.id, ids.slice(0, 100))));
}

/** Página da oferta: inclui expiradas (link compartilhado continua abrindo) */
export async function getPublicOffer(slug: string) {
  const [row] = await db
    .select({ ...cardFields, isActive: offers.isActive, categoryId: offers.categoryId, platformActive: platforms.isActive })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(eq(offers.slug, slug.toLowerCase()))
    .limit(1);
  if (!row || !row.isActive) return null;
  return row;
}

export type CategoryNode = Category & { children: Category[]; n: number };

/** Árvore de categorias ativas + quantidade de ofertas no ar (inclui subcategorias) */
export async function categoryTree(): Promise<CategoryNode[]> {
  const [cats, counts] = await Promise.all([
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({ categoryId: offers.categoryId, n: count() })
      .from(offers)
      .innerJoin(platforms, eq(platforms.id, offers.platformId))
      .where(visible())
      .groupBy(offers.categoryId),
  ]);
  const byCat = new Map(counts.map((c) => [c.categoryId, c.n]));
  const roots = cats.filter((c) => !c.parentId);
  return roots.map((r) => {
    const children = cats.filter((c) => c.parentId === r.id);
    const n = (byCat.get(r.id) ?? 0) + children.reduce((a, c) => a + (byCat.get(c.id) ?? 0), 0);
    return { ...r, children, n };
  });
}

/** Resolve slug de categoria → ids (ela + subcategorias) e caminho para breadcrumb */
export function resolveCategory(tree: CategoryNode[], slug?: string) {
  if (!slug) return null;
  for (const root of tree) {
    if (root.slug === slug) return { node: root, parent: null, ids: [root.id, ...root.children.map((c) => c.id)] };
    const child = root.children.find((c) => c.slug === slug);
    if (child) return { node: child, parent: root, ids: [child.id] };
  }
  return null;
}

export function findCategoryById(tree: CategoryNode[], id: number | null) {
  if (!id) return null;
  for (const root of tree) {
    if (root.id === id) return { node: root as Category, parent: null };
    const child = root.children.find((c) => c.id === id);
    if (child) return { node: child, parent: root as Category };
  }
  return null;
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
  if (q) conds.push(ilike(offers.title, like(q)));
  return db
    .select({ offer: offers, platformName: platforms.name, categoryName: categories.name })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .leftJoin(categories, eq(categories.id, offers.categoryId))
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

/** Todas as categorias (painel), com contagem de ofertas */
export async function listAllCategories() {
  return db
    .select({
      id: categories.id, parentId: categories.parentId, name: categories.name, slug: categories.slug,
      icon: categories.icon, sortOrder: categories.sortOrder, isActive: categories.isActive,
      offers: sql<number>`(select count(*) from ${offers} o where o.category_id = ${categories.id})`.mapWith(Number),
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
