import { studioRequiresSetup } from "@/lib/ai-studio/runtime";
import { Suspense } from "react";
import { Studio } from "@/components/admin/ai-studio/studio";

export const metadata = {
  title: "Estúdio IA | Admin",
  description: "Fotos de variantes de cor com referências e revisão.",
};
export default function AIStudioPage() {
  if (studioRequiresSetup()) return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Estúdio IA</h1>
      <div className="rounded-xl border bg-card p-6">
        <p className="font-medium">Em preparação</p>
        <p className="mt-2 text-sm text-muted-foreground">Estamos preparando a geração de fotos para sua loja. O recurso será liberado após a conclusão da configuração.</p>
      </div>
    </div>
  );
  return (
    <Suspense
      fallback={
        <div className="p-8 text-muted-foreground">Abrindo o Estúdio…</div>
      }
    >
      <Studio />
    </Suspense>
  );
}
