import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import { siteSettings, platforms, categories, banners } from "./db/schema";

/** Só roda no runtime Node (importado por instrumentation.ts) */
export async function bootstrap() {
  // Espera o Postgres aceitar conexões (o healthcheck do compose já ajuda)
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
      break;
    } catch (err) {
      if (attempt >= 15) throw err;
      console.warn(`[boot] banco indisponível (tentativa ${attempt}), aguardando…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const created = await db
    .insert(siteSettings)
    .values({ id: 1, siteName: process.env.DEFAULT_SITE_NAME || "Minha Vitrine" })
    .onConflictDoNothing()
    .returning({ id: siteSettings.id });

  // Instalação nova: primeiro banner de exemplo (em instalações antigas a migração converte o hero)
  if (created.length) {
    await db.insert(banners).values({
      name: "Banner principal", kind: "text", headline: "As melhores ofertas,", highlight: "todos os dias!",
      subtitle: "A gente garimpa as melhores promoções da internet para você economizar sem perder tempo.",
      ctaLabel: "Ver ofertas", ctaUrl: "#ofertas", sortOrder: 1,
    });
  }

  const existing = await db.select({ id: platforms.id }).from(platforms).limit(1);
  if (existing.length === 0) {
    await db.insert(platforms).values([
      { name: "Shopee", slug: "shopee", sortOrder: 1 },
      { name: "Mercado Livre", slug: "mercado-livre", sortOrder: 2 },
      { name: "Amazon", slug: "amazon", sortOrder: 3 },
      { name: "Magalu", slug: "magalu", sortOrder: 4 },
    ]);
  }
  // Categorias iniciais (só se ainda não houver nenhuma)
  const hasCat = await db.select({ id: categories.id }).from(categories).limit(1);
  if (hasCat.length === 0) {
    const tree: [string, string, string, string[]][] = [
      ["Eletrônicos", "eletronicos", "monitor-smartphone", ["TVs e Áudio", "Celulares e Smartphones", "Computadores e Notebooks", "Games", "Acessórios"]],
      ["Casa e Cozinha", "casa-e-cozinha", "house", ["Eletroportáteis", "Utilidades", "Decoração"]],
      ["Esporte e Lazer", "esporte-e-lazer", "dumbbell", []],
      ["Moda", "moda", "shirt", []],
      ["Beleza e Saúde", "beleza-e-saude", "sparkles", []],
      ["Automotivo", "automotivo", "car", []],
      ["Brinquedos", "brinquedos", "toy-brick", []],
    ];
    const slugify = (t: string) =>
      t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (const [i, [name, slug, icon, subs]] of tree.entries()) {
      const [parent] = await db.insert(categories).values({ name, slug, icon, sortOrder: i + 1 }).returning({ id: categories.id });
      if (subs.length)
        await db.insert(categories).values(
          subs.map((n, j) => ({ name: n, slug: slugify(n), icon: icon, parentId: parent.id, sortOrder: j + 1 })),
        );
    }
  }

  console.log("[boot] migrações aplicadas, configurações prontas");
}
