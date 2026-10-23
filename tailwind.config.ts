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
        surface: { DEFAULT: "#FAF8F5", raised: "#FFFFFF", sunken: "#F1EDE7" },
        ink: { DEFAULT: "#1C1A17", muted: "#5F5A53", faint: "#77716A" },
        line: "#E4DED5",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
} satisfies Config;
