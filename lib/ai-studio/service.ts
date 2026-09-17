import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  createJobSchema,
  generationAngles,
  isBusy,
  angleSchema,
  garmentGuidanceSchema,
  IMAGE_MODEL,
  newGenerationProgress,
  type Job,
  type Shot,
} from "./types";
import {
  atomicJson,
  readJson,
  storeDir,
  listJobs,
  readJob,
  saveJob,
  readAsset,
  listAvatars,
  workerOnline,
  withStoreLock,
} from "./storage";
import { PROMPT_VERSION, requireColorPhotos } from "./provider";
import { backend, getProduct, StudioError, type Admin } from "./server";
import { reservePoses } from "./poses";

// Reservations count attempts, including uncertain provider failures. Never silently spend on retries.
export async function reserve(
  storeId: number,
  images: number,
  analyses: number,
) {
  const file = path.join(storeDir(storeId), "usage.json"),
    day = new Date().toISOString().slice(0, 10);
  let usage = await readJson<{ day: string; images: number; analyses: number }>(
    file,
  ).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return { day, images: 0, analyses: 0 };
    throw e;
  });
  if (usage.day !== day) usage = { day, images: 0, analyses: 0 };
  const imageLimit = Number(process.env.AI_STUDIO_DAILY_IMAGES || 24),
    analysisLimit = Number(process.env.AI_STUDIO_DAILY_ANALYSES || 40);
  if (
    !Number.isFinite(imageLimit) ||
    !Number.isFinite(analysisLimit) ||
    usage.images + images > imageLimit ||
    usage.analyses + analyses > analysisLimit
  )
    throw new StudioError(
      429,
      "Limite diário do Estúdio atingido. Tente novamente amanhã.",
    );
  await atomicJson(file, {
    day,
    images: usage.images + images,
    analyses: usage.analyses + analyses,
  });
}
export async function assertWorker() {
  if (!process.env.OPENAI_API_KEY)
    throw new StudioError(503, "A chave OpenAI não está configurada.");
  if (!(await workerOnline()))
    throw new StudioError(
      503,
      "O processamento do Estúdio está offline. O administrador precisa iniciar o worker.",
    );
}
export async function createJob(admin: Admin, input: unknown) {
  const data = createJobSchema.parse(input);
  requireColorPhotos(data.references);
  if (!data.references.some((r) => r.role !== "color") && !data.avatarId)
    throw new StudioError(400, "Selecione um avatar para gerar usando apenas as fotos da etapa 3.");
  return withStoreLock(admin.storeId, async () => {
    const jobs = await listJobs(admin.storeId);
    const existing = jobs.find((j) => j.requestId === data.requestId);
    if (existing) {
      if (
        JSON.stringify(createJobSchema.parse(existing)) !== JSON.stringify(data)
      )
        throw new StudioError(
          409,
          "A solicitação já existe com outras referências. Inicie um novo ensaio.",
        );
      return existing;
    }
    if (jobs.filter(isBusy).length >= 3)
      throw new StudioError(
        429,
        "Aguarde os trabalhos em andamento desta loja.",
      );
    await assertWorker();
    for (const ref of data.references)
      await readAsset(admin.storeId, ref.assetId);
    if (
      data.avatarId &&
      !(await listAvatars(admin.storeId)).some((a) => a.id === data.avatarId)
    )
      throw new StudioError(400, "Avatar inválido.");
    let groupLabel: string | undefined;
    if (data.productId) {
      const product = await getProduct(admin, data.productId);
      if (data.groupKey && !product.groups.some((g) => g.key === data.groupKey))
        throw new StudioError(400, "Grupo de imagens não encontrado.");
      groupLabel = product.groups.find((g) => g.key === data.groupKey)?.label;
    }
    await reserve(admin.storeId, 0, 1);
    const now = new Date().toISOString();
    const job: Job = {
      ...data,
      groupLabel,
      id: randomUUID(),
      storeId: admin.storeId,
      createdBy: admin.userId,
      createdAt: now,
      updatedAt: now,
      status: "queued_analysis",
      outputs: [],
      pendingAngles: [],
      attempts: 0,
      analysisAttempts: 1,
      calls: [],
      progress: "Referências salvas. Aguardando análise.",
      promptVersion: PROMPT_VERSION,
      analysisModel: process.env.AI_STUDIO_ANALYSIS_MODEL || "gpt-6-astra",
    };
    await saveJob(job);
    return job;
  });
}
export async function mutateJob(admin: Admin, id: string, body: unknown) {
  const action = z
    .object({
      action: z.enum([
        "generate",
        "retry_analysis",
        "retry",
        "approve",
        "cancel",
        "update_guidance",
      ]),
      shot: z.enum(["front", "back", "side", "detail"]).optional(),
      approved: z.boolean().optional(),
      guidance: garmentGuidanceSchema.optional(),
    })
    .parse(body);
  return withStoreLock(admin.storeId, async () => {
    const job = await readJob(admin.storeId, id);
    if (action.action === "cancel") {
      if (!["queued_analysis", "queued_generation"].includes(job.status))
        throw new StudioError(
          409,
          "Somente trabalhos na fila podem ser cancelados.",
        );
      job.status = "cancelled";
      job.pendingAngles = [];
      job.progress = "Cancelado antes do processamento.";
    } else {
      if (isBusy(job))
        throw new StudioError(409, "Aguarde o processamento atual.");
      if (action.action === "update_guidance") {
        if (!job.analysis) throw new StudioError(409, "Aguarde a análise da peça antes de corrigir.");
        const guidance = garmentGuidanceSchema.parse(action.guidance);
        if (JSON.stringify(job.garmentGuidance) !== JSON.stringify(guidance)) {
          job.garmentGuidance = guidance;
          job.guidanceRevision = (job.guidanceRevision || 0) + 1;
          job.guidanceUpdatedBy = admin.userId;
          job.guidanceUpdatedAt = new Date().toISOString();
        }
      } else if (action.action === "approve") {
        const output = job.outputs.find((o) => o.shot === action.shot);
        if (!output || output.publishedUrl)
          throw new StudioError(409, "Imagem indisponível para revisão.");
        if (output.review.verdict === "reject" && action.approved)
          throw new StudioError(
            409,
            "Imagem reprovada na conferência. Gere outra versão.",
          );
        output.approved = action.approved === true;
        output.approvedBy = admin.userId;
      } else {
        await assertWorker();
        if (action.action === "retry_analysis") {
          if (
            job.analysis ||
            job.analysisAttempts >= 3 ||
            job.status !== "failed"
          )
            throw new StudioError(
              409,
              "Não é possível repetir esta análise. Crie um novo ensaio com as referências corrigidas.",
            );
          await reserve(admin.storeId, 0, 1);
          job.analysisAttempts++;
          job.status = "queued_analysis";
        } else {
          requireColorPhotos(job.references);
          const angles =
            action.action === "retry"
              ? [angleSchema.parse(action.shot)]
              : job.angles;
          if (
            action.action === "generate" &&
            (job.attempts > 0 || job.status !== "ready")
          )
            throw new StudioError(
              409,
              "A geração já foi solicitada. Use refazer para uma foto específica.",
            );
          if (angles.some((a) => !generationAngles(job).includes(a)))
            throw new StudioError(
              400,
              "Analise ao menos uma referência da roupa e escolha um ângulo deste ensaio.",
            );
          if (
            angles.some((a) =>
              job.outputs.some(
                (o) =>
                  (o.shot === a || (a === "front" && o.shot === "detail")) &&
                  o.publishedUrl,
              ),
            )
          )
            throw new StudioError(
              409,
              "Há fotos publicadas deste ângulo. Crie um novo ensaio para preservar o histórico.",
            );
          if (job.attempts + angles.length > 9)
            throw new StudioError(
              429,
              "Limite de tentativas deste ensaio atingido.",
            );
          await reserve(admin.storeId, angles.length, 0);
          if (job.avatarId) job.poseIds = await reservePoses(job, angles);
          job.attempts += angles.length;
          job.pendingAngles = angles;
          job.imageModel = IMAGE_MODEL;
          job.generationProgress = newGenerationProgress(angles);
          job.status = "queued_generation";
        }
        delete job.error;
        job.progress = "Solicitação recebida. Aguardando processamento.";
      }
    }
    await saveJob(job);
    return job;
  });
}
export async function publish(admin: Admin, id: string, body: unknown) {
  const data = z
    .object({
      productId: z.number().int().positive(),
      groupKey: z.string().min(1).max(250),
      shots: z
        .array(z.enum(["front", "back", "side", "detail"]))
        .min(1)
        .max(4),
    })
    .parse(body);
  return withStoreLock(admin.storeId, async () => {
    const job = await readJob(admin.storeId, id);
    if (isBusy(job)) throw new StudioError(409, "Aguarde o processamento.");
    if (
      job.productId &&
      (job.productId !== data.productId ||
        (job.groupKey && job.groupKey !== data.groupKey))
    )
      throw new StudioError(
        409,
        "O destino precisa corresponder ao produto e grupo do ensaio.",
      );
    const product = await getProduct(admin, data.productId);
    if (
      !["product", "attributes", "full_sku"].includes(product.groupingType)
    )
      throw new StudioError(
        409,
        "Não foi possível identificar o agrupamento de imagens deste produto. Confira o cadastro.",
      );
    const group = product.groups.find((g) => g.key === data.groupKey);
    if (!group || (product.groupingType !== "product" && group.variantIds.length === 0))
      throw new StudioError(
        409,
        "O grupo de variantes mudou. Confira o produto.",
      );
    const outputs = (["front", "back", "side", "detail"] as Shot[])
      .filter((shot) => data.shots.includes(shot))
      .map((shot) => job.outputs.find((o) => o.shot === shot));
    if (outputs.some((o) => !o || !o.approved || o.review.verdict === "reject"))
      throw new StudioError(
        400,
        "Aprove cada foto selecionada antes de publicar.",
      );
    // Save uploaded URLs before attaching: retries reconcile with current product images by URL.
    for (const output of outputs) {
      if (!output || output.publishedUrl) continue;
      if (!output.uploadedUrl) {
        const upload = new FormData();
        upload.set(
          "file",
          new Blob(
            [new Uint8Array(await readAsset(admin.storeId, output.assetId))],
            { type: "image/jpeg" },
          ),
          `ai-studio/${admin.storeId}/${job.id}-${output.assetId}.jpg`,
        );
        const response = await backend(admin, "/storage/upload", {
          method: "POST",
          body: upload,
        });
        if (!response.ok)
          throw new StudioError(
            502,
            "Falha ao enviar a foto ao armazenamento do catálogo.",
          );
        const payload = await response.json();
        if (typeof payload.url !== "string" || !/^https:\/\//.test(payload.url))
          throw new StudioError(
            502,
            "O armazenamento não retornou uma URL HTTPS válida.",
          );
        output.uploadedUrl = payload.url;
        await saveJob(job);
      }
    }
    const latestProduct = await getProduct(admin, data.productId);
    if (latestProduct.groupingType !== product.groupingType)
      throw new StudioError(409, "O agrupamento mudou durante a publicação. Confira o produto.");
    const latest = latestProduct.groups.find(
      (g) => g.key === data.groupKey,
    );
    if (!latest)
      throw new StudioError(409, "O grupo foi alterado durante a publicação.");
    const missing = outputs.filter(
      (o) => o && !o.publishedUrl && !latest.images.includes(o.uploadedUrl!),
    );
    if (missing.length) {
      const startOrder =
        Math.max(-1, ...latest.displayOrders, latest.images.length - 1) + 1;
      const response = await backend(
        admin,
        `/products/${data.productId}/images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_key: group.key,
            variant_ids: product.groupingType === "product" ? undefined : latest.variantIds,
            images: missing.map((o, i) => ({
              url: o!.uploadedUrl,
              display_order: startOrder + i,
              is_primary: latest.images.length === 0 && i === 0,
            })),
          }),
        },
      );
      if (!response.ok)
        throw new StudioError(
          502,
          "Não foi possível anexar as fotos. Elas continuam salvas na biblioteca.",
        );
    }
    for (const output of outputs)
      if (output) output.publishedUrl = output.uploadedUrl;
    job.productId = data.productId;
    job.groupKey = data.groupKey;
    job.groupLabel = group.label;
    await saveJob(job);
    return job;
  });
}
export function orderedOutputs(job: Job) {
  return (["front", "back", "side", "detail"] as Shot[]).flatMap((shot) =>
    job.outputs.filter((o) => o.shot === shot),
  );
}
