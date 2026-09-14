import { z } from "zod";

export const angleSchema = z.enum(["front", "back", "side"]);
export type Angle = z.infer<typeof angleSchema>;
export type Shot = Angle | "detail";
export const shotLabels: Record<Shot, string> = {
  front: "Frente",
  back: "Costas",
  side: "Lateral",
  detail: "Detalhe",
};
export const idSchema = z.uuid();
export const referenceSchema = z.object({
  assetId: idSchema,
  role: z.enum(["front", "back", "side", "detail", "color"]),
  angle: z.enum(["front", "back", "side", "detail"]).optional(),
});
export type Reference = z.infer<typeof referenceSchema>;
export const createJobSchema = z.object({
  requestId: idSchema,
  name: z.string().trim().min(2).max(120),
  productId: z.number().int().positive().nullable(),
  groupKey: z.string().max(250).nullable(),
  color: z.string().trim().min(2).max(100),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  references: z.array(referenceSchema).min(1).max(12).refine((refs) => refs.filter((r) => r.role === "color").length <= 4 && refs.filter((r) => r.role !== "color").length <= 8),
  avatarId: idSchema.nullable(),
  angles: z
    .array(angleSchema)
    .min(1)
    .max(3)
    .refine((v) => new Set(v).size === v.length),
  imageModel: z.enum(["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"]),
});
export type JobInput = z.infer<typeof createJobSchema>;
export const analysisSchema = z.object({
  summary: z.string(),
  garment: z.string(),
  silhouette: z.string(),
  construction: z.array(z.string()),
  texture: z.string(),
  fixedDetails: z.array(z.string()),
  recolorRegions: z.array(z.string()),
  unknowns: z.array(z.string()),
  supportedAngles: z.array(angleSchema),
  warnings: z.array(z.string()),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const cropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.1).max(1),
  height: z.number().min(0.1).max(1),
});
export const reviewSchema = z.object({
  verdict: z.enum(["pass", "review", "reject"]),
  issues: z.array(z.string()),
  clothing: z.string(),
  color: z.string(),
  skin: z.string(),
  crop: cropSchema.nullable(),
});
export type Review = z.infer<typeof reviewSchema>;
export type Output = {
  shot: Shot;
  assetId: string;
  review: Review;
  approved: boolean;
  approvedBy?: string;
  publishedUrl?: string;
  uploadedUrl?: string;
  parentAssetId?: string;
};
export type Job = JobInput & {
  groupLabel?: string;
  id: string;
  storeId: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status:
    | "queued_analysis"
    | "analyzing"
    | "ready"
    | "queued_generation"
    | "generating"
    | "review"
    | "failed"
    | "cancelled";
  analysis?: Analysis;
  outputs: Output[];
  error?: string;
  progress: string;
  pendingAngles: Angle[];
  attempts: number;
  analysisAttempts: number;
  calls: Array<{ model: string; usage: unknown; requestId: string | null }>;
  promptVersion: string;
  analysisModel: string;
};
export type Avatar = {
  id: string;
  name: string;
  references: Reference[];
  createdAt: string;
  createdBy: string;
};
export type ProductGroup = {
  key: string;
  label: string;
  variantIds: number[];
  images: string[];
  displayOrders: number[];
  attributeValueIds?: number[];
};
export type StudioProduct = {
  id: number;
  name: string;
  groupingType: string;
  groups: ProductGroup[];
};
export const statusLabels: Record<Job["status"], string> = {
  queued_analysis: "Aguardando análise",
  analyzing: "Analisando a peça",
  ready: "Pronto para gerar",
  queued_generation: "Na fila de geração",
  generating: "Gerando imagens",
  review: "Revisar imagens",
  failed: "Precisa de atenção",
  cancelled: "Cancelado",
};
export function isBusy(job: Job) {
  return [
    "queued_analysis",
    "analyzing",
    "queued_generation",
    "generating",
  ].includes(job.status);
}
export function verifiedAngles(job: Job): Angle[] {
  return job.angles.filter(
    (angle) =>
      job.references.some((r) => r.role === angle || (r.role === "color" && r.angle === angle && !job.references.some((ref) => ref.role !== "color"))) &&
      job.analysis?.supportedAngles.includes(angle),
  );
}
export function cropPixels(
  crop: z.infer<typeof cropSchema>,
  width: number,
  height: number,
) {
  cropSchema.parse(crop);
  if (crop.x + crop.width > 1.001 || crop.y + crop.height > 1.001)
    throw new Error("Recorte fora da imagem.");
  const left = Math.round(crop.x * (width - 1)),
    top = Math.round(crop.y * (height - 1));
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round(crop.width * width))),
    height: Math.max(
      1,
      Math.min(height - top, Math.round(crop.height * height)),
    ),
  };
}

export type StudioColor = { id: number; name: string; hex: string | null };

export function generationAngles(job: Job): Angle[] {
  return job.analysis && (job.references.some((r) => r.role !== "color") || (job.avatarId && job.references.some((r) => r.role === "color"))) ? job.angles : [];
}

// Expand around the chosen detail, keeping exact 2:3 pixels within the source.
export function portraitDetailPixels(crop: z.infer<typeof cropSchema>, width: number, height: number) {
  const selected = cropPixels(crop, width, height);
  const unit = Math.max(1, Math.min(Math.ceil(Math.max(selected.width / 2, selected.height / 3)), Math.floor(width / 2), Math.floor(height / 3)));
  const w = unit * 2, h = unit * 3;
  return { left: Math.max(0, Math.min(width - w, Math.round(selected.left + selected.width / 2 - w / 2))), top: Math.max(0, Math.min(height - h, Math.round(selected.top + selected.height / 2 - h / 2))), width: w, height: h };
}
