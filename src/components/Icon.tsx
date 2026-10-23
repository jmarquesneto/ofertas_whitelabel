import {
  Baby, BadgeCheck, Bike, BookOpen, Camera, Car, Clock, Coffee, Dumbbell, Gamepad2, Gem, Gift,
  Hammer, Headphones, Heart, House, Lamp, Laptop, LayoutGrid, Leaf, MonitorSmartphone, Music,
  Package, PawPrint, Percent, Pill, Plane, Shirt, ShieldCheck, ShoppingBag, Smartphone, Sofa,
  Sparkles, Store, Tag, ToyBrick, Truck, Tv, Utensils, Watch, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Conjunto fechado de ícones disponíveis para categorias e selos do hero.
 * O nome salvo no banco é a chave deste mapa.
 */
export const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  "monitor-smartphone": { icon: MonitorSmartphone, label: "Eletrônicos" },
  tv: { icon: Tv, label: "TV" },
  smartphone: { icon: Smartphone, label: "Celular" },
  laptop: { icon: Laptop, label: "Notebook" },
  headphones: { icon: Headphones, label: "Fone" },
  "gamepad-2": { icon: Gamepad2, label: "Games" },
  camera: { icon: Camera, label: "Câmera" },
  watch: { icon: Watch, label: "Relógio" },
  house: { icon: House, label: "Casa" },
  sofa: { icon: Sofa, label: "Móveis" },
  lamp: { icon: Lamp, label: "Decoração" },
  utensils: { icon: Utensils, label: "Cozinha" },
  coffee: { icon: Coffee, label: "Café" },
  hammer: { icon: Hammer, label: "Ferramentas" },
  wrench: { icon: Wrench, label: "Reparos" },
  dumbbell: { icon: Dumbbell, label: "Esporte" },
  bike: { icon: Bike, label: "Bicicleta" },
  shirt: { icon: Shirt, label: "Moda" },
  gem: { icon: Gem, label: "Joias" },
  sparkles: { icon: Sparkles, label: "Beleza" },
  pill: { icon: Pill, label: "Saúde" },
  leaf: { icon: Leaf, label: "Natural" },
  car: { icon: Car, label: "Automotivo" },
  "toy-brick": { icon: ToyBrick, label: "Brinquedos" },
  baby: { icon: Baby, label: "Bebês" },
  "paw-print": { icon: PawPrint, label: "Pets" },
  "book-open": { icon: BookOpen, label: "Livros" },
  music: { icon: Music, label: "Música" },
  plane: { icon: Plane, label: "Viagem" },
  gift: { icon: Gift, label: "Presentes" },
  "shopping-bag": { icon: ShoppingBag, label: "Compras" },
  package: { icon: Package, label: "Pacote" },
  tag: { icon: Tag, label: "Etiqueta" },
  percent: { icon: Percent, label: "Desconto" },
  zap: { icon: Zap, label: "Relâmpago" },
  heart: { icon: Heart, label: "Coração" },
  "shield-check": { icon: ShieldCheck, label: "Segurança" },
  "badge-check": { icon: BadgeCheck, label: "Verificado" },
  truck: { icon: Truck, label: "Entrega" },
  store: { icon: Store, label: "Loja" },
  clock: { icon: Clock, label: "Relógio/tempo" },
  "layout-grid": { icon: LayoutGrid, label: "Grade" },
};

export function Icon({ name, className, strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
  const I = ICONS[name]?.icon ?? Tag;
  return <I className={className} strokeWidth={strokeWidth} aria-hidden />;
}
