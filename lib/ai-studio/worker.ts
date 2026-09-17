import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { analyze, generate } from "./provider";
import { portraitDetailPixels, verifiedAngles, type Job, type Output } from "./types";
import {
  atomicJson,
  dataRoot,
  listJobs,
  readAsset,
  readJob,
  saveAsset,
  saveJob,
  withStoreLock,
} from "./storage";

export function plannedDetailCrop(job: Job) {
  // Approximate region within the standard full-body frame; adjustable without API usage.
  const region = job.analysis?.preparation?.detailRegion || "upper";
  return { x: 0.25, y: region === "lower" ? 0.5 : region === "waist" ? 0.34 : 0.2, width: 0.5, height: 0.5 };
}

export async function cropDetail(
  job: Job,
  source: Output,
  crop = source.review.crop,
) {
  if (!crop) throw new Error("Não foi possível localizar um detalhe da roupa.");
  const bytes = await readAsset(job.storeId, source.assetId);
  const meta = await sharp(bytes).metadata();
  const cropped = await sharp(bytes)
    .extract(portraitDetailPixels(crop, meta.width!, meta.height!))
    .jpeg({ quality: 95 })
    .toBuffer();
  return {
    shot: "detail",
    assetId: await saveAsset(job.storeId, cropped, true),
    approved: false,
    parentAssetId: source.assetId,
    reviewMode: source.reviewMode,
    guidanceRevision: source.guidanceRevision,
    review: {
      ...source.review,
      crop: null,
      issues: [
        ...source.review.issues,
        "Recorte derivado da frente. Confira enquadramento e nitidez.",
      ],
    },
  } satisfies Output;
}
async function update(job: Job) {
  await withStoreLock(job.storeId, () => saveJob(job));
}
export async function processJob(job: Job) {
  try {
    if (job.status === "analyzing") {
      const result = await analyze(job);
      job.analysis = result.value;
      job.calls.push(result.call);
      job.status = "ready";
      job.progress = "Análise concluída. Revise antes de gerar.";
    } else {
      for (const angle of job.pendingAngles) {
        job.progress = `Gerando ${angle === "front" ? "frente" : angle === "back" ? "costas" : "lateral"}…`;
        await update(job);
        const result = await generate(job, angle);
        job.calls.push(result.call);
        const assetId = await saveAsset(job.storeId, result.bytes, true);
        // Persist every paid output immediately; no automatic API inspection follows generation.
        const output: Output = {
          shot: angle,
          assetId,
          approved: false,
          reviewMode: "manual",
          guidanceRevision: job.guidanceRevision || 0,
          review: {
            verdict: "review",
            issues: verifiedAngles(job).includes(angle) ? [] : ["Ângulo estimado sem referência verificada; a análise prévia orientou os detalhes não visíveis."],
            clothing: "",
            color: "",
            skin: "",
            crop: angle === "front" ? plannedDetailCrop(job) : null,
          },
        };
        job.outputs = job.outputs.filter(
          (o) =>
            o.shot !== angle && !(angle === "front" && o.shot === "detail"),
        );
        job.outputs.push(output);
        job.progress = "Foto gerada e disponível para baixar.";
        await update(job);
        if (angle === "front") {
          try {
            job.outputs.push(await cropDetail(job, output));
          } catch {
            output.review.issues.push(
              "Ajuste o recorte do detalhe manualmente.",
            );
          }
        }
        await update(job);
      }
      job.pendingAngles = [];
      job.status = "review";
      job.progress =
        "Imagens prontas para baixar. A análise foi feita antes da geração; confirme as fotos apenas se quiser publicá-las no produto.";
    }
    delete job.error;
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error && !/fetch|abort|timeout/i.test(error.message)
        ? error.message
        : "A chamada foi interrompida. Pode ter havido cobrança; confira os resultados antes de tentar novamente.";
    job.progress =
      "Processamento interrompido; os resultados já recebidos foram preservados.";
  }
  await update(job);
}

export async function tick() {
  const root = dataRoot();
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const stores = (await fs.readdir(root)).filter((n) => /^[1-9]\d*$/.test(n));
  for (const store of stores) {
    const storeId = Number(store);
    const jobs = (await listJobs(storeId)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    for (const candidate of jobs) {
      if (
        ["analyzing", "generating"].includes(candidate.status) &&
        Date.now() - Date.parse(candidate.updatedAt) > 20 * 60_000
      ) {
        await withStoreLock(storeId, async () => {
          const current = await readJob(storeId, candidate.id);
          if (
            Date.now() - Date.parse(current.updatedAt) > 20 * 60_000 &&
            ["analyzing", "generating"].includes(current.status)
          ) {
            current.status = "failed";
            current.error =
              "O worker foi interrompido. Confira os resultados antes de repetir; a solicitação anterior pode ter sido cobrada.";
            await saveJob(current);
          }
        });
      }
      if (!["queued_analysis", "queued_generation"].includes(candidate.status))
        continue;
      const claimed = await withStoreLock(storeId, async () => {
        const job = await readJob(storeId, candidate.id);
        if (!["queued_analysis", "queued_generation"].includes(job.status))
          return null;
        job.status =
          job.status === "queued_analysis" ? "analyzing" : "generating";
        await saveJob(job);
        return job;
      });
      if (claimed) {
        await processJob(claimed);
        return true;
      }
    }
  }
  return false;
}
export async function heartbeat() {
  await atomicJson(path.join(dataRoot(), "heartbeat"), {
    at: new Date().toISOString(),
  });
}
