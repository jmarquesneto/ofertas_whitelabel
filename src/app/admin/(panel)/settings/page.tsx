import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Aparência do site" };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Aparência do site" subtitle="Tudo aqui é aplicado na vitrine assim que você salvar." />
      <SettingsForm settings={settings} />
    </>
  );
}
