import { asc, count, eq, gt, sql } from "drizzle-orm";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { db } from "@/db";
import { couponClicks, coupons, platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getWhatsappSettings } from "@/lib/bot";
import { cn, fmtInt } from "@/lib/utils";
import { deleteCouponAction, deleteExpiredCouponsAction, toggleCouponAction } from "@/server/actions/coupons";
import { groupsFor, waReady } from "@/server/whatsapp";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionButton, IconAction } from "@/components/admin/ui";
import { CouponCreateForm, CouponImport, MissingSetupHint } from "@/components/admin/CouponForms";
import { ResendButton } from "@/components/admin/WhatsappForms";

export const metadata = { title: "Cupons" };
export const dynamic = "force-dynamic";

const brl = (v: string | null) => (v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null);

export default async function CuponsAdminPage() {
  await requirePage("coupons");
  const [plats, list, clicks, wa, groups] = await Promise.all([
    db.select().from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.name)),
    db.select().from(coupons).orderBy(asc(coupons.code)),
    db
      .select({ platformId: couponClicks.platformId, n: count() })
      .from(couponClicks)
      .where(gt(couponClicks.createdAt, sql`now() - interval '7 days'`))
      .groupBy(couponClicks.platformId),
    getWhatsappSettings(),
    groupsFor("coupons"),
  ]);
  const ready = waReady(wa);
  const now = new Date();
  const clicksBy = new Map(clicks.map((c) => [c.platformId, c.n]));
  const withCoupons = plats.filter((p) => list.some((c) => c.platformId === p.id));
  const expired = list.filter((c) => c.expiresAt && c.expiresAt <= now).length;

  return (
    <>
      <PageHeader
        title="Cupons"
        subtitle="Aparecem em /cupons no site e vão ao WhatsApp numa mensagem por loja, com o banner de cupons e o link de afiliado dela."
        action={expired > 0 ? <ActionButton action={deleteExpiredCouponsAction} confirmText={`Excluir ${expired} cupom(ns) vencido(s)?`}>Excluir {expired} vencido(s)</ActionButton> : undefined}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <CouponImport waReady={ready} couponGroups={groups.length} />
        <CouponCreateForm platforms={plats.map((p) => ({ id: p.id, name: p.name }))} waReady={ready} couponGroups={groups.length} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-extrabold">Cupons por loja</h2>
      {withCoupons.length === 0 ? (
        <p className="card p-10 text-center text-sm text-ink-muted">Nenhum cupom ainda. Importe um CSV ou cadastre acima.</p>
      ) : (
        <div className="grid gap-4">
          {withCoupons.map((p) => {
            const mine = list.filter((c) => c.platformId === p.id);
            const live = mine.filter((c) => c.isActive && (!c.expiresAt || c.expiresAt > now)).length;
            return (
              <section key={p.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
                  {p.couponBannerPath || p.logoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(p.couponBannerPath ?? p.logoPath)!} alt="" className="h-14 w-24 rounded-lg border border-line bg-white object-cover" />
                  ) : <span className="h-14 w-24 rounded-lg bg-surface-sunken" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{p.name} <span className="font-mono text-xs font-normal text-ink-faint">ID {p.id}</span></p>
                    <p className="text-xs text-ink-muted">{live} valendo · {fmtInt(clicksBy.get(p.id) ?? 0)} clique(s) no link da loja em 7 dias</p>
                    <MissingSetupHint banner={Boolean(p.couponBannerPath)} link={Boolean(p.couponUrl)} />
                  </div>
                  <a href={`/admin/platforms/${p.id}`} className="btn-ghost px-3 py-1.5 text-xs">Banner e link</a>
                  {ready && groups.length > 0 && live > 0 && <ResendButton platformId={p.id} label="Enviar ao WhatsApp" />}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <tbody>
                      {mine.map((c) => {
                        const isExpired = Boolean(c.expiresAt && c.expiresAt <= now);
                        return (
                          <tr key={c.id} className={cn((!c.isActive || isExpired) && "opacity-55")}>
                            <td className="table-cell w-44 font-mono font-bold">{c.code}</td>
                            <td className="table-cell text-sm">{c.description ?? <span className="text-ink-faint">—</span>}</td>
                            <td className="table-cell whitespace-nowrap text-sm text-ink-muted">{brl(c.minValue) ? `mín. ${brl(c.minValue)}` : ""}</td>
                            <td className="table-cell whitespace-nowrap text-sm">
                              {isExpired ? <span className="font-semibold text-red-700">Vencido</span>
                                : !c.isActive ? <span className="font-semibold text-ink-faint">Pausado</span>
                                : c.expiresAt ? <span className="text-ink-muted">até {c.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" })}</span>
                                : <span className="text-emerald-700">Sem validade</span>}
                            </td>
                            <td className="table-cell">
                              <div className="flex justify-end gap-1">
                                <IconAction action={toggleCouponAction.bind(null, c.id)} label={c.isActive ? "Pausar" : "Reativar"}>
                                  {c.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </IconAction>
                                <IconAction action={deleteCouponAction.bind(null, c.id)} label="Excluir" danger confirmText={`Excluir o cupom ${c.code}?`}>
                                  <Trash2 className="h-4 w-4" />
                                </IconAction>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
