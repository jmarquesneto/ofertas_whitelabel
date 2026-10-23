import "server-only";
import { headers } from "next/headers";

/** IP do cliente respeitando o proxy reverso (Nginx Proxy Manager, Traefik, Cloudflare) */
export function ipFromHeaders(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}
