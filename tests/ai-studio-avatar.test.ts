import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Avatar, Job } from "../lib/ai-studio/types";
import { generationReferences } from "../lib/ai-studio/avatar-preservation";
import { generate } from "../lib/ai-studio/provider";
import { saveAsset, readAsset, saveAvatar } from "../lib/ai-studio/storage";

function fixture(): { job: Job; avatar: Avatar } {
  const avatar: Avatar = { id: randomUUID(), name: "Fixture", createdBy: "tester", createdAt: new Date().toISOString(), references: [
    { assetId: randomUUID(), role: "front" }, { assetId: randomUUID(), role: "back" },
  ] };
  const job: Job = {
    id: randomUUID(), requestId: randomUUID(), storeId: 1, createdBy: "tester", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    name: "Roupa", productId: null, groupKey: null, color: "Azul", hex: "#0000ff",
    references: [{ assetId: randomUUID(), role: "color", angle: "front" }, { assetId: randomUUID(), role: "color", angle: "back" }],
    avatarId: avatar.id, angles: ["front", "back", "side"], imageModel: "gpt-image-2.5-sunburst", analysisModel: "gpt-6-astra", promptVersion: "test", status: "ready", progress: "", outputs: [], pendingAngles: [], attempts: 0, analysisAttempts: 1, calls: [],
  };
  return { job, avatar };
}

test("original avatar view is the editing base, including front fallback and color view labels", () => {
  const { job, avatar } = fixture();
  const original = structuredClone(avatar);
  const front = generationReferences(job, "front", avatar);
  const back = generationReferences(job, "back", avatar);
  const side = generationReferences(job, "side", avatar);
  assert.equal(front.refs[0].assetId, avatar.references[0].assetId);
  assert.equal(back.refs[0].assetId, avatar.references[1].assetId);
  assert.equal(side.refs[0].assetId, avatar.references[0].assetId, "missing side uses an original, not a generated person");
  assert.equal(back.refs[2].assetId, job.references[1].assetId, "step 3 angle labels prioritize matching garment view too");
  assert.deepEqual(avatar, original, "saved ordering remains unchanged");
  const noAvatar = generationReferences(job, "back", null);
  assert.equal(noAvatar.refs[0].assetId, job.references[1].assetId);
  assert.doesNotMatch(noAvatar.manifest.join(" "), /AVATAR|BASE PHOTOGRAPH/);
});

test("actual edit request keeps original avatar bytes first and generated front limited to framing, with no extra calls", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-avatar-"));
  const previousDir = process.env.AI_STUDIO_DATA_DIR, previousKey = process.env.OPENAI_API_KEY, originalFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = dir;
  process.env.OPENAI_API_KEY = "fixture-not-real";
  try {
    const { job, avatar } = fixture();
    const all = [...avatar.references, ...job.references];
    for (let i = 0; i < all.length; i++) {
      const bytes = await sharp({ create: { width: 256, height: 384, channels: 3, background: { r: i * 50, g: 80, b: 100 } } }).jpeg().toBuffer();
      all[i].assetId = await saveAsset(1, bytes);
    }
    await saveAvatar(1, avatar);
    const expected = await readAsset(1, avatar.references[1].assetId);
    job.outputs.push({ shot: "front", assetId: job.references[0].assetId, approved: false, review: { verdict: "review", issues: [], skin: "", clothing: "", color: "", crop: null } });
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.ok(String(url).endsWith("/images/edits"));
      const body = init!.body as FormData;
      const images = body.getAll("image[]") as Blob[];
      assert.deepEqual(Buffer.from(await images[0].arrayBuffer()), expected, "base bytes must be the actual original back avatar");
      assert.equal(images.length, 5, "same original inputs plus existing framing anchor; no additional references");
      const prompt = String(body.get("prompt"));
      assert.match(prompt, /^Edit the ORIGINAL AVATAR in image 1/);
      assert.match(prompt, /GENERATED FRONT — COMPOSITION MEASUREMENTS ONLY/);
      assert.doesNotMatch(prompt, /framing and appearance anchor/);
      assert.match(prompt, /PERSON AND SCENE PRESERVATION — overrides/);
      assert.match(prompt, /Do not retouch, smooth, denoise/);
      assert.equal(body.get("quality"), "high");
      assert.equal(body.get("size"), "1024x1536");
      return Response.json({ data: [{ b64_json: expected.toString("base64") }] });
    };
    await generate(job, "back");
    assert.equal(calls, 1, "no additional analysis, review or regeneration");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDir === undefined) delete process.env.AI_STUDIO_DATA_DIR; else process.env.AI_STUDIO_DATA_DIR = previousDir;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
