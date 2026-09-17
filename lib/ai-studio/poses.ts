import path from "node:path";
import { createHash } from "node:crypto";
import { atomicJson, readJson, storeDir } from "./storage";
import type { Angle, Job } from "./types";

export const CATALOG_POSES = [
  { id: "relaxed-left", direction: "Weight on the left leg, right knee relaxed with right foot slightly forward; both arms loose, left hand beside the thigh and right elbow subtly bent away from the garment." },
  { id: "open-right", direction: "Weight on the right leg, left foot slightly to the side; left elbow softly bent with hand beside the outer hip without resting on or covering fabric, right arm relaxed downward." },
  { id: "short-step-left", direction: "A small natural forward step with the left foot, right heel lightly released; a subtle walking counter-swing of the arms, hands relaxed and clear of the garment." },
  { id: "parallel-soft", direction: "Feet approximately parallel and hip-width apart, balanced weight and relaxed knees; right elbow softly bent outward with the hand beside the hip, left arm hanging naturally." },
  { id: "short-step-right", direction: "A small natural forward step with the right foot, left heel lightly released; left arm slightly forward and right arm slightly back in a gentle walking counter-swing." },
  { id: "offset-rest", direction: "Weight on the right leg, left foot half a step behind without crossing the legs; shoulders relaxed, both arms slightly separated from the torso with asymmetrical relaxed hand heights." },
] as const;
const offsets: Record<Angle, number> = { front: 0, back: 2, side: 4 };
type Counters = Record<string, Partial<Record<Angle, number>>>;

// Caller holds withStoreLock. Reserve locally before queueing; never ask the model
// to select a pose, and never retry a paid generation just to enforce variety.
export async function reservePoses(job: Job, angles: Angle[]) {
  const file = path.join(storeDir(job.storeId), "pose-sequences.json");
  const counters = await readJson<Counters>(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return {} as Counters;
    throw error;
  });
  const key = job.avatarId || "original-subject";
  const sequence = counters[key] || {};
  const poses = { ...job.poseIds };
  for (const angle of angles) {
    let next = sequence[angle] ?? offsets[angle];
    if (CATALOG_POSES[next % CATALOG_POSES.length].id === poses[angle]) next++;
    poses[angle] = CATALOG_POSES[next % CATALOG_POSES.length].id;
    sequence[angle] = (next + 1) % CATALOG_POSES.length;
  }
  counters[key] = sequence;
  await atomicJson(file, counters);
  return poses;
}

export function selectedPose(job: Job, angle: Angle) {
  const stored = CATALOG_POSES.find(pose => pose.id === job.poseIds?.[angle]);
  if (stored) return stored;
  // Older queued jobs remain runnable without modifying their analysis or references.
  const seed = createHash("sha256").update(`${job.id}:${job.attempts}`).digest().readUInt32BE(0);
  return CATALOG_POSES[(seed + offsets[angle]) % CATALOG_POSES.length];
}

export function poseInstruction(job: Job, angle: Angle) {
  const pose = selectedPose(job, angle);
  const view = angle === "front" ? "torso and hips facing the camera" : angle === "back" ? "torso and hips facing away from the camera; show the garment back, not a three-quarter turn" : "torso and hips in a true side profile; do not turn into a front or three-quarter view";
  return `ASSIGNED CATALOG POSE (${pose.id}): ${pose.direction} Keep ${view}. This assigned pose overrides the pose in avatar photos, the generated front and any generic pose in the analysis. Adapt the limbs naturally to the requested view, preserving the person's anatomy and unretouched skin. Keep hands clear of garment details and silhouette; never invent pockets or put hands into undocumented pockets. Do not pull, lift or stretch the fabric. No seated poses, raised arms, exaggerated arching or dramatic movement. Keep the shared 2:3 camera framing, full body, headroom and foot baseline. Preserve the original scene and skin character; moving the person is not cosmetic retouching.`;
}
