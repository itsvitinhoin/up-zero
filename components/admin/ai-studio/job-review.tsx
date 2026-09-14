"use client";

import { useState } from "react";
import { Check, Download, RotateCcw, Crop, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  verifiedAngles,
  isBusy,
  shotLabels,
  statusLabels,
  type Job,
  type Shot,
} from "@/lib/ai-studio/types";
import { api, media, Photo } from "./helpers";

export function JobReview({
  job,
  onChange,
  onClone,
  run,
  busy,
}: {
  job: Job;
  onChange: (job: Job) => void;
  onClone: () => void;
  run: (action: () => Promise<void>) => void;
  busy: boolean;
}) {

  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0.2, y: 0.3, width: 0.4, height: 0.4 });
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const working = isBusy(job),
    blocked = busy || working;
  const supported = verifiedAngles(job);
  const missing = job.angles.filter((a) => !supported.includes(a));
  const approved = job.outputs.filter((o) => o.approved && !o.publishedUrl);
  const orderedShots: Shot[] = [
    ...job.angles,
    ...(job.angles.includes("front") ? ["detail" as const] : []),
  ];
  const change = (body: unknown) =>
    run(async () => onChange(await api<Job>(`jobs/${job.id}`, body)));
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {statusLabels[job.status]}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{job.name}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="size-3 rounded-full border"
                style={{ background: job.hex }}
              />
              {job.color} ·{" "}
              {job.avatarId ? "Avatar selecionado" : "Modelo original"}
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={onClone}>
            Novo ensaio com estas fotos
          </Button>
        </div>
        <p className="mt-4 text-sm" role="status">
          {job.progress}
        </p>
        {working && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}
        {["queued_analysis", "queued_generation"].includes(job.status) && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => change({ action: "cancel" })}
          >
            Cancelar solicitação na fila
          </Button>
        )}
        {job.error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {job.error}
          </p>
        )}
        {!job.analysis && job.status === "failed" && (
          <Button
            className="mt-3"
            variant="outline"
            disabled={busy || job.analysisAttempts >= 3}
            onClick={() => change({ action: "retry_analysis" })}
          >
            Repetir análise (utiliza créditos)
          </Button>
        )}
        {job.analysis && (
          <div className="mt-5 space-y-3 border-t pt-4">
            <h3 className="font-medium">O que identificamos na peça</h3>
            <p className="text-sm text-muted-foreground">
              {job.analysis.summary}
            </p>
            <details className="rounded-xl bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Ver ficha completa e pontos de atenção
              </summary>
              <dl className="mt-3 space-y-3">
                {(
                  [
                    ["Peça", job.analysis.garment],
                    ["Modelagem", job.analysis.silhouette],
                    ["Construção", job.analysis.construction.join("; ")],
                    ["Textura aparente", job.analysis.texture],
                    ["Preservar", job.analysis.fixedDetails.join("; ")],
                    ["Alterar a cor", job.analysis.recolorRegions.join("; ")],
                    ["Não visível / incerto", job.analysis.unknowns.join("; ")],
                    ["Atenção", job.analysis.warnings.join("; ")],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium">{label}</dt>
                    <dd className="text-muted-foreground">
                      {value || "Nenhum ponto registrado."}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
            {missing.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Referências limitadas para:{" "}
                {missing.map((a) => shotLabels[a]).join(", ")}. Você pode gerar mesmo assim. A IA precisará estimar os detalhes não visíveis, que podem ficar diferentes do produto real. Mais fotos ajudam a reduzir esse risco. Confira esses ângulos antes de publicar.
              </p>
            )}
            {!job.references.some((r) => r.role === "color") && <p className="text-sm text-amber-700">Adicione fotos da cor real na etapa 3 usando “Novo ensaio com estas fotos”. O HEX da variante não é usado na geração.</p>}
            {job.status === "ready" && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {job.angles.length} fotos
                    {job.angles.includes("front")
                      ? " + recorte de detalhe"
                      : ""}
                  </p>
                  <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                    Geração e conferência utilizam créditos da OpenAI. O custo
                    varia com as referências e o modelo. Nenhuma imagem será
                    publicada automaticamente.
                  </p>
                </div>
                <Button
                  disabled={blocked || !job.references.some((r) => r.role === "color")}
                  onClick={() => change({ action: "generate" })}
                >
                  Gerar fotos
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {(job.outputs.length > 0 || job.attempts > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {orderedShots.map((shot) => {
            const output = job.outputs.find((o) => o.shot === shot);
            const reference = job.references.find(
              (r) => r.role === (shot === "detail" ? "front" : shot) || (r.role === "color" && r.angle === shot),
            ) || job.references.find((r) => r.role !== "color") || job.references[0];
            return (
              <section
                key={shot}
                className="overflow-hidden rounded-2xl border bg-card"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-medium">{shotLabels[shot]}</h3>
                  {output && (
                    <span
                      className={`text-xs ${output.review.verdict === "reject" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {output.publishedUrl
                        ? "No produto"
                        : output.approved
                          ? "Aprovada por você"
                          : output.review.verdict === "reject"
                            ? "Reprovada na conferência"
                            : "Aguardando sua revisão"}
                    </span>
                  )}
                </div>
                <div
                  className={`grid bg-muted/30 ${reference ? "grid-cols-2" : ""}`}
                >
                  {reference && (
                    <div className="relative h-80 border-r">
                      <Photo
                        id={reference.assetId}
                        alt={`Referência disponível: ${shotLabels[reference.role === "color" ? "front" : reference.role]}`}
                      />
                      <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs">
                        {reference.role === (shot === "detail" ? "front" : shot) ? "Original" : "Referência disponível"}
                      </span>
                    </div>
                  )}
                  {output ? (
                    <a
                      href={media(output.assetId)}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-80"
                      aria-label={`Ampliar ${shotLabels[shot]}`}
                    >
                      <Photo
                        id={output.assetId}
                        alt={`${job.name}, ${job.color}, ${shotLabels[shot]}`}
                      />
                    </a>
                  ) : (
                    <div className="flex h-80 flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-8" />
                      <p className="text-sm">
                        {working
                          ? "Aguardando processamento"
                          : "Foto ainda não disponível"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  {output && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`${media(output.assetId)}?download=1`}>
                            <Download className="mr-1 size-3" />
                            Baixar
                          </a>
                        </Button>
                        {shot === "front" &&
                          output.review.verdict !== "reject" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={blocked}
                              onClick={() => setCropOpen(!cropOpen)}
                            >
                              <Crop className="mr-1 size-3" />
                              Recortar detalhe
                            </Button>
                          )}
                      </div>
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          Conferência automática
                          {output.review.issues.length
                            ? ` · ${output.review.issues.length} observações`
                            : ""}
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {[
                            ...output.review.issues,
                            output.review.clothing,
                            output.review.color,
                            output.review.skin,
                          ]
                            .filter(Boolean)
                            .map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                        </ul>
                      </details>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 accent-primary"
                          checked={output.approved}
                          disabled={
                            blocked ||
                            Boolean(output.publishedUrl) ||
                            output.review.verdict === "reject"
                          }
                          onChange={(e) =>
                            change({
                              action: "approve",
                              shot,
                              approved: e.target.checked,
                            })
                          }
                        />
                        Conferi a roupa, a cor e a naturalidade desta foto.
                      </label>
                    </>
                  )}
                  {shot !== "detail" &&
                    !output?.publishedUrl &&
                    job.attempts > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={
                          blocked ||
                          !job.angles.includes(shot) ||
                          !job.references.some((r) => r.role === "color") ||
                          job.attempts >= 9
                        }
                        onClick={() => change({ action: "retry", shot })}
                      >
                        <RotateCcw className="mr-1 size-3" />
                        {output ? "Refazer foto" : "Gerar esta foto"} · utiliza
                        créditos
                      </Button>
                    )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {cropOpen && job.outputs.find((o) => o.shot === "front") && (
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-medium">Enquadrar detalhe da roupa</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="relative mx-auto aspect-[2/3] h-72 bg-muted">
              <Photo
                id={job.outputs.find((o) => o.shot === "front")!.assetId}
                alt="Selecionar região do detalhe"
              />
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
              />
            </div>
            <div className="space-y-4">
              {(["x", "y", "width"] as const).map((key) => (
                <label key={key} className="block text-sm">
                  {
                    {
                      x: "Posição horizontal",
                      y: "Posição vertical",
                      width: "Largura",
                      height: "Altura",
                    }[key]
                  }
                  <input
                    className="mt-2 block w-full"
                    type="range"
                    min={key === "width" ? 0.1 : 0}
                    max={
                      key === "x"
                        ? 1 - crop.width
                        : key === "y"
                          ? 1 - crop.height
                          : key === "width"
                            ? Math.min(1 - crop.x, 1 - crop.y)
                            : 1 - crop.y
                    }
                    step="0.01"
                    value={crop[key]}
                    onChange={(e) =>
                      setCrop({ ...crop, [key]: Number(e.target.value), ...(key === "width" ? {height: Number(e.target.value)} : {}) })
                    }
                  />
                </label>
              ))}
              <Button
                disabled={blocked}
                onClick={() =>
                  run(async () => {
                    onChange(await api<Job>(`jobs/${job.id}/crop`, crop));
                    setCropOpen(false);
                  })
                }
              >
                Salvar detalhe vertical 2:3
              </Button>
            </div>
          </div>
        </section>
      )}
      {job.outputs.length > 0 && (
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Check className="size-4" />
            {approved.length} fotos aprovadas
          </h3>
          <p className="text-sm text-muted-foreground">
            Todas as fotos já estão salvas na biblioteca do Estúdio. Você pode
            baixar cada uma acima ou todas juntas em um arquivo ZIP.
          </p>
          {job.productId && job.groupKey ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishConfirmed}
                  onChange={(e) => setPublishConfirmed(e.target.checked)}
                />
                Confirmo o destino das fotos: “{job.groupLabel || job.color}” no produto selecionado.
              </label>
              <div className="flex flex-wrap gap-2">
              <Button
                disabled={blocked || !publishConfirmed || !approved.length}
                onClick={() =>
                  run(async () =>
                    onChange(
                      await api<Job>(`jobs/${job.id}/publish`, {
                        productId: job.productId,
                        groupKey: job.groupKey,
                        shots: approved.map((o) => o.shot),
                      }),
                    ),
                  )
                }
              >
                Adicionar aprovadas ao produto
              </Button>
              <Button variant="outline" asChild><a href={`/api/ai-studio/jobs/${job.id}/download`}><Download className="mr-2 size-4" />Baixar Imagens</a></Button>
              </div>
            </>
          ) : (
            <p className="text-sm">
              Para aplicar ao catálogo, crie o ensaio a partir de um produto e
              selecione o grupo de destino.
              <a className="mt-3 flex items-center gap-2 underline" href={`/api/ai-studio/jobs/${job.id}/download`}><Download className="size-4" />Baixar Imagens</a>
            </p>
          )}
        </section>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Informações do ensaio</summary>
        <p className="mt-2">
          Análise: {job.analysisModel} · Geração: {job.imageModel} ·{" "}
          {job.calls.length} chamadas concluídas · {job.attempts} fotos
          solicitadas · {job.promptVersion}
        </p>
      </details>
    </div>
  );
}
