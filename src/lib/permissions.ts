/** Grupos e páginas do painel (usado no servidor e no navegador) */
export const ROLES = [
  { key: "admin", label: "Administrador", desc: "Acesso total, inclusive usuários e permissões." },
  { key: "moderator", label: "Moderador", desc: "Cuida do conteúdo do site." },
  { key: "poster", label: "Postador", desc: "Publica ofertas." },
] as const;
export type Role = (typeof ROLES)[number]["key"];
export const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label ?? r;

export const PAGES = [
  { key: "analytics", label: "Analytics", href: "/admin" },
  { key: "offers", label: "Ofertas", href: "/admin/offers" },
  { key: "banners", label: "Banners", href: "/admin/banners" },
  { key: "categories", label: "Categorias", href: "/admin/categories" },
  { key: "platforms", label: "Plataformas", href: "/admin/platforms" },
  { key: "settings", label: "Aparência", href: "/admin/settings" },
  { key: "users", label: "Usuários", href: "/admin/users" },
] as const;
export type PageKey = (typeof PAGES)[number]["key"];

/** Páginas que só o administrador acessa, sem possibilidade de liberar */
export const ADMIN_ONLY: PageKey[] = ["users"];
