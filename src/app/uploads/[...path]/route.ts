/** Serve os arquivos enviados (volume persistente UPLOAD_DIR) com proteção contra path traversal */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon",
};

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const abs = path.resolve(UPLOAD_DIR, ...parts);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return new NextResponse("Not found", { status: 404 });

  const ext = path.extname(abs).slice(1).toLowerCase();
  const type = MIME[ext];
  if (!type) return new NextResponse("Not found", { status: 404 });

  try {
    const [buf, info] = await Promise.all([readFile(abs), stat(abs)]);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        // nomes são UUIDs: um arquivo novo sempre tem nome novo → cache longo é seguro
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // SVG enviado não consegue executar script
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
