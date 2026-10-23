/**
 * Executado uma vez quando o servidor Next sobe (dentro do container).
 * 1. Aplica as migrações SQL pendentes (pasta /drizzle)
 * 2. Garante a linha de configurações e plataformas iniciais
 * Assim o deploy no Portainer não precisa de nenhum comando manual.
 */
export async function register() {
  // A condição precisa ficar inline para o bundler remover o código Node do build Edge
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_MIGRATIONS !== "true") {
    const { bootstrap } = await import("./instrumentation-node");
    await bootstrap();
  }
}
