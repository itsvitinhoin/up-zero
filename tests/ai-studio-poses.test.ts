import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Job } from "../lib/ai-studio/types";
import { CATALOG_POSES, reservePoses, selectedPose } from "../lib/ai-studio/poses";
import { saveJob, readJob, withStoreLock } from "../lib/ai-studio/storage";
import { heartbeat } from "../lib/ai-studio/worker";
import { mutateJob } from "../lib/ai-studio/service";

function fixture(avatarId: string, storeId = 1): Job {
  return {
    id: randomUUID(), requestId: randomUUID(), storeId, createdBy: "tester", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    name: "Roupa", productId: null, groupKey: null, color: "Azul", hex: "#0000ff", avatarId,
    references: [{ assetId: randomUUID(), role: "color", angle: "front" }],
    angles: ["front", "back", "side"], imageModel: "gpt-image-2.5-sunburst", analysisModel: "gpt-6-astra", promptVersion: "test", status: "ready", progress: "", outputs: [], pendingAngles: [], attempts: 0, analysisAttempts: 1, calls: [],
    analysis: { summary: "Saia", garment: "Saia", silhouette: "Reta", construction: [], texture: "Lisa", fixedDetails: [], recolorRegions: [], unknowns: [], supportedAngles: ["front"], warnings: [] },
  };
}

test("catalog poses rotate per avatar/view, survive reload, isolate stores and do not call AI", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-poses-"));
  const oldDir = process.env.AI_STUDIO_DATA_DIR, oldKey = process.env.OPENAI_API_KEY, oldFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = dir;
  process.env.OPENAI_API_KEY = "fixture-not-real";
  globalThis.fetch = async () => { throw new Error("Selecting poses must not call the API"); };
  try {
    const avatar = randomUUID();
    const choices: string[] = [];
    await Promise.all(Array.from({ length: 6 }, () => withStoreLock(1, async () => {
      const job = fixture(avatar);
      const poses = await reservePoses(job, job.angles);
      assert.equal(new Set(Object.values(poses)).size, 3);
      choices.push(poses.front!);
    })));
    assert.equal(new Set(choices).size, CATALOG_POSES.length, "each pose is used before cycling, even for concurrent requests");
    const otherStore = fixture(avatar, 2), otherAvatar = fixture(randomUUID());
    assert.equal((await withStoreLock(2, () => reservePoses(otherStore, ["front"]))).front, choices[0]);
    assert.equal((await withStoreLock(1, () => reservePoses(otherAvatar, ["front"]))).front, choices[0]);
    await heartbeat();
    const job = fixture(avatar);
    await saveJob(job);
    const admin = { storeId: 1, userId: "tester", cookie: "fixture" };
    const queued = await mutateJob(admin, job.id, { action: "generate" });
    assert.equal(queued.calls.length, 0);
    const persisted = await readJob(1, job.id);
    assert.deepEqual(persisted.poseIds, queued.poseIds);
    assert.equal(selectedPose(persisted, "front").id, queued.poseIds!.front);
    await assert.rejects(mutateJob(admin, job.id, { action: "generate" }), /Aguarde/);
    persisted.status = "review";
    await saveJob(persisted);
    const retry = await mutateJob(admin, job.id, { action: "retry", shot: "front" });
    assert.notEqual(retry.poseIds!.front, queued.poseIds!.front);
    assert.equal(retry.poseIds!.back, queued.poseIds!.back, "retry leaves other views unchanged");
    assert.equal(retry.poseIds!.side, queued.poseIds!.side);
    const legacy = fixture(avatar);
    assert.equal(selectedPose(legacy, "front").id, selectedPose(legacy, "front").id, "legacy fallback is stable during one attempt");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDir === undefined) delete process.env.AI_STUDIO_DATA_DIR; else process.env.AI_STUDIO_DATA_DIR = oldDir;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
