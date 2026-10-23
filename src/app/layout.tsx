import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { hexToChannels, onColor } from "@/lib/color";

export const dynamic = "force-dynamic";

/** Título, descrição e favicon vêm do banco (white label) */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.siteName, template: `%s · ${s.siteName}` },
    description: s.tagline ?? `Ofertas e cupons selecionados por ${s.siteName}`,
    icons: s.faviconPath ? { icon: s.faviconPath, shortcut: s.faviconPath } : undefined,
    openGraph: { siteName: s.siteName, images: s.logoPath ? [s.logoPath] : undefined },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();

  // Injeção das cores dinâmicas: o Tailwind lê estas variáveis (ver tailwind.config.ts)
  const brandVars = {
    "--c-primary": hexToChannels(s.primaryColor),
    "--c-on-primary": onColor(s.primaryColor),
    "--c-secondary": hexToChannels(s.secondaryColor),
    "--c-on-secondary": onColor(s.secondaryColor),
  } as CSSProperties;

  return (
    <html lang="pt-BR" style={brandVars}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap"
        />
        <meta name="theme-color" content={s.primaryColor} />
      </head>
      <body>{children}</body>
    </html>
  );
}
