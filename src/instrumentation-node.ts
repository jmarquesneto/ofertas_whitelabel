import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import { siteSettings, platforms } from "./db/schema";

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

  await db
    .insert(siteSettings)
    .values({ id: 1, siteName: process.env.DEFAULT_SITE_NAME || "Minha Vitrine" })
    .onConflictDoNothing();

  const existing = await db.select({ id: platforms.id }).from(platforms).limit(1);
  if (existing.length === 0) {
    await db.insert(platforms).values([
      { name: "Shopee", slug: "shopee", sortOrder: 1 },
      { name: "Mercado Livre", slug: "mercado-livre", sortOrder: 2 },
      { name: "Amazon", slug: "amazon", sortOrder: 3 },
      { name: "Magalu", slug: "magalu", sortOrder: 4 },
    ]);
  }
  console.log("[boot] migrações aplicadas, configurações prontas");
}
