"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/client/favorites";
import { OfferCard, type PublicOffer } from "./OfferCard";

export function FavoritesList() {
  const ids = useFavorites();
  const [offers, setOffers] = useState<PublicOffer[] | null>(null);

  useEffect(() => {
    if (!ids.length) { setOffers([]); return; }
    let alive = true;
    fetch(`/api/favoritos?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((rows: PublicOffer[]) => {
        if (!alive) return;
        const order = new Map(ids.map((id, i) => [id, i]));
        setOffers(rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      })
      .catch(() => alive && setOffers([]));
    return () => { alive = false; };
  }, [ids]);

  if (offers === null)
    return <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/5] animate-pulse rounded-card bg-surface-sunken" />)}</div>;

  if (offers.length === 0)
    return (
      <div className="card mt-6 grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/20"><Heart className="h-6 w-6" /></span>
        <p className="font-bold">Nenhum favorito ainda</p>
        <p className="max-w-sm text-sm text-ink-muted">Toque no coração de uma oferta para guardá-la aqui e decidir com calma.</p>
        <Link href="/ofertas" className="btn-primary mt-1">Ver ofertas</Link>
      </div>
    );

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {offers.map((o) => <OfferCard key={o.id} offer={o} />)}
    </div>
  );
}
