import type { Angle, Avatar, Job, Reference } from "./types";
import { matchingFront } from "./garment-guidance";

// These are prompt priorities, not a pixel-preserving mask or an API fidelity setting.
export const AVATAR_PRESERVATION = `PERSON AND SCENE PRESERVATION — overrides any aesthetic suggestions in the garment analysis or view plan:
The ORIGINAL avatar photographs are the only authority for the person's appearance. Image 1 is the base photograph. Make a garment replacement edit, not a new beauty/fashion portrait. Keep the same facial identity, apparent age, anatomy, skin tone and skin texture; the pose and expression may change naturally. Preserve the visible pores, fine lines, freckles, blemishes, body hair, folds, local tonal variation and photographic grain at their original strength. Apply this to face, neck, chest, arms, hands and legs equally. Keep the original lighting direction, shadow contrast and highlights on skin; do not relight the person to flatter them.
Do not retouch, smooth, denoise, airbrush, polish or beautify skin; do not whiten, even out skin tone, enhance makeup, rejuvenate, add a glossy finish, or overlay invented pores/grain. Do not copy skin, face or retouching from a generated image or from the people/mannequins in garment photos.
POSE IS FLEXIBLE: choose a relaxed, natural catalog pose for the requested front, back or side view, even when the avatar reference shows that same view. Do not copy or lock its arm positions, hand placement, stance, weight distribution or expression. Allow subtle, plausible movement without obscuring the garment or changing its fit and construction. Identity and skin preservation do not require pose preservation. Keep the shared camera framing, headroom and foot baseline consistent across views. Changing pose is not permission to beautify, reshape or retouch the person; skin folds and shadows may respond naturally to movement while keeping the original texture and lighting setup. For an unavailable view or newly exposed skin, infer only what is necessary, using the original avatar's skin character and anatomy without idealization. An unseen region has no original texture to copy.
Keep the avatar's actual background, floor, objects, lighting, white balance and photographic character. A generated front can guide composition measurements ONLY, never skin, facial appearance, lighting or surface texture. Avatar clothing is replaced by the target garment, never treated as a garment reference.`;

export function generationReferences(job: Job, angle: Angle, avatar?: Avatar | null) {
  const refs: Reference[] = [];
  const manifest: string[] = [];
  function add(ref: Reference, label: string) {
    refs.push(ref);
    manifest.push(`${refs.length}: ${label}`);
  }
  if (avatar) {
    // Prefer an actual matching view, then front, then other originals; never use a
    // generated view as the base person. Sorting a copy leaves saved avatar order intact.
    const priority = (ref: Reference) => ref.role === angle ? 0 : ref.role === "front" ? 1 : 2;
    const originals = [...avatar.references].sort((a, b) => priority(a) - priority(b));
    originals.forEach((ref, i) => add(ref,
      `${i === 0 ? "BASE PHOTOGRAPH TO EDIT" : "SUPPLEMENTARY ORIGINAL AVATAR"}; ${ref.role} view; person, ORIGINAL UNRETOUCHED SKIN, scene and lighting; ignore its clothing`,
    ));
  }
  const hasOriginalGarment = job.references.some(ref => ref.role !== "color");
  const view = (ref: Reference) => ref.role === "color" ? ref.angle : ref.role;
  const garmentRefs = [
    ...job.references.filter(ref => view(ref) === angle),
    ...job.references.filter(ref => view(ref) !== angle),
  ];
  for (const ref of garmentRefs) {
    const source = ref.role === "color"
      ? (hasOriginalGarment ? "TARGET FABRIC COLOR ONLY" : "GARMENT CONSTRUCTION AND TARGET COLOR")
      : "ORIGINAL GARMENT CONSTRUCTION";
    add(ref, `${source}; photographed view: ${view(ref) || "unspecified"}${avatar ? "; ignore person/mannequin, skin, background and lighting" : ""}`);
  }
  const front = matchingFront(job);
  if (angle !== "front" && front) {
    add({ assetId: front.assetId, role: "front" },
      "GENERATED FRONT — COMPOSITION MEASUREMENTS ONLY: camera distance, subject scale, headroom and foot baseline; NOT a source for pose, skin, face, texture, lighting or retouching; original references remain authoritative",
    );
  }
  return { refs, manifest };
}
