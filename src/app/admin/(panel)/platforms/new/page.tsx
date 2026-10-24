import { requirePage } from "@/lib/auth";
import { createPlatformAction } from "@/server/actions/platforms";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlatformForm } from "@/components/admin/PlatformForm";

export const metadata = { title: "Nova plataforma" };

export default async function NewPlatform() {
  await requirePage("platforms");
  return (
    <>
      <PageHeader title="Nova plataforma" />
      <PlatformForm action={createPlatformAction} />
    </>
  );
}
