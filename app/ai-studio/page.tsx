import { Suspense } from "react";
import { Studio } from "@/components/admin/ai-studio/studio";

export const metadata = {
  title: "Estúdio IA | Admin",
  description: "Fotos de variantes de cor com referências e revisão.",
};
export default function AIStudioPage() {
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
