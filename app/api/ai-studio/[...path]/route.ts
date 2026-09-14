import { studioRequiresSetup } from "@/lib/ai-studio/runtime";
import { downloadJobImages } from "@/lib/ai-studio/download";
import { normalizeColors } from "@/lib/ai-studio/catalog";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  requireAdmin,
  backend,
  getProduct,
  StudioError,
} from "@/lib/ai-studio/server";
import { createJob, mutateJob, publish } from "@/lib/ai-studio/service";
import {
  listJobs,
  listAvatars,
  saveAvatar,
  readAsset,
  saveAsset,
  readJob,
  saveJob,
  withStoreLock,
  workerOnline,
} from "@/lib/ai-studio/storage";
import {
  cropSchema,
  idSchema,
  isBusy,
  referenceSchema,
} from "@/lib/ai-studio/types";
import { downloadReference } from "@/lib/ai-studio/media";
import { cropDetail } from "@/lib/ai-studio/worker";

export const maxDuration = 120;
type Context = { params: Promise<{ path: string[] }> };
async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new StudioError(413, "Arquivo muito grande.");
  const reader = request.body?.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  if (!reader) throw new StudioError(400, "Solicitação vazia.");
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new StudioError(413, "Arquivo muito grande.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
async function handle(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(request);
    if (studioRequiresSetup()) throw new StudioError(503, "O Estúdio IA está em preparação. Aguarde a liberação do recurso.");
    const { path } = await context.params,
      [resource, id, action] = path;
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (resource === "status")
        return Response.json({
          configured: Boolean(process.env.OPENAI_API_KEY),
          workerOnline: await workerOnline(),
          dailyImageLimit: Number(process.env.AI_STUDIO_DAILY_IMAGES || 24),
        });
      if (resource === "jobs" && id && action === "download") {
        const job = await readJob(admin.storeId, id);
        if (!job.outputs.length) throw new StudioError(409, "Este ensaio ainda não tem imagens para baixar.");
        return new Response(new Uint8Array(await downloadJobImages(job)), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="estudio-${idSchema.parse(id)}.zip"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (resource === "jobs")
        return Response.json(
          id
            ? await readJob(admin.storeId, id)
            : (await listJobs(admin.storeId))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 100),
        );
      if (resource === "avatars")
        return Response.json(await listAvatars(admin.storeId));
      if (resource === "product" && id)
        return Response.json(await getProduct(admin, Number(id)));
      if (resource === "colors") {
        const response = await backend(admin, `/product-attributes/store/${admin.storeId}/with-values`);
        if (!response.ok) throw new StudioError(502, "Não foi possível carregar as cores cadastradas.");
        return Response.json(normalizeColors(await response.json()));
      }
      if (resource === "catalog") {
        const query = new URLSearchParams({
          store_id: String(admin.storeId),
          page: "1",
          limit: "20",
          search: (url.searchParams.get("q") || "").slice(0, 100),
        });
        const result = await backend(
          admin,
          `/internal/admin/products-paginated?${query}`,
        );
        if (!result.ok)
          throw new StudioError(502, "Não foi possível buscar os produtos.");
        const payload = await result.json();
        return Response.json(
          (Array.isArray(payload.items) ? payload.items : []).map(
            (p: { id: number; name: string; cover_image_url?: string }) => ({
              id: Number(p.id),
              name: p.name,
              image: p.cover_image_url,
            }),
          ),
        );
      }
      if (resource === "media" && id) {
        const bytes = await readAsset(admin.storeId, id);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            ...(url.searchParams.has("download")
              ? {
                  "Content-Disposition": `attachment; filename="estudio-${idSchema.parse(id)}.jpg"`,
                }
              : {}),
          },
        });
      }
    } else if (request.method === "POST") {
      if (
        resource === "references" &&
        request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const bytes = await limitedBody(request, 9 * 1024 * 1024);
        const form = await new Response(new Uint8Array(bytes), {
          headers: { "Content-Type": request.headers.get("content-type")! },
        }).formData();
        const file = form.get("file");
        if (!(file instanceof File))
          throw new StudioError(400, "Selecione uma imagem.");
        return Response.json({
          assetId: await saveAsset(
            admin.storeId,
            Buffer.from(await file.arrayBuffer()),
          ),
        });
      }
      const body: unknown = JSON.parse(
        (await limitedBody(request, 64 * 1024)).toString("utf8"),
      );
      if (resource === "references") {
        const input = z
          .object({ productId: z.number().int().positive(), url: z.url() })
          .parse(body);
        const product = await getProduct(admin, input.productId);
        if (!product.groups.some((group) => group.images.includes(input.url)))
          throw new StudioError(
            403,
            "Esta imagem não pertence ao produto selecionado.",
          );
        return Response.json({
          assetId: await saveAsset(
            admin.storeId,
            await downloadReference(input.url),
          ),
        });
      }
      if (resource === "avatars") {
        const input = z
          .object({
            name: z.string().trim().min(2).max(80),
            references: z.array(referenceSchema).min(1).max(3),
            rightsConfirmed: z.literal(true),
          })
          .parse(body);
        if (
          !input.references.some((r) => r.role === "front") ||
          input.references.some(
            (r) => !["front", "back", "side"].includes(r.role),
          )
        )
          throw new StudioError(
            400,
            "Inclua ao menos uma referência de frente do avatar.",
          );
        for (const ref of input.references)
          await readAsset(admin.storeId, ref.assetId);
        const avatar = {
          id: randomUUID(),
          name: input.name,
          references: input.references,
          createdAt: new Date().toISOString(),
          createdBy: admin.userId,
        };
        await saveAvatar(admin.storeId, avatar);
        return Response.json(avatar);
      }
      if (resource === "jobs" && !id)
        return Response.json(await createJob(admin, body));
      if (resource === "jobs" && id && action === "publish")
        return Response.json(await publish(admin, id, body));
      if (resource === "jobs" && id && action === "crop") {
        const crop = cropSchema.parse(body);
        const job = await withStoreLock(admin.storeId, async () => {
          const current = await readJob(admin.storeId, id);
          if (isBusy(current))
            throw new StudioError(409, "Aguarde o processamento.");
          const front = current.outputs.find((o) => o.shot === "front");
          if (
            !front ||
            front.review.verdict === "reject" ||
            current.outputs.some((o) => o.shot === "detail" && o.publishedUrl)
          )
            throw new StudioError(409, "Não é possível recortar esta foto.");
          const output = await cropDetail(current, front, crop);
          current.outputs = [
            ...current.outputs.filter((o) => o.shot !== "detail"),
            output,
          ];
          await saveJob(current);
          return current;
        });
        return Response.json(job);
      }
      if (resource === "jobs" && id && !action)
        return Response.json(await mutateJob(admin, id, body));
    }
    return Response.json({ error: "Recurso não encontrado." }, { status: 404 });
  } catch (error) {
    const status =
      error instanceof StudioError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : (error as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : 500;
    const message =
      error instanceof StudioError
        ? error.message
        : error instanceof z.ZodError
          ? "Confira os campos, as referências e os ângulos selecionados."
          : status === 404
            ? "Arquivo ou ensaio não encontrado nesta loja."
            : error instanceof Error &&
                !/fetch|ENOTFOUND|ECONN|EACCES|ENOENT/.test(error.message)
              ? error.message
              : "Não foi possível concluir. Tente novamente.";
    return Response.json({ error: message }, { status });
  }
}
export const GET = handle;
export const POST = handle;
