import Link from "next/link";
import { Ticket } from "lucide-react";
import { couponStores } from "@/server/coupon-queries";

export const metadata = { title: "Cupons de desconto", description: "Cupons válidos das lojas parceiras, postados todos os dias." };
export const dynamic = "force-dynamic";

export default async function CuponsPage() {
  const stores = await couponStores();
  const hoje = stores.reduce((n, s) => n + s.today, 0);
  return (
    <div className="container-site py-6 sm:py-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        <Ticket className="h-7 w-7 text-primary" strokeWidth={2.4} /> Cupons de desconto
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {hoje > 0 ? <><b className="text-ink">{hoje} cupom(ns) novo(s) hoje</b> · </> : null}Escolha a loja para ver todos os cupons.
      </p>

      {stores.length === 0 ? (
        <p className="card mt-8 p-10 text-center text-sm text-ink-muted">Nenhum cupom valendo agora. Volte daqui a pouco!</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/cupons/${s.slug}`}
                className="group flex h-full flex-col rounded-card border border-line/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="grid h-20 place-items-center">
                  {s.logoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoPath} alt={s.name} className="max-h-16 max-w-[75%] object-contain" />
                  ) : <span className="text-lg font-extrabold">{s.name}</span>}
                </span>
                <span className="mt-3 block truncate text-sm font-bold">{s.name}</span>
                {s.today > 0 ? (
                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold text-primary-fg">
                    🔥 {s.today} {s.today > 1 ? "novos" : "novo"} hoje
                  </span>
                ) : (
                  <span className="mt-1 text-xs font-semibold text-ink-faint">sem novos hoje</span>
                )}
                <span className="mt-1.5 text-xs text-ink-muted">{s.total} {s.total > 1 ? "cupons" : "cupom"} valendo</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
