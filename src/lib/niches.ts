/**
 * Catálogo de nichos do robô (usado no painel e enviado ao coletor).
 * Cada nicho mapeia, de uma vez, o equivalente em cada loja:
 *  - Mercado Livre: IDs de categoria (mercadolivre.com.br/ofertas?category=MLB…)
 *  - Amazon: departamentos (s?i=<alias>) e/ou termos de busca
 *  - Shopee: palavras-chave (a Open API busca por keyword)
 * Nenhum nicho marcado = todas as categorias.
 */
export type Niche = {
  key: string; emoji: string; name: string;
  ml?: Record<string, string>;
  amazonDep?: Record<string, string>;
  amazonBuscas?: string[];
  shopee?: string[];
};

export const NICHES: Niche[] = [
  { key: "tecnologia", emoji: "💻", name: "Tecnologia e Eletrônicos",
    ml: { MLB1648: "Informática", MLB1000: "Eletrônicos, Áudio e Vídeo" },
    amazonDep: { electronics: "Eletrônicos", computers: "Informática", "amazon-devices": "Dispositivos Amazon" },
    shopee: ["fone bluetooth", "smartwatch", "mouse gamer", "ssd", "carregador turbo"] },
  { key: "celulares", emoji: "📱", name: "Celulares e Acessórios",
    ml: { MLB1051: "Celulares e Telefones" },
    amazonBuscas: ["celular", "smartphone", "capa celular"],
    shopee: ["capa celular", "power bank", "carregador", "película"] },
  { key: "games", emoji: "🎮", name: "Games",
    ml: { MLB1144: "Games" }, amazonDep: { videogames: "Games" },
    shopee: ["controle", "headset gamer", "teclado mecânico"] },
  { key: "casa", emoji: "🏠", name: "Casa e Cozinha",
    ml: { MLB1574: "Casa, Móveis e Decoração" },
    amazonDep: { home: "Casa", kitchen: "Cozinha", furniture: "Móveis" },
    shopee: ["organizador", "panela", "utensílios de cozinha"] },
  { key: "eletrodomesticos", emoji: "🔌", name: "Eletrodomésticos",
    ml: { MLB5726: "Eletrodomésticos" }, amazonDep: { appliances: "Eletrodomésticos" },
    shopee: ["air fryer", "liquidificador", "aspirador de pó"] },
  { key: "moda", emoji: "👗", name: "Moda e Acessórios",
    ml: { MLB1430: "Calçados, Roupas e Bolsas" },
    amazonDep: { fashion: "Moda", "fashion-luggage": "Bolsas e Malas" },
    shopee: ["tênis", "camiseta", "relógio", "mochila"] },
  { key: "beleza", emoji: "💄", name: "Beleza e Cuidados",
    ml: { MLB1246: "Beleza e Cuidado Pessoal" },
    amazonDep: { beauty: "Beleza", "luxury-beauty": "Beleza de Luxo" },
    shopee: ["maquiagem", "perfume", "skincare"] },
  { key: "esporte", emoji: "💪", name: "Esporte e Fitness",
    ml: { MLB1276: "Esportes e Fitness" }, amazonDep: { sporting: "Esportes" },
    shopee: ["suplemento", "roupa academia", "garrafa térmica"] },
  { key: "saude", emoji: "🩺", name: "Saúde e Bem-estar",
    ml: { MLB264586: "Saúde" }, amazonBuscas: ["vitamina", "suplemento"],
    shopee: ["vitamina", "creatina", "massageador"] },
  { key: "brinquedos", emoji: "🧸", name: "Brinquedos e Bebês",
    ml: { MLB1132: "Brinquedos e Hobbies" }, amazonDep: { toys: "Brinquedos", baby: "Bebês" },
    shopee: ["brinquedo", "lego", "fralda"] },
  { key: "pet", emoji: "🐶", name: "Pet",
    ml: { MLB1071: "Animais" }, amazonDep: { pets: "Pet Shop" },
    shopee: ["ração", "brinquedo pet", "coleira"] },
  { key: "automotivo", emoji: "🚗", name: "Automotivo",
    ml: { MLB5672: "Acessórios para Veículos" }, amazonDep: { automotive: "Automotivo" },
    shopee: ["acessório carro", "suporte veicular", "capacete"] },
  { key: "livros", emoji: "📚", name: "Livros",
    ml: { MLB1196: "Livros, Revistas e Comics" }, amazonDep: { stripbooks: "Livros" },
    shopee: ["livro"] },
];

export const NICHE_KEYS = NICHES.map((n) => n.key);

/** Junta os nichos escolhidos nas listas que cada loja entende */
export function expandNiches(keys: string[]) {
  const ml: Record<string, string> = {};
  const amazonDep: Record<string, string> = {};
  const amazonBuscas: string[] = [];
  const shopee: string[] = [];
  for (const k of keys) {
    const n = NICHES.find((x) => x.key === k);
    if (!n) continue;
    Object.assign(ml, n.ml);
    Object.assign(amazonDep, n.amazonDep);
    for (const t of n.amazonBuscas ?? []) if (!amazonBuscas.includes(t)) amazonBuscas.push(t);
    for (const t of n.shopee ?? []) if (!shopee.includes(t)) shopee.push(t);
  }
  return { ml, amazonDep, amazonBuscas, shopee };
}
