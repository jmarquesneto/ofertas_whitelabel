/** "#C2410C" → "194 65 12" (canais para rgb(var(--x) / alpha)) */
export function hexToChannels(hex: string): string {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "000000";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

function luminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex)
    .split(" ")
    .map(Number)
    .map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cor de texto legível sobre a cor de marca (preto ou branco),
 * escolhida pelo maior contraste WCAG — o cliente pode escolher
 * qualquer primária sem quebrar a leitura dos botões.
 */
export function onColor(hex: string): string {
  const L = luminance(hex);
  const withWhite = 1.05 / (L + 0.05);
  const withInk = (L + 0.05) / (luminance("#1C1A17") + 0.05);
  return withWhite >= withInk ? "255 255 255" : "28 26 23";
}

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
