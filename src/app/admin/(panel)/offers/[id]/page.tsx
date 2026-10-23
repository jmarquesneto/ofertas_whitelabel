import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, offers, platforms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { updateOfferAction } from "@/server/actions/offers";
import { PageHeader } from "@/components/admin/PageHeader";
import { OfferForm } from "@/components/admin/OfferForm";
import { fmtInt } from "@/lib/utils";

export const metadata = { title: "Editar oferta" };

export default async function EditOffer({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[offer], list, cats] = await Promise.all([
    db.select().from(offers).where(eq(offers.id, id)).limit(1),
    db.select({ id: platforms.id, name: platforms.name }).from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.name)),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
  ]);
  if (!offer) notFound();
  return (
    <>
      <PageHeader title="Editar oferta" subtitle={`${fmtInt(offer.clicksCount)} cliques até agora`} />
      <OfferForm
        action={updateOfferAction.bind(null, id)}
        platforms={list}
        categories={cats}
        initial={offer}
        siteUrl={process.env.PUBLIC_URL ?? ""}
        defaultHours={Number(process.env.OFFER_DEFAULT_HOURS ?? 72)}
      />
    </>
  );
}
