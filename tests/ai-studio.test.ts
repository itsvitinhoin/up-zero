import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { Job, Analysis, Review } from "../lib/ai-studio/types";
import { randomUUID } from "node:crypto";
import {
  createJobSchema,
  analysisSchema,
  verifiedAngles,
  generationAngles,
  cropPixels,
  portraitDetailPixels,
} from "../lib/ai-studio/types";
import { normalizeProduct, normalizeColors } from "../lib/ai-studio/catalog";
import { isPublicIPv4, downloadReference } from "../lib/ai-studio/media";
import {
  saveAsset,
  readAsset,
  saveJob,
  readJob,
  listJobs,
  withStoreLock,
} from "../lib/ai-studio/storage";
import { processJob, tick, plannedDetailCrop } from "../lib/ai-studio/worker";
const analysis: Analysis = {
  summary: "Pe\xE7a de teste",
  garment: "Camiseta",
  silhouette: "Reta",
  construction: ["Gola redonda"],
  texture: "Lisa",
  fixedDetails: ["Costuras"],
  recolorRegions: ["Tecido"],
  unknowns: [],
  supportedAngles: ["front"],
  warnings: [],
};
const review: Review = {
  verdict: "pass",
  issues: [],
  clothing: "Sem diferen\xE7as vis\xEDveis.",
  color: "Compat\xEDvel.",
  skin: "N\xE3o aplic\xE1vel.",
  crop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
};
function makeJob(storeId: number, assetId: string): Job {
  const id = randomUUID(),
    now = new Date().toISOString();
  return {
    id,
    requestId: randomUUID(),
    name: "Ensaio de teste",
    storeId,
    createdBy: "tester",
    productId: null,
    groupKey: null,
    color: "Azul",
    hex: "#0022ff",
    references: [
      { assetId, role: "front" },
      { assetId, role: "color" },
    ],
    avatarId: null,
    angles: ["front"],
    imageModel: "gpt-image-2.5-sunburst",
    status: "generating",
    createdAt: now,
    updatedAt: now,
    outputs: [],
    analysis,
    pendingAngles: ["front"],
    attempts: 1,
    analysisAttempts: 1,
    calls: [],
    progress: "",
    promptVersion: "test",
    analysisModel: "gpt-6-astra",
  };
}
makeJob;
test("front/back references and avatar are prepared once; three generations deliver four downloadable images without reviews", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-preparation-"));
  const oldDir = process.env.AI_STUDIO_DATA_DIR, oldKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = root;
  process.env.OPENAI_API_KEY = "fixture-not-a-real-key";
  try {
    const bytes = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#998877" } }).jpeg().toBuffer();
    const front = await saveAsset(1, bytes), back = await saveAsset(1, bytes);
    const { listAvatars } = await import("../lib/ai-studio/storage");
    const prepared = { ...analysis, supportedAngles: ["front", "back"], keywords: { pieces: ["Blusa"], composition: "Peça única", fit: "Reta", pattern: "Lisa" }, preparation: {
      observedFront: "Gola e costuras visíveis", observedBack: "Costas lisas", estimatedSide: "Continuidade estimada",
      preserve: ["Gola"], avatarAndScene: "Pele natural, mesmos calçados e cenário", conflicts: [],
      front: "Plano específico da frente", back: "Plano específico das costas", side: "Plano específico da lateral estimada", detailRegion: "upper",
    } };
    let analyses = 0, generations = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith("/responses")) {
        assert.equal(generations, 0, "all vision analysis must precede image generation");
        analyses++;
        const sent = JSON.parse(init!.body as string);
        assert.equal(sent.model, "gpt-6-astra");
        assert.equal(sent.text.format.name, "garment_preparation");
        assert.equal(sent.input[0].content.filter((p: {type: string}) => p.type === "input_image").length, 3, "front, back and avatar are all analyzed");
        assert.match(sent.input[0].content[0].text, /side or detail photo is NOT required/);
        return Response.json({ status: "completed", output: [{content: [{type: "output_text", text: JSON.stringify(prepared)}]}], usage: {input_tokens: 100, output_tokens: 100} });
      }
      assert.ok(String(url).endsWith("/images/edits"));
      generations++;
      const body = init!.body as FormData;
      assert.equal(body.get("quality"), "high");
      assert.equal(body.get("size"), "1024x1536");
      assert.match(String(body.get("prompt")), /Plano específico/);
      assert.equal(body.getAll("image[]").length, generations === 1 ? 3 : 4, "later views retain originals, avatar and front anchor");
      return Response.json({ data: [{b64_json: bytes.toString("base64")}], usage: {input_tokens: 100, output_tokens: 100} });
    };
    const job = makeJob(1, front);
    job.references = [{assetId: front, role: "color", angle: "front"}, {assetId: back, role: "color", angle: "back"}];
    job.avatarId = (await listAvatars(1))[0].id;
    job.angles = ["front", "back", "side"];
    job.status = "analyzing";
    delete job.analysis;
    await processJob(job);
    assert.equal(job.status, "ready");
    assert.equal(analyses, 1);
    assert.equal(generations, 0);
    assert.deepEqual(verifiedAngles(job), ["front", "back"]);
    job.status = "generating";
    job.pendingAngles = ["front", "back", "side"];
    await processJob(job);
    assert.equal(job.status, "review");
    assert.equal(analyses, 1);
    assert.equal(generations, 3);
    assert.equal(job.calls.length, 4);
    assert.deepEqual(job.calls.map(c => c.stage), ["garment_preparation", "generate_front", "generate_back", "generate_side"]);
    assert.equal(job.outputs.length, 4);
    assert.ok(job.outputs.every(o => o.reviewMode === "manual" && !o.approved));
    assert.match(job.outputs.find(o => o.shot === "side")!.review.issues.join(" "), /estimado/);
    assert.equal(job.outputs.find(o => o.shot === "back")!.review.issues.length, 0);
    const { downloadJobImages } = await import("../lib/ai-studio/download");
    const { unzipSync } = await import("fflate");
    assert.equal(Object.keys(unzipSync(await downloadJobImages(job))).length, 4);
    const before = job.calls.length;
    const { cropDetail } = await import("../lib/ai-studio/worker");
    const { portraitDetailPixels } = await import("../lib/ai-studio/types");
    for (const region of ["upper", "waist", "lower"] as const) {
      job.analysis!.preparation!.detailRegion = region;
      const planned = plannedDetailCrop(job);
      const pixels = portraitDetailPixels(planned, 1024, 1536);
      assert.equal(pixels.width / pixels.height, 2 / 3);
      assert.ok(pixels.top + pixels.height <= 1536);
      await cropDetail(job, job.outputs[0], planned);
    }
    assert.equal(job.calls.length, before);
    assert.equal(await tick(), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldDir === undefined) delete process.env.AI_STUDIO_DATA_DIR; else process.env.AI_STUDIO_DATA_DIR = oldDir;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    await fs.rm(root, {recursive: true, force: true});
  }
});
test("validation rejects missing roles, duplicate angles, path traversal and unsupported models", () => {
  const job = makeJob(1, randomUUID());
  assert.equal(createJobSchema.safeParse(job).success, true);
  assert.equal(
    createJobSchema.safeParse({ ...job, angles: ["front", "front"] }).success,
    false,
  );
  assert.equal(
    createJobSchema.safeParse({
      ...job,
      references: [{ assetId: "../../secret", role: "front" }],
    }).success,
    false,
  );
  assert.equal(
    createJobSchema.safeParse({ ...job, imageModel: "arbitrary-model" })
      .success,
    false,
  );
  assert.equal(
    createJobSchema.safeParse({
      ...job,
      references: [{ assetId: randomUUID() }],
    }).success,
    false,
  );
  assert.equal(analysisSchema.safeParse(analysis).success, true);
});
test("missing views remain unverified but can be generated from available garment references", () => {
  const job = makeJob(1, randomUUID());
  job.angles = ["front", "back"];
  job.analysis!.supportedAngles = ["front", "back"];
  assert.deepEqual(verifiedAngles(job), ["front"]);
  assert.deepEqual(generationAngles(job), ["front", "back"]);
  job.analysis!.supportedAngles = [];
  assert.deepEqual(generationAngles(job), ["front", "back"]);
  job.references = [{ assetId: randomUUID(), role: "color" }];
  assert.deepEqual(generationAngles(job), []);
  job.avatarId = randomUUID();
  assert.deepEqual(generationAngles(job), ["front", "back"]);
  job.analysis = void 0;
  assert.deepEqual(generationAngles(job), []);
});
test("catalog keys follow existing attribute ordering and authoritative backend keys", () => {
  const full = {
    product: {
      id: 42,
      name: "Blusa",
      store_id: 1,
      image_grouping_rule: JSON.stringify({
        type: "attributes",
        attribute_ids: [10],
      }),
    },
    variants: [
      {
        id: 100,
        attribute_values: [
          { attribute_id: 10, value_id: 300, value_name: "Verde" },
          { attribute_id: 11, value_id: 2, value_name: "M" },
        ],
      },
      {
        id: 101,
        attribute_values: [
          { attribute_id: 10, value_id: 300, value_name: "Verde" },
        ],
      },
    ],
    image_groups: [] as unknown[],
  };
  assert.deepEqual(normalizeProduct(full, 1).groups[0], {
    key: "attr:300",
    label: "Verde",
    variantIds: [100, 101],
    attributeValueIds: [300, 2],
    images: [],
    displayOrders: [],
  });
  full.image_groups = [
    {
      image_key: "legacy-green",
      variants: [{ id: 100 }, { id: 101 }],
      images: [{ image_url: "https://cdn.example/a.jpg", display_order: 7 }],
    },
  ];
  assert.equal(normalizeProduct(full, 1).groups[0].key, "legacy-green");
  assert.throws(() => normalizeProduct(full, 2), /loja/);
});
test("private addresses and unsafe schemes cannot be imported", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.2.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.1.1",
    "::1",
    "0.0.0.0",
  ])
    assert.equal(isPublicIPv4(ip), false);
  assert.equal(isPublicIPv4("8.8.8.8"), true);
  await assert.rejects(
    downloadReference("http://example.com/photo.jpg"),
    /HTTPS/,
  );
  await assert.rejects(
    downloadReference("https://user:pass@example.com/photo.jpg"),
    /HTTPS/,
  );
});
test("crop rejects outside bounds and preserves selected source dimensions", () => {
  assert.deepEqual(
    cropPixels({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 1024, 1536),
    { left: 256, top: 384, width: 512, height: 768 },
  );
  assert.throws(
    () => cropPixels({ x: 0.8, y: 0, width: 0.5, height: 0.5 }, 1e3, 1e3),
    /fora/,
  );
});
test("pipeline creates a local crop without API inspection, preserves paid output on generation failure, never auto retries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-studio-test-"));
  const previousDir = process.env.AI_STUDIO_DATA_DIR,
    previousKey = process.env.OPENAI_API_KEY,
    originalFetch = globalThis.fetch;
  process.env.AI_STUDIO_DATA_DIR = root;
  process.env.OPENAI_API_KEY = "fixture-key-not-real";
  try {
    const bytes = await sharp({
      create: { width: 1024, height: 1536, channels: 3, background: "#0022ff" },
    })
      .jpeg()
      .toBuffer();
    const asset = await saveAsset(1, bytes);
    await assert.rejects(readAsset(2, asset));
    assert.throws(() => readAsset(1, "../../secret"));
    await assert.rejects(saveAsset(1, Buffer.from("<svg></svg>")));
    let imageCalls = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith("/images/edits")) {
        imageCalls++;
        const prompt = String((init?.body as FormData).get("prompt"));
        assert.ok(!prompt.includes("#0022ff"));
        assert.match(prompt, /ONLY authority for target color/);
        assert.match(prompt, /STANDARD FRAMING FOR FRONT, BACK AND SIDE/);
        assert.match(prompt, /NEVER stretch or shorten the body/);
        assert.equal((init?.body as FormData).get("model"), "gpt-image-2.5-sunburst");
        assert.equal((init?.body as FormData).getAll("image[]").length, 2);
        return Response.json({
          data: [{ b64_json: bytes.toString("base64") }],
          usage: { total_tokens: 10 },
        });
      }
      throw new Error("No vision API call is allowed after generation");
    };
    const job = makeJob(1, asset);
    await saveJob(job);
    await processJob(job);
    const saved = await readJob(1, job.id);
    assert.equal(saved.status, "review");
    assert.equal(saved.outputs.length, 2);
    assert.equal(saved.outputs[0].approved, false);
    assert.equal(saved.outputs[0].reviewMode, "manual");
    assert.equal(saved.calls.length, 1);
    assert.equal(saved.outputs[1].parentAssetId, saved.outputs[0].assetId);
    const { downloadJobImages } = await import("../lib/ai-studio/download");
    const { unzipSync } = await import("fflate");
    const archive = unzipSync(await downloadJobImages(saved));
    assert.equal(Object.keys(archive).length, 2);
    assert.deepEqual(
      Buffer.from(Object.values(archive)[0]),
      await readAsset(1, saved.outputs[0].assetId),
    );
    const cropMeta = await sharp(
      await readAsset(1, saved.outputs[1].assetId),
    ).metadata();
    assert.equal(cropMeta.width, 512);
    assert.equal(cropMeta.height, 768);
    assert.equal(await tick(), false);
    assert.equal(imageCalls, 1);
    const inferredJob = makeJob(1, asset);
    inferredJob.angles = ["side"];
    inferredJob.pendingAngles = ["side"];
    await saveJob(inferredJob);
    await processJob(inferredJob);
    const inferredSaved = await readJob(1, inferredJob.id);
    assert.equal(inferredSaved.status, "review");
    assert.equal(inferredSaved.outputs.length, 1);
    assert.equal(inferredSaved.outputs[0].review.verdict, "review");
    assert.match(
      inferredSaved.outputs[0].review.issues.join(" "),
      /estimado sem referência/,
    );
    assert.equal(imageCalls, 2);
    const { listAvatars } = await import("../lib/ai-studio/storage");
    const avatarOnly = makeJob(1, asset);
    avatarOnly.references = [{ assetId: asset, role: "color" }];
    avatarOnly.avatarId = (await listAvatars(1))[0].id;
    await saveJob(avatarOnly);
    await processJob(avatarOnly);
    const avatarResult = await readJob(1, avatarOnly.id);
    assert.equal(avatarResult.status, "review");
    assert.equal(avatarResult.outputs[0].shot, "front");
    assert.equal(avatarResult.outputs[0].review.verdict, "review");
    assert.equal(imageCalls, 3);
    let attempts = 0;
    globalThis.fetch = async () => ++attempts === 1
      ? Response.json({ data: [{ b64_json: bytes.toString("base64") }] })
      : Response.json({ error: "quota" }, { status: 429 });
    const failed = makeJob(1, asset);
    failed.angles = ["front", "back"];
    failed.pendingAngles = ["front", "back"];
    await saveJob(failed);
    await processJob(failed);
    const recovered = await readJob(1, failed.id);
    assert.equal(recovered.status, "failed");
    assert.equal(recovered.outputs.length, 2);
    assert.equal(recovered.outputs[0].review.verdict, "review");
    assert.equal(attempts, 2);
    assert.equal(await tick(), false);
    assert.equal((await listJobs(2)).length, 0);
    const order: number[] = [];
    await Promise.all([
      withStoreLock(1, async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 20));
        order.push(2);
      }),
      withStoreLock(1, async () => {
        order.push(3);
      }),
    ]);
    assert.equal(order.indexOf(2), order.indexOf(1) + 1);
    assert.equal(order.filter((n) => n === 3).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDir === void 0) delete process.env.AI_STUDIO_DATA_DIR;
    else process.env.AI_STUDIO_DATA_DIR = previousDir;
    if (previousKey === void 0) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    await fs.rm(root, { recursive: true, force: true });
  }
});
for (const groupingType of ["attributes", "full_sku", "product"]) {
  test(`publication (${groupingType}) preserves originals, approvals and idempotency`, async () => {
    const imageKey = groupingType === "product" ? "product" : "attr:99";
    const { createJob, mutateJob, publish, reserve } =
      await import("../lib/ai-studio/service");
    const { heartbeat } = await import("../lib/ai-studio/worker");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-studio-service-"));
    const old = {
      dir: process.env.AI_STUDIO_DATA_DIR,
      key: process.env.OPENAI_API_KEY,
      backend: process.env.NEXT_PUBLIC_RUST_URL,
      limit: process.env.AI_STUDIO_DAILY_IMAGES,
    };
    const originalFetch = globalThis.fetch;
    process.env.AI_STUDIO_DATA_DIR = root;
    process.env.OPENAI_API_KEY = "fixture-key";
    process.env.NEXT_PUBLIC_RUST_URL = "https://backend.test";
    process.env.AI_STUDIO_DAILY_IMAGES = "1";
    try {
      const bytes = await sharp({
        create: { width: 512, height: 768, channels: 3, background: "#0022ff" },
      })
        .jpeg()
        .toBuffer();
      const asset = await saveAsset(1, bytes),
        detail = await saveAsset(1, bytes);
      const images = [
        { image_url: "https://cdn.test/existing.jpg", display_order: 4 },
      ];
      let posts = 0,
        uploads = 0;
      globalThis.fetch = async (url, init) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname.endsWith("/full"))
          return Response.json({
            product: {
              id: 42,
              store_id: 1,
              name: "Camiseta",
              image_grouping_rule: JSON.stringify({
                type: groupingType,
                attribute_ids: [10],
              }),
            },
            variants: [
              {
                id: 100,
                attribute_values: [
                  { attribute_id: 10, value_id: 99, value_name: "Azul" },
                ],
              },
            ],
            image_groups: [
              { image_key: imageKey, variants: [{ id: 100 }], images },
            ],
          });
        if (pathname === "/storage/upload")
          return Response.json({
            url: `https://cdn.test/generated-${++uploads}.jpg`,
          });
        if (pathname.endsWith("/images")) {
          posts++;
          const input2 = JSON.parse(init!.body as string);
          assert.equal(input2.image_key, imageKey);
          assert.deepEqual(
            input2.variant_ids,
            groupingType === "product" ? void 0 : [100],
          );
          assert.equal(input2.images[0].display_order, 5);
          assert.equal(input2.images[0].is_primary, false);
          assert.equal(
            input2.images[0].url,
            "https://cdn.test/generated-1.jpg",
          );
          for (const image of input2.images)
            images.push({
              image_url: image.url,
              display_order: image.display_order,
            });
          return Response.json(
            { error: "ambiguous gateway failure" },
            { status: 502 },
          );
        }
        throw Error("Unexpected network call");
      };
      await heartbeat();
      const admin = { storeId: 1, userId: "tester", cookie: "fixture-cookie" };
      const input = { ...makeJob(1, asset), productId: 42, groupKey: imageKey };
      const created = await createJob(admin, input);
      assert.equal((await createJob(admin, input)).id, created.id);
      await assert.rejects(
        createJob(admin, { ...input, color: "Vermelho" }),
        /outras referências/,
      );
      created.status = "ready";
      created.analysis = analysis;
      await saveJob(created);
      const queued = await mutateJob(admin, created.id, { action: "generate" });
      assert.equal(queued.status, "queued_generation");
      await assert.rejects(
        mutateJob(admin, created.id, { action: "generate" }),
        /processamento/,
      );
      await assert.rejects(reserve(1, 1, 0), /Limite diário/);
      queued.status = "review";
      queued.outputs = [
        {
          shot: "detail",
          assetId: detail,
          approved: false,
          review: { ...review, verdict: "pass" },
        },
        {
          shot: "front",
          assetId: asset,
          approved: false,
          review: { ...review, verdict: "pass" },
        },
      ];
      await saveJob(queued);
      const destination = {
        productId: 42,
        groupKey: imageKey,
        shots: ["detail", "front"],
      };
      await assert.rejects(publish(admin, queued.id, destination), /Aprove/);
      await mutateJob(admin, queued.id, {
        action: "approve",
        shot: "front",
        approved: true,
      });
      await mutateJob(admin, queued.id, {
        action: "approve",
        shot: "detail",
        approved: true,
      });
      await assert.rejects(publish(admin, queued.id, destination), /anexar/);
      const published = await publish(admin, queued.id, destination);
      assert.equal(posts, 1);
      assert.equal(uploads, 2);
      assert.equal(images.length, 3);
      assert.equal(
        published.outputs.find((o) => o.shot === "front")?.publishedUrl,
        "https://cdn.test/generated-1.jpg",
      );
      assert.equal(images[0].image_url, "https://cdn.test/existing.jpg");
      await publish(admin, queued.id, destination);
      assert.equal(posts, 1);
      assert.equal(uploads, 2);
      await assert.rejects(
        publish({ ...admin, storeId: 2 }, queued.id, destination),
      );
      await assert.rejects(
        mutateJob(admin, queued.id, { action: "retry", shot: "front" }),
        /publicadas/,
      );
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries({
        AI_STUDIO_DATA_DIR: old.dir,
        OPENAI_API_KEY: old.key,
        NEXT_PUBLIC_RUST_URL: old.backend,
        AI_STUDIO_DAILY_IMAGES: old.limit,
      })) {
        if (value === void 0) delete process.env[key];
        else process.env[key] = value;
      }
      await fs.rm(root, { recursive: true, force: true });
    }
  });
}
test("color catalog uses registered metadata and color references have an independent limit", () => {
  assert.deepEqual(
    normalizeColors([
      {
        code: "cor",
        values: [
          { id: 7, name: "Verde", meta: { rgb: "#abc" } },
          { id: 8, name: "Azul", meta: { hex: "112233" } },
          { id: 9, name: "Sem tom", meta: {} },
        ],
      },
      { code: "size", values: [{ id: 10, name: "P" }] },
    ]),
    [
      { id: 7, name: "Verde", hex: "#aabbcc" },
      { id: 8, name: "Azul", hex: "#112233" },
      { id: 9, name: "Sem tom", hex: null },
    ],
  );
  const job = makeJob(1, randomUUID());
  job.references = [
    ...Array.from({ length: 8 }, () => ({
      assetId: randomUUID(),
      role: "front" as const,
    })),
    ...Array.from({ length: 4 }, () => ({
      assetId: randomUUID(),
      role: "color" as const,
    })),
  ];
  assert.equal(createJobSchema.safeParse(job).success, true);
  job.references[0].role = "color";
  assert.equal(createJobSchema.safeParse(job).success, false);
});
test("built-in synthetic avatar has a readable image for any authenticated store", async () => {
  const { listAvatars } = await import("../lib/ai-studio/storage");
  const avatar = (await listAvatars(912387))[0];
  assert.equal(avatar.createdBy, "system");
  const meta = await sharp(
    await readAsset(912387, avatar.references[0].assetId),
  ).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok(meta.height! > 1e3);
});
test("color photos are required even when variant HEX is present", async () => {
  const { requireColorPhotos } = await import("../lib/ai-studio/provider");
  assert.throws(
    () => requireColorPhotos([{ assetId: randomUUID(), role: "front" }]),
    /etapa 3/,
  );
  assert.doesNotThrow(() =>
    requireColorPhotos([{ assetId: randomUUID(), role: "color" }]),
  );
});
test("step 3 photos define garment construction only when original garment photos are absent", async () => {
  const { garmentSourceInstruction } =
    await import("../lib/ai-studio/provider");
  assert.match(
    garmentSourceInstruction({
      references: [{ assetId: randomUUID(), role: "color" }],
    }),
    /BOTH garment construction and target color/,
  );
  assert.match(
    garmentSourceInstruction(makeJob(1, randomUUID())),
    /target color only/,
  );
});
test("detail stays 2:3 for horizontal and edge crops without exceeding the source", () => {
  for (const crop of [
    { x: 0.1, y: 0.3, width: 0.8, height: 0.15 },
    { x: 0.8, y: 0.8, width: 0.2, height: 0.2 },
    { x: 0, y: 0, width: 1, height: 1 },
  ]) {
    const rect = portraitDetailPixels(crop, 1024, 1536);
    assert.equal(rect.width * 3, rect.height * 2);
    assert.ok(
      rect.left >= 0 &&
        rect.top >= 0 &&
        rect.left + rect.width <= 1024 &&
        rect.top + rect.height <= 1536,
    );
  }
});

test("color photo angle survives validation and requires visual confirmation", () => {
  const job = makeJob(1, randomUUID());
  job.references = [{ assetId: randomUUID(), role: "color", angle: "back" }];
  job.angles = ["front", "back"];
  job.analysis!.supportedAngles = ["back"];
  assert.equal(createJobSchema.parse(job).references[0].angle, "back");
  assert.deepEqual(verifiedAngles(job), ["back"]);
  job.analysis!.supportedAngles = [];
  assert.deepEqual(verifiedAngles(job), []);
});
