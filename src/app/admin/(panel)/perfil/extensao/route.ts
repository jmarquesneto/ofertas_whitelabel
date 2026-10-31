/**
 * GET /admin/perfil/extensao — baixa a extensão do Chrome já apontando para este site.
 * Os arquivos ficam na pasta /extensao do projeto (copiada para a imagem Docker).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { makeZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

async function walk(dir: string, base = ""): Promise<{ name: string; data: Buffer }[]> {
  const out: { name: string; data: Buffer }[] = [];
  for (const entry of await readdir(dir)) {
    const abs = path.join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if ((await stat(abs)).isDirectory()) out.push(...(await walk(abs, rel)));
    else if (entry !== "config.json") out.push({ name: rel, data: await readFile(abs) });
  }
  return out;
}

export async function GET() {
  await requireUser();
  const s = await getSettings();
  const root = path.join(process.cwd(), "extensao");
  const files = await walk(root);
  const site = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  files.push({ name: "config.json", data: Buffer.from(JSON.stringify({ site, nome: s.siteName }, null, 2)) });
  const slug = s.siteName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vitrine";
  return new Response(new Uint8Array(makeZip(files.map((f) => ({ ...f, name: `extensao-${slug}/${f.name}` })))), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="extensao-${slug}.zip"`,
      "cache-control": "no-store",
    },
  });
}
