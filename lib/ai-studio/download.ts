import { zipSync } from "fflate";
import { orderedOutputs } from "./service";
import { readAsset } from "./storage";
import { shotLabels, type Job } from "./types";

export async function downloadJobImages(job: Job) {
  const prefix = `${job.name}-${job.color}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 100) || "ensaio";
  const files: Record<string, Uint8Array> = {};
  for (const [index, output] of orderedOutputs(job).entries())
    files[`${prefix}-${index + 1}-${shotLabels[output.shot]}.jpg`] = new Uint8Array(await readAsset(job.storeId, output.assetId));
  // JPEGs are already compressed; store them without additional CPU-heavy compression.
  return zipSync(files, { level: 0 });
}
