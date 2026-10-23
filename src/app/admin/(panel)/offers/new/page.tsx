import { asc } from "drizzle-orm";
import { db } from "@/db";
import { platforms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createOfferAction } from "@/server/actions/offers";
import { PageHeader } from "@/components/admin/PageHeader";
import { OfferForm } from "@/components/admin/OfferForm";

export const metadata = { title: "Nova oferta" };

export default async function NewOffer() {
  await requireAdmin();
  const list = await db.select({ id: platforms.id, name: platforms.name }).from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.name));
  return (
    <>
      <PageHeader title="Nova oferta" />
      {list.length === 0 ? (
        <p className="card p-5 text-sm">Cadastre uma <a className="font-semibold underline" href="/admin/platforms/new">plataforma</a> antes da primeira oferta.</p>
      ) : (
        <OfferForm
          action={createOfferAction}
          platforms={list}
          siteUrl={process.env.PUBLIC_URL ?? ""}
          defaultHours={Number(process.env.OFFER_DEFAULT_HOURS ?? 72)}
        />
      )}
    </>
  );
}
