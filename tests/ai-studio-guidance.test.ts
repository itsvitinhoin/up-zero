import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { garmentGuidanceSchema, type Job, type GarmentGuidance } from "../lib/ai-studio/types";
import { garmentDirection, generationSpecification, matchingFront, garmentGuidance } from "../lib/ai-studio/garment-guidance";
import { saveJob, readJob, saveAsset } from "../lib/ai-studio/storage";
import { mutateJob } from "../lib/ai-studio/service";
import { generate } from "../lib/ai-studio/provider";

const guidance: GarmentGuidance = { pieces: ["Blusa", "Saia"], composition: "Conjunto", fit: "Evasê", pattern: "Estampado floral", notes: "A parte inferior é uma saia longa contínua." };
function fixture(asset: string): Job {
  return {
    id: randomUUID(), requestId: randomUUID(), storeId: 1, createdBy: "tester", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    name: "Roupa", productId: null, groupKey: null, color: "Verde", hex: "#335544", references: [{assetId: asset, role: "front"}, {assetId: asset, role: "color"}],
    avatarId: null, angles: ["front", "back", "side"], imageModel: "gpt-image-2.5-sunburst", analysisModel: "gpt-6-astra", promptVersion: "fixture", status: "ready", progress: "", outputs: [], pendingAngles: [], attempts: 0, analysisAttempts: 1, calls: [],
    analysis: { summary: "DESCRICAO_CALCA_ANTIGA", garment: "Calça", silhouette: "Wide leg", construction: ["DESCRICAO_CALCA_ANTIGA"], texture: "Lisa", fixedDetails: [], recolorRegions: [], unknowns: [], supportedAngles: ["front"], warnings: [] },
  };
}

test("keywords validate bounded user data and retain legacy analyses", () => {
  assert.equal(garmentGuidanceSchema.safeParse(guidance).success, true);
  assert.equal(garmentGuidanceSchema.safeParse({...guidance, pieces: []}).success, false);
  assert.equal(garmentGuidanceSchema.safeParse({...guidance, pieces: [" "]}).success, false);
  assert.equal(garmentGuidanceSchema.safeParse({...guidance, notes: "x".repeat(1501)}).success, false);
  assert.equal(garmentGuidanceSchema.safeParse({...guidance, storeId: 2}).success, false);
  const job = fixture(randomUUID());
  assert.deepEqual(garmentGuidance(job).pieces, ["Calça"]);
  job.analysis!.keywords = {pieces: ["Saia"], composition: "Peça única", fit: "Reta", pattern: "Estampado"};
  assert.deepEqual(garmentGuidance(job).pieces, ["Saia"]);
  job.garmentGuidance = guidance;
  assert.deepEqual(garmentGuidance(job), guidance);
  assert.match(garmentDirection(job), /bottom is a SKIRT/);
  assert.doesNotMatch(generationSpecification(job), /DESCRICAO_CALCA_ANTIGA/);
  job.garmentGuidance = {...guidance, pieces: ["Calça"], fit: "Wide leg"};
  assert.match(garmentDirection(job), /TWO SEPARATE LEG OPENINGS/);
  assert.doesNotMatch(garmentDirection(job), /bottom is a SKIRT/);
});

test("corrections save without API usage, isolate tenants, freeze during generation and replace stale prompts/anchors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-guidance-"));
  const oldDir = process.env.AI_STUDIO_DATA_DIR, oldKey = process.env.OPENAI_API_KEY, originalFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = dir;
  process.env.OPENAI_API_KEY = "fixture-not-real";
  try {
    const bytes = await sharp({create: {width: 512, height: 768, channels: 3, background: "#336633"}}).jpeg().toBuffer();
    const asset = await saveAsset(1, bytes), oldFront = await saveAsset(1, bytes);
    const job = fixture(asset);
    job.outputs = [{shot: "front", assetId: oldFront, approved: false, reviewMode: "manual", review: {verdict: "review", issues: [], clothing: "", color: "", skin: "", crop: null}}];
    await saveJob(job);
    const admin = {storeId: 1, userId: "tester", cookie: "fixture"};
    globalThis.fetch = async () => { throw new Error("Corrections must not call an API"); };
    const updated = await mutateJob(admin, job.id, {action: "update_guidance", guidance});
    assert.deepEqual(updated.garmentGuidance, guidance);
    assert.equal(updated.guidanceUpdatedBy, "tester");
    assert.equal(updated.guidanceRevision, 1);
    assert.equal(updated.analysis!.garment, "Calça", "original analysis stays as historical evidence");
    assert.equal(updated.outputs[0].assetId, oldFront);
    assert.equal(updated.calls.length, 0);
    assert.equal(updated.attempts, 0);
    assert.equal(matchingFront(updated), undefined, "old pants photo cannot anchor a corrected skirt");
    assert.equal((await mutateJob(admin, job.id, {action: "update_guidance", guidance})).guidanceRevision, 1, "duplicate save is idempotent");
    await assert.rejects(mutateJob({...admin, storeId: 2}, job.id, {action: "update_guidance", guidance}));
    await assert.rejects(mutateJob(admin, job.id, {action: "update_guidance", guidance: {...guidance, notes: "x".repeat(1501)}}));
    let imageCalls = 0;
    globalThis.fetch = async (url, init) => {
      imageCalls++;
      assert.ok(String(url).endsWith("images/edits"));
      const form = init!.body as FormData, prompt = String(form.get("prompt"));
      assert.match(prompt, /bottom is a SKIRT/);
      assert.match(prompt, /Estampado floral/);
      assert.doesNotMatch(prompt, /DESCRICAO_CALCA_ANTIGA/);
      assert.equal(form.getAll("image[]").length, 2, "stale front excluded; original references kept");
      return Response.json({data: [{b64_json: bytes.toString("base64")}]});
    };
    await generate(updated, "back");
    assert.equal(imageCalls, 1);
    updated.outputs[0].guidanceRevision = 1;
    assert.equal(matchingFront(updated)?.assetId, oldFront, "only a front from the same guidance revision can anchor");
    updated.status = "generating";
    await saveJob(updated);
    await assert.rejects(mutateJob(admin, job.id, {action: "update_guidance", guidance: {...guidance, pieces: ["Calça"]}}), /Aguarde/);
    assert.deepEqual((await readJob(1, job.id)).garmentGuidance, guidance);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldDir === undefined) delete process.env.AI_STUDIO_DATA_DIR; else process.env.AI_STUDIO_DATA_DIR = oldDir;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    await fs.rm(dir, {recursive: true, force: true});
  }
});
