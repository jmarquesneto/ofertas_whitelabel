import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getWhatsappSettings } from "@/lib/bot";
import { waReady } from "@/server/whatsapp";
import { createOfferAction } from "@/server/actions/offers";
import { PageHeader } from "@/components/admin/PageHeader";
import { OfferForm } from "@/components/admin/OfferForm";

export const metadata = { title: "Nova oferta" };

export default async function NewOffer() {
  await requirePage("offers");
  const [list, cats] = await Promise.all([
    db.select({ id: platforms.id, name: platforms.name }).from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.name)),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
  ]);
  return (
    <>
      <PageHeader title="Nova oferta" />
      {list.length === 0 ? (
        <p className="card p-5 text-sm">Cadastre uma <a className="font-semibold underline" href="/admin/platforms/new">plataforma</a> antes da primeira oferta.</p>
      ) : (
        <OfferForm
          action={createOfferAction}
          platforms={list}
          categories={cats}
          siteUrl={process.env.PUBLIC_URL ?? ""}
          defaultHours={Number(process.env.OFFER_DEFAULT_HOURS ?? 72)}
          whatsappReady={waReady(await getWhatsappSettings())}
        />
      )}
    </>
  );
}
