import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createBannerAction } from "@/server/actions/banners";
import { PageHeader } from "@/components/admin/PageHeader";
import { BannerForm } from "@/components/admin/BannerForm";

export const metadata = { title: "Novo banner" };

export default async function NewBanner() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Novo banner" />
      <BannerForm action={createBannerAction} tz={process.env.TZ || "America/Sao_Paulo"} secondary={s.secondaryColor} />
    </>
  );
}
