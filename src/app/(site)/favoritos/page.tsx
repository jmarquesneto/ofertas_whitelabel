import { FavoritesList } from "@/components/public/FavoritesList";

export const metadata = { title: "Favoritos" };

export default function FavoritesPage() {
  return (
    <div className="container-site py-6 sm:py-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Seus favoritos</h1>
      <p className="mt-1 text-sm text-ink-muted">Salvos só neste navegador. Ofertas que expiram saem da lista automaticamente.</p>
      <FavoritesList />
    </div>
  );
}
