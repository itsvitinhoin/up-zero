import fs from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { idSchema, type Job, type Avatar } from "./types";

export function dataRoot() {
  if (process.env.NODE_ENV === "production" && !process.env.AI_STUDIO_DATA_DIR)
    throw new Error(
      "Configure AI_STUDIO_DATA_DIR em um volume persistente, compartilhado com o worker.",
    );
  return (
    process.env.AI_STUDIO_DATA_DIR ||
    path.join(process.cwd(), ".data", "ai-studio")
  );
}
export function storeDir(storeId: number) {
  if (!Number.isSafeInteger(storeId) || storeId <= 0)
    throw new Error("Loja inválida.");
  return path.join(dataRoot(), String(storeId));
}
export async function atomicJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await fs.rename(temp, file);
}
export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}
export async function listJson<T>(directory: string): Promise<T[]> {
  const names = await fs
    .readdir(directory)
    .catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return [];
      throw e;
    });
  return Promise.all(
    names
      .filter((n) => n.endsWith(".json"))
      .map((n) => readJson<T>(path.join(directory, n))),
  );
}
export function jobPath(storeId: number, id: string) {
  return path.join(storeDir(storeId), "jobs", `${idSchema.parse(id)}.json`);
}
export const readJob = (storeId: number, id: string) =>
  readJson<Job>(jobPath(storeId, id));
export const listJobs = (storeId: number) =>
  listJson<Job>(path.join(storeDir(storeId), "jobs"));
export async function saveJob(job: Job) {
  job.updatedAt = new Date().toISOString();
  if (!job.completedAt && ["front", "back", "side", "detail"].every(shot => job.outputs.some(output => output.shot === shot))) job.completedAt = job.updatedAt;
  await atomicJson(jobPath(job.storeId, job.id), job);
}
const defaultAvatarId = "1fd64a9d-5bd1-49d0-b512-d21e3382877c";
const defaultAvatarAsset = "3a38085d-6737-442f-92a7-072c7b2e90a1";
export const listAvatars = async (storeId: number): Promise<Avatar[]> => [
  { id: defaultAvatarId, name: "Clara · avatar sintético", references: [{ assetId: defaultAvatarAsset, role: "front" }], createdAt: "2026-09-14T00:00:00.000Z", createdBy: "system" },
  ...await listJson<Avatar>(path.join(storeDir(storeId), "avatars")),
];
export const saveAvatar = (storeId: number, avatar: Avatar) =>
  atomicJson(
    path.join(
      storeDir(storeId),
      "avatars",
      `${idSchema.parse(avatar.id)}.json`,
    ),
    avatar,
  );
export function assetPath(storeId: number, id: string) {
  return path.join(storeDir(storeId), "media", `${idSchema.parse(id)}.jpg`);
}
export const readAsset = (storeId: number, id: string) => {
  storeDir(storeId);
  return fs.readFile(id === defaultAvatarAsset
    ? path.join(process.cwd(), "assets", "ai-studio", "avatar-clara.jpg")
    : assetPath(storeId, id));
};
export async function saveAsset(
  storeId: number,
  bytes: Buffer,
  generated = false,
) {
  if (!bytes.length || bytes.length > (generated ? 30 : 8) * 1024 * 1024)
    throw new Error("Imagem muito grande. Referências: até 8 MB.");
  const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
  const meta = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format || "") ||
    (meta.pages || 1) > 1
  )
    throw new Error("Use JPG, PNG ou WebP estático.");
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 128)
    throw new Error(
      "Imagem muito pequena. Use no mínimo 128 pixels em cada lado.",
    );
  const normalized = await image
    .rotate()
    .resize({
      width: generated ? 2560 : 2000,
      height: generated ? 2560 : 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 95 })
    .toBuffer();
  const id = randomUUID(),
    file = assetPath(storeId, id);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, normalized, { mode: 0o600, flag: "wx" });
  return id;
}

// Short exclusive transactions shared by the web process and worker. Never hold across an AI call.
export async function withStoreLock<T>(
  storeId: number,
  action: () => Promise<T>,
): Promise<T> {
  const dir = storeDir(storeId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, ".lock");
  const ownerName = `${process.pid}-${randomUUID()}.json`;
  for (let i = 0; ; i++) {
    try {
      await fs.mkdir(lock);
      await fs.writeFile(
        path.join(lock, ownerName),
        JSON.stringify({ pid: process.pid, host: hostname() }),
        { mode: 0o600 },
      );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Reap only demonstrably dead owners on this host, never a slow live publisher.
      const owners = await fs.readdir(lock).catch(() => [] as string[]);
      for (const owner of owners) {
        if (!owner.endsWith(".json")) continue;
        try {
          const data = await readJson<{ pid: number; host: string }>(
            path.join(lock, owner),
          );
          if (
            data.host !== hostname() ||
            !Number.isSafeInteger(data.pid) ||
            data.pid <= 0
          )
            continue;
          try {
            process.kill(data.pid, 0);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === "ESRCH") {
              await fs.unlink(path.join(lock, owner));
              await fs.rmdir(lock).catch(() => {});
            }
          }
        } catch {
          /* another contender may already have removed the orphan */
        }
      }
      if (owners.length === 0) {
        const stat = await fs.stat(lock).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 2000)
          await fs.rmdir(lock).catch(() => {});
      }
      if (i >= 1400)
        throw new Error("Estúdio ocupado. Tente novamente em alguns segundos.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  try {
    return await action();
  } finally {
    await fs.unlink(path.join(lock, ownerName));
    await fs.rmdir(lock);
  }
}
export async function workerOnline() {
  try {
    const heartbeat = await fs.stat(path.join(dataRoot(), "heartbeat"));
    return Date.now() - heartbeat.mtimeMs < 30_000;
  } catch {
    return false;
  }
}
