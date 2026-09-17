"use client";

import { CheckCircle2, Circle, LoaderCircle, CircleAlert } from "lucide-react";
import { newGenerationProgress, shotLabels, type Job } from "@/lib/ai-studio/types";

export function GenerationProgress({ job }: { job: Job }) {
  if (["queued_analysis", "analyzing"].includes(job.status)) return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/30 p-4" role="status">
      <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none text-primary" aria-hidden="true" />
      <div><p className="text-sm font-medium">{job.status === "queued_analysis" ? "Análise na fila" : "Analisando as referências"}</p>
        <p className="text-xs text-muted-foreground">Aguarde a ficha da roupa antes de gerar as fotos.</p></div>
    </div>
  );
  const active = ["queued_generation", "generating"].includes(job.status);
  if (!active && !(job.status === "failed" && job.generationProgress)) return null;
  const progress = job.generationProgress || newGenerationProgress(job.pendingAngles);
  const completed = progress.shots.filter(shot => progress.completed.includes(shot)).length;
  const total = progress.shots.length;
  const remaining = total - completed;
  const queued = job.status === "queued_generation";
  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4" aria-busy={active}>
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        {active ? <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none text-primary" aria-hidden="true" /> : <CircleAlert className="size-5 shrink-0 text-destructive" aria-hidden="true" />}
        <div>
          <p className="text-sm font-medium">{queued ? "Geração na fila" : !active ? "Geração interrompida" : progress.current === "detail" ? "Preparando o detalhe" : progress.current ? `Gerando ${shotLabels[progress.current].toLowerCase()}` : "Finalizando as imagens"}</p>
          <p className="text-xs text-muted-foreground">{completed} de {total} fotos prontas · {remaining === 1 ? "falta 1 foto" : `faltam ${remaining} fotos`}</p>
        </div>
      </div>
      <div role="progressbar" aria-label="Fotos concluídas nesta solicitação" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={completed} aria-valuetext={`${completed} de ${total} fotos prontas`} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${total ? completed / total * 100 : 0}%` }} />
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {progress.shots.map(shot => {
          const done = progress.completed.includes(shot);
          const current = progress.current === shot && !done;
          const Icon = done ? CheckCircle2 : current && active && !queued ? LoaderCircle : current && !active ? CircleAlert : Circle;
          return <li key={shot} className="flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${done ? "text-green-600" : "text-muted-foreground"} ${current && active && !queued ? "animate-spin motion-reduce:animate-none" : ""}`} />
            <div><span className="font-medium">{shotLabels[shot]}</span><span className="block text-muted-foreground">{done ? "Pronta" : current && !active ? "Interrompida" : current && !queued ? "Em andamento" : "Aguardando"}</span></div>
          </li>;
        })}
      </ul>
      <p className="text-xs text-muted-foreground">O progresso avança a cada foto pronta. O tempo de cada imagem pode variar.</p>
    </div>
  );
}
