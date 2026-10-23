import type { Config } from "tailwindcss";

/**
 * White label: as cores de marca NÃO são fixas aqui.
 * Elas apontam para variáveis CSS (canais RGB) que o layout raiz injeta
 * a partir da tabela site_settings. Assim `bg-primary/90`, `text-secondary`
 * etc. funcionam com qualquer cor salva no painel, sem rebuild.
 */
const brand = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: brand("--c-primary"), fg: brand("--c-on-primary") },
        secondary: { DEFAULT: brand("--c-secondary"), fg: brand("--c-on-secondary") },
        surface: { DEFAULT: "#F5F6F8", raised: "#FFFFFF", sunken: "#EEF0F3" },
        ink: { DEFAULT: "#111827", muted: "#4B5563", faint: "#6B7280" },
        line: "#E5E7EB",
        price: "#15803D",
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,39,.04), 0 4px 16px -8px rgba(17,24,39,.10)",
        lift: "0 2px 4px rgba(17,24,39,.06), 0 16px 32px -12px rgba(17,24,39,.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
