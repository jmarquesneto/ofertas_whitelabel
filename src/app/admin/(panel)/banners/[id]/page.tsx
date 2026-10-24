import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { banners } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { updateBannerAction } from "@/server/actions/banners";
import { PageHeader } from "@/components/admin/PageHeader";
import { BannerForm } from "@/components/admin/BannerForm";

export const metadata = { title: "Editar banner" };

export default async function EditBanner({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("banners");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[b], s] = await Promise.all([db.select().from(banners).where(eq(banners.id, id)).limit(1), getSettings()]);
  if (!b) notFound();
  return (
    <>
      <PageHeader title={`Editar · ${b.name}`} />
      <BannerForm action={updateBannerAction.bind(null, id)} initial={b} tz={process.env.TZ || "America/Sao_Paulo"} secondary={s.secondaryColor} />
    </>
  );
}
