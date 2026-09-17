import { z } from "zod";
import type { Job } from "./types";

export const ANALYSIS_OUTPUT_LIMIT = 6000;
type Call = Job["calls"][number];
type AnalysisResponse = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
};
export class AnalysisResponseError extends Error {
  constructor(message: string, readonly call: Call) {
    super(message);
    this.name = "AnalysisResponseError";
  }
}

export function parseAnalysisResponse<T extends z.ZodType>(data: AnalysisResponse, schema: T, call: Call): z.infer<T> {
  const fail = (reason: string, message: string): never => {
    throw new AnalysisResponseError(message, { ...call, outcome: "failed", failureReason: reason,
      responseStatus: ["completed", "incomplete", "failed", "cancelled", "queued", "in_progress"].includes(data.status || "") ? data.status : "unknown",
      maxOutputTokens: ANALYSIS_OUTPUT_LIMIT });
  };
  if (data.status === "incomplete") {
    if (data.incomplete_details?.reason === "max_output_tokens")
      fail("max_output_tokens", "A análise atingiu o limite de resposta antes de concluir. Isso não indica um problema nas fotos. O administrador pode revisar o limite de processamento; repetir a análise pode consumir créditos novamente.");
    if (data.incomplete_details?.reason === "content_filter")
      fail("content_filter", "A análise foi interrompida pelo filtro de conteúdo da IA. Revise as referências antes de solicitar outra análise.");
    fail("incomplete_unknown", "A IA interrompeu a análise sem informar um motivo específico. As referências foram mantidas; repetir a análise pode consumir créditos novamente.");
  }
  if (data.status && data.status !== "completed")
    fail("provider_not_completed", "A IA não concluiu o processamento da análise. As referências foram mantidas. Tente novamente mais tarde.");
  const parts = (data.output || []).flatMap(item => item.content || []);
  if (parts.some(part => part.type === "refusal"))
    fail("refusal", "A IA recusou analisar essas referências. Revise as imagens antes de solicitar outra análise.");
  const text = parts.filter(part => part.type === "output_text").map(part => part.text || "").join("");
  if (!text.trim()) fail("empty_output", "A IA respondeu sem uma análise utilizável. Isso não comprova um problema nas fotos. As referências foram mantidas.");
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { fail("invalid_json", "A IA devolveu uma análise em formato inválido. As referências foram mantidas; nenhuma foto foi gerada."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) fail("invalid_schema", "A análise retornada pela IA não contém todos os dados necessários. As referências foram mantidas; nenhuma foto foi gerada.");
  return parsed.data as z.infer<T>;
}
