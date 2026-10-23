import { getSettings } from "@/lib/settings";
import { categoryTree } from "@/server/queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { MobileNav } from "@/components/public/MobileNav";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, tree] = await Promise.all([getSettings(), categoryTree()]);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader settings={settings} tree={tree} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
      <MobileNav />
    </div>
  );
}
