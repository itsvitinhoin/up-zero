import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const { tick, heartbeat } = await import("../lib/ai-studio/worker");
  let stopping = false;
  process.once("SIGTERM", () => {
    stopping = true;
  });
  process.once("SIGINT", () => {
    stopping = true;
  });
  const timer = setInterval(() => {
    void heartbeat().catch(() => console.error("[studio] Falha no heartbeat."));
  }, 5000);
  console.log("[studio] Worker ativo; aguardando solicitações do Admin.");
  try {
    while (!stopping) {
      await heartbeat();
      try {
        await tick();
      } catch {
        console.error(
          "[studio] Falha ao consultar a fila; verifique o volume persistente.",
        );
      }
      if (!stopping) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } finally {
    clearInterval(timer);
  }
}
main().catch(() => {
  console.error(
    "[studio] Não foi possível iniciar. Confira AI_STUDIO_DATA_DIR.",
  );
  process.exitCode = 1;
});
