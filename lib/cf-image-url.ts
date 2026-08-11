/**
 * Gera URL de imagem via Cloudflare Image Resizing (cdn-cgi/image).
 *
 * Requer que "Image Resizing" esteja habilitado na zona do Cloudflare
 * (Mídia → Imagens → Transformações no painel).
 *
 * Configuração: adicione ao .env.local (ou variáveis de ambiente do deployment):
 *   NEXT_PUBLIC_CF_IMAGE_TRANSFORM_BASE=https://storage.upzero.com.br
 *
 * Enquanto a variável não estiver definida, as URLs originais são retornadas sem
 * alteração (fallback seguro).
 */

const CF_BASE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_CF_IMAGE_TRANSFORM_BASE) ||
  "";

export interface CfImageOptions {
  width?: number;
  height?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  quality?: number;
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  /** Device pixel ratio (1 | 2 | 3). Use 2 para telas Retina. */
  dpr?: 1 | 2 | 3;
}

/**
 * Retorna uma URL transformada pelo Cloudflare se CF_BASE estiver configurado
 * e a URL de origem pertencer a esse domínio.
 * Caso contrário devolve a URL original sem modificação.
 */
export function cfImageUrl(
  src: string,
  options: CfImageOptions = {}
): string {
  if (!src || !CF_BASE) return src;

  // Só transforma URLs que partem do mesmo domínio de armazenamento.
  const base = CF_BASE.replace(/\/+$/, "");
  if (!src.startsWith(base + "/")) return src;

  const { width, height, fit = "cover", quality = 85, format = "auto", dpr } =
    options;

  const params: string[] = [];
  if (width) params.push(`width=${width}`);
  if (height) params.push(`height=${height}`);
  params.push(`fit=${fit}`);
  params.push(`quality=${quality}`);
  params.push(`format=${format}`);
  if (dpr && dpr > 1) params.push(`dpr=${dpr}`);

  // Extrai o path relativo após o domínio base (ex.: /uploads/uuid.jpg)
  const relativePath = src.slice(base.length);

  return `${base}/cdn-cgi/image/${params.join(",")}${relativePath}`;
}
