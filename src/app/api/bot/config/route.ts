/**
 * GET /api/bot/config — o coletor lê aqui tudo o que precisa a cada ciclo.
 * Protegido pelo BOT_TOKEN (rede interna do compose).
 */
import { NextResponse } from "next/server";
import { getBotSettings } from "@/lib/bot";
import { decrypt } from "@/lib/crypto";
import { expandNiches } from "@/lib/niches";
import { botAuthorized, recentExternalIds } from "@/server/bot-intake";

export const dynamic = "force-dynamic";

const dec = (v: string | null) => {
  if (!v) return "";
  try { return decrypt(v); } catch { return ""; }
};

export async function GET(req: Request) {
  if (!botAuthorized(req)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const s = await getBotSettings();
  const n = s.niches.length ? expandNiches(s.niches) : null;
  const { mercadolivre: ml, amazon: az, shopee: sp } = s.sources;

  return NextResponse.json({
    ativo: s.enabled,
    modo: s.mode,
    intervalo_minutos: s.intervalMinutes,
    max_posts_por_ciclo: s.maxPerCycle,
    espacamento_segundos: s.mode === "direct" ? s.spacingSeconds : 0,
    horario_ativo: `${s.activeFrom}-${s.activeTo}`,
    filtros: {
      desconto_minimo: s.minDiscount,
      desconto_maximo: s.maxDiscount,
      preco_minimo: s.minPrice ? Number(s.minPrice) : 0,
      preco_maximo: s.maxPrice ? Number(s.maxPrice) : 0,
      palavras_bloqueadas: s.blockedWords,
    },
    fontes: {
      mercadolivre: {
        ativa: ml.enabled, etiqueta: ml.etiqueta, paginas: ml.paginas,
        categorias: n ? n.ml : {},
      },
      amazon: {
        ativa: az.enabled, tag: az.tag, credential_id: az.credentialId, credential_secret: dec(az.credentialSecretEnc),
        paginas: az.paginas, requisicoes_por_ciclo: az.requisicoesPorCiclo,
        departamentos: n ? n.amazonDep : {},
        buscas: n ? [...new Set([...n.amazonBuscas, ...az.buscas])] : az.buscas,
      },
      shopee: {
        ativa: sp.enabled, app_id: sp.appId, app_secret: dec(sp.appSecretEnc), limite: sp.limite,
        buscas: n ? [...new Set([...n.shopee, ...sp.buscas])] : sp.buscas,
      },
    },
    ja_usados: await recentExternalIds(s.noRepeatDays),
  });
}
