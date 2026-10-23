import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platforms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { updatePlatformAction } from "@/server/actions/platforms";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlatformForm } from "@/components/admin/PlatformForm";

export const metadata = { title: "Editar plataforma" };

export default async function EditPlatform({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(platforms).where(eq(platforms.id, id)).limit(1);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Editar · ${p.name}`} />
      <PlatformForm action={updatePlatformAction.bind(null, id)} initial={p} />
    </>
  );
}
