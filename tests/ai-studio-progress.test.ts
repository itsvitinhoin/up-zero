import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationProgress } from "../components/admin/ai-studio/generation-progress";
import { parseAnalysisResponse, AnalysisResponseError } from "../lib/ai-studio/analysis-response";
import { analysisSchema, IMAGE_MODEL, createJobSchema, newGenerationProgress, type Job } from "../lib/ai-studio/types";
import { processJob } from "../lib/ai-studio/worker";
import { saveAsset, saveJob, readJob } from "../lib/ai-studio/storage";

const analysis = { summary: "Saia", garment: "Saia", silhouette: "Reta", construction: [], texture: "Lisa", fixedDetails: [], recolorRegions: [], unknowns: [], supportedAngles: ["front"] as ["front"], warnings: [] };
function fixture(assetId: string): Job {
  return { id: randomUUID(), requestId: randomUUID(), storeId: 1, createdBy: "tester", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), name: "Teste", productId: null, groupKey: null, color: "Azul", hex: "#0000ff", avatarId: null, references: [{assetId, role: "front"}, {assetId, role: "color"}], angles: ["front", "back", "side"], imageModel: IMAGE_MODEL, analysisModel: "gpt-6-astra", promptVersion: "test", status: "generating", progress: "", outputs: [], pendingAngles: ["front", "back", "side"], attempts: 3, analysisAttempts: 1, calls: [], analysis };
}

test("analysis failures distinguish causes without exposing provider text", () => {
  const call = {model: "gpt-6-astra", usage: {output_tokens: 6000}, requestId: "request-fixture"};
  const cases = [
    [{status: "incomplete", incomplete_details: {reason: "max_output_tokens"}}, "max_output_tokens"],
    [{status: "incomplete", incomplete_details: {reason: "content_filter"}}, "content_filter"],
    [{status: "incomplete", incomplete_details: {reason: "secret-provider-text"}}, "incomplete_unknown"],
    [{status: "failed"}, "provider_not_completed"],
    [{status: "completed", output: [{content: [{type: "refusal", text: "secret-provider-text"}]}]}, "refusal"],
    [{status: "completed", output: []}, "empty_output"],
    [{status: "completed", output: [{content: [{type: "output_text", text: "secret-provider-text"}]}]}, "invalid_json"],
    [{status: "completed", output: [{content: [{type: "output_text", text: "{}"}]}]}, "invalid_schema"],
  ] as const;
  for (const [response, reason] of cases) {
    assert.throws(() => parseAnalysisResponse(JSON.parse(JSON.stringify(response)), analysisSchema, call), (error: unknown) => {
      assert.ok(error instanceof AnalysisResponseError);
      assert.equal(error.call.failureReason, reason);
      assert.equal(error.call.outcome, "failed");
      assert.deepEqual(error.call.usage, call.usage);
      assert.doesNotMatch(JSON.stringify(error.call) + error.message, /secret-provider-text/);
      return true;
    });
  }
});

test("worker persists failed analysis usage, tracks actual completion and forces Sunburst for legacy jobs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-progress-"));
  const oldDir = process.env.AI_STUDIO_DATA_DIR, oldKey = process.env.OPENAI_API_KEY, originalFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = root;
  process.env.OPENAI_API_KEY = "fixture-not-real";
  try {
    const bytes = await sharp({create: {width: 512, height: 768, channels: 3, background: "#887766"}}).jpeg().toBuffer();
    const asset = await saveAsset(1, bytes);
    const failed = fixture(asset);
    failed.status = "analyzing";
    delete failed.analysis;
    let analysisCalls = 0;
    globalThis.fetch = async () => {
      analysisCalls++;
      return Response.json({status: "incomplete", incomplete_details: {reason: "max_output_tokens"}, output: [], usage: {input_tokens: 200, output_tokens: 6000, output_tokens_details: {reasoning_tokens: 5900}}}, {headers: {"x-request-id": "req-incomplete"}});
    };
    await processJob(failed);
    const saved = await readJob(1, failed.id);
    assert.equal(saved.calls.length, 1);
    assert.equal(saved.calls[0].failureReason, "max_output_tokens");
    assert.equal(saved.calls[0].requestId, "req-incomplete");
    assert.equal((saved.calls[0].usage as {output_tokens: number}).output_tokens, 6000);
    assert.equal(analysisCalls, 1, "failure must not trigger automatic retries");
    assert.equal(saved.outputs.length, 0);
    assert.match(saved.error!, /limite de resposta/);

    const job = fixture(asset);
    job.imageModel = "gpt-image-2.5-flare" as Job["imageModel"];
    assert.equal(createJobSchema.parse(job).imageModel, IMAGE_MODEL);
    assert.equal(createJobSchema.parse({...job, imageModel: undefined}).imageModel, IMAGE_MODEL);
    let generations = 0;
    globalThis.fetch = async (_, init) => {
      const form = init!.body as FormData;
      assert.equal(form.get("model"), IMAGE_MODEL);
      const live = await readJob(1, job.id);
      assert.equal(live.generationProgress!.current, ["front", "back", "side"][generations]);
      assert.equal(live.generationProgress!.completed.length, [0, 2, 3][generations]);
      generations++;
      if (generations === 3) return new Response(null, {status: 503});
      return Response.json({data: [{b64_json: bytes.toString("base64")}]});
    };
    await processJob(job);
    const partial = await readJob(1, job.id);
    assert.equal(partial.status, "failed");
    assert.deepEqual(partial.generationProgress!.completed, ["front", "detail", "back"]);
    assert.equal(partial.generationProgress!.current, "side");
    assert.equal(partial.imageModel, IMAGE_MODEL);
    assert.equal(partial.calls.length, 2);

    // A retry includes old output in the gallery but counts only this new request.
    partial.status = "generating";
    partial.pendingAngles = ["back"];
    partial.generationProgress = newGenerationProgress(["back"]);
    await saveJob(partial);
    globalThis.fetch = async () => {
      const live = await readJob(1, job.id);
      assert.equal(live.generationProgress!.completed.length, 0);
      assert.equal(live.outputs.some(o => o.shot === "back"), true);
      return Response.json({data: [{b64_json: bytes.toString("base64")}]});
    };
    await processJob(partial);
    assert.deepEqual(partial.generationProgress.completed, ["back"]);
    assert.equal(partial.generationProgress.current, undefined);
    assert.equal(partial.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
    if (oldDir === undefined) delete process.env.AI_STUDIO_DATA_DIR; else process.env.AI_STUDIO_DATA_DIR = oldDir;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    await fs.rm(root, {recursive: true, force: true});
  }
});

test("loader renders real completion counts and an indeterminate analysis state", () => {
  const job = fixture(randomUUID());
  job.generationProgress = {shots: ["front", "detail", "back", "side"], completed: ["front", "detail"], current: "back"};
  const html = renderToStaticMarkup(createElement(GenerationProgress, {job}));
  assert.match(html, /2 de 4 fotos prontas/);
  assert.match(html, /Gerando costas/);
  assert.match(html, /width:50%/);
  assert.match(html, /aria-valuenow="2"/);
  job.status = "analyzing";
  const analyzing = renderToStaticMarkup(createElement(GenerationProgress, {job}));
  assert.match(analyzing, /Analisando as referências/);
  assert.doesNotMatch(analyzing, /progressbar|aria-valuenow/);
});
