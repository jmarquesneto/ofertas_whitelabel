import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const MAX_BYTES = Number(process.env.UPLOAD_MAX_MB ?? 8) * 1024 * 1024;

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

/** Confere a assinatura real do arquivo (não confia só no Content-Type do navegador) */
function sniff(buf: Buffer): string | null {
  const hex = buf.subarray(0, 12).toString("hex");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpg";
  if (hex.startsWith("47494638")) return "gif";
  if (hex.startsWith("52494646") && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  if (hex.startsWith("00000100")) return "ico";
  const head = buf.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}

export class UploadError extends Error {}

/**
 * Salva um File de um FormData em UPLOAD_DIR/<pasta>/<uuid>.<ext>
 * Retorna o caminho público (/uploads/...) ou null se nenhum arquivo foi enviado.
 */
export async function saveUpload(file: FormDataEntryValue | null, folder: "brand" | "platforms" | "offers") {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new UploadError(`Arquivo maior que ${MAX_BYTES / 1024 / 1024} MB`);
  if (!TYPES[file.type]) throw new UploadError("Formato não suportado (use PNG, JPG, WEBP, GIF, SVG ou ICO)");

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new UploadError("O conteúdo do arquivo não é uma imagem válida");

  const dir = path.join(UPLOAD_DIR, folder);
  const name = `${randomUUID()}.${ext}`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    console.error(`[upload] falha ao gravar em ${dir}:`, err);
    if (code === "EACCES" || code === "EPERM")
      throw new UploadError(
        `Sem permissão para gravar imagens em ${UPLOAD_DIR}. Confira o dono da pasta uploads no servidor (PUID/PGID) e reinicie o container.`,
      );
    if (code === "ENOSPC") throw new UploadError("Disco cheio: não há espaço para salvar a imagem.");
    if (code === "EROFS") throw new UploadError("A pasta de uploads está montada como somente leitura.");
    throw new UploadError(`Não foi possível salvar a imagem (${code ?? "erro desconhecido"}).`);
  }
  return `/uploads/${folder}/${name}`;
}

/** Remove um upload antigo (ignora URLs externas e erros) */
export async function removeUpload(publicPath: string | null | undefined) {
  if (!publicPath?.startsWith("/uploads/")) return;
  const abs = path.resolve(UPLOAD_DIR, publicPath.replace(/^\/uploads\//, ""));
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return;
  await unlink(abs).catch(() => {});
}
