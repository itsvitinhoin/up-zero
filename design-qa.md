# Design QA — editor visual do mega menu Groovy

## Evidence

- Source visual truth path: `/var/folders/q3/9qymc_8s2s18sx2888mvrdz00000gn/T/codex-clipboard-d25c042f-cbbc-491f-ba61-55b077eb8fe7.png`
- Flexibility reference path: `/var/folders/q3/9qymc_8s2s18sx2888mvrdz00000gn/T/codex-clipboard-87f991d2-d860-45d1-80d5-8e807716b060.png`
- Source pixels: `2478 × 918`; the source is a wide desktop capture without the Admin sidebar.
- Implementation URL: `http://localhost:3000/pages/menu/88`
- Implementation screenshot: browser-rendered CUA captures made from the authenticated Chrome tab; the browser provider returned the images inline and did not expose a filesystem path.
- Implementation capture pixels: `1512 × 692`.
- CSS viewport/device density: normal desktop Chrome viewport; no synthetic mobile emulation or density scaling was applied.
- State: Groovy store authenticated, menu `Header`, base list and visual editor opened for the first top-level item.
- Density normalization: comparison used the common content region rather than raw pixel scale because the source omits the persistent sidebar and has a different desktop crop.

## Full-view comparison evidence

The source and implementation were both opened and visually inspected. In the common content region, the implementation preserves the source hierarchy: page title and metadata on the left, `Visualizar` and `Adicionar Item` on the right, a large white bordered card, reorder guidance, and one horizontal row per menu item. The implementation intentionally adds a low-emphasis `Personalizar` action on each top-level row without changing the existing drag, status, or overflow controls.

## Focused region comparison evidence

The visual-editor sheet was inspected in its enabled and disabled states. The focused comparison covered the desktop navigation preview, two independently editable link columns, editorial image, headline/CTA block, activation switch, layout selector, image field, text fields, and persistent save bar. The latest source and implementation were compared at the same open-editor desktop state: both keep the two-column navigation plus editorial card composition, while the implementation adds low-emphasis controls below each column instead of changing the visual hierarchy.

## Required fidelity surfaces

- Fonts and typography: existing Admin font stack and hierarchy are preserved; headings, metadata, labels, and helper text match the surrounding product UI.
- Spacing and layout rhythm: the base list remains aligned to the source; the editor uses a wide preview/inspector split and keeps the save action visible.
- Colors and visual tokens: existing background, border, muted, foreground, destructive, and primary tokens are reused.
- Image quality and asset fidelity: the editor resolves the Groovy theme's existing storefront editorial assets instead of showing broken relative URLs; uploaded images continue using the existing upload and Cloudflare rendering components.
- Copy and content: all controls are in Portuguese and describe the actual behavior. The four Groovy presentation formats, optional description, CTA, and publishing state are explicit.

## Findings and comparison history

- Pass 1 — [P2] Editorial image appeared broken in the Admin preview because the Groovy defaults use storefront-relative asset URLs.
  - Fix: relative editorial assets are now resolved against the configured storefront origin for preview purposes without changing the saved value.
  - Post-fix evidence: both the large preview image and upload-field preview render the existing Groovy campaign image.
- Pass 1 — [P2] `aria-disabled` on the whole inspector incorrectly exposed edit/subitem actions as disabled when only the mega-menu fields should be inactive.
  - Fix: removed the inherited disabled state and kept explicit `disabled` props only on controls governed by the activation switch.
  - Post-fix evidence: `Editar item principal` and `Subitem` remain available while the format and editorial inputs correctly follow the switch.
- Pass 1 — [P2] Next.js reported a current-time prerender issue while loading menu categories.
  - Fix: the protected menu detail now calls `await connection()` before request-time data access, following the bundled Next.js 16 guidance.
  - Post-fix evidence: the route reloaded without the issue overlay.
- Pass 2: no remaining actionable P0/P1/P2 visual or interaction findings.
- Pass 3 — [P1] The preview visually split existing children in half and only exposed an add action for an empty column, so the user could not intentionally add several category/page/URL links to a chosen group.
  - Fix: each column now has a persistent `Adicionar link` action, its own editable title and an unlimited item count. New items return to the editor in the chosen column.
  - Post-fix evidence: the authenticated Admin preview showed `Categorias / Conjuntos` and `Compre por / Blusas`, with an add action in both columns even while populated.
- Pass 3 — [P2] The theme stored the mega-menu layout and editorial content but not the relationship between a real child menu item and its visual column.
  - Fix: added `megaMenuNavigation`, keyed by parent menu item id and containing column titles plus child ids. The storefront resolves those ids against the real `Páginas > Menu` links.
  - Post-fix evidence: after `Salvar e publicar`, the local storefront rendered the saved groups exactly as `Categorias > Conjuntos` and `Compre por > Blusas`.
- Pass 3 — [P2] Reassigning a link between groups needed a direct interaction.
  - Fix: each preview row exposes a keyboard-labelled move action on hover/focus. Moving `Conjuntos` to the second column immediately updated the preview counts from `1/1` to `0/2`; moving it back restored `1/1` without publishing the QA detour.
- Pass 4: no remaining actionable P0/P1/P2 visual or interaction findings.

## Primary interactions tested

- Opened the editor from `Personalizar`.
- Toggled the mega menu on and confirmed the preview transition.
- Opened the format selector and switched from `Categorias` to `Mais vendidos`.
- Confirmed editorial copy and image update with the selected format.
- Opened the `Novo Sub-item` dialog and cancelled without changing production data.
- Confirmed the link dialog accepts `Todos os produtos`, external URL, category, promotion, and institutional page types.
- Tested both persistent `Adicionar link` actions and cancelled without creating QA data.
- Tested moving an existing link between columns and restored its original position.
- Published the real current grouping (no mock content) and confirmed the success toast.
- Opened the matching storefront menu by keyboard focus and confirmed the published two-column structure, editorial asset and CTA.
- Verified the connected storefront `/1043` with real Groovy products, categories, videos, navigation, identity, and footer data.

## Console errors checked

- The route-specific Next.js prerender issue found on the first pass was fixed.
- Remaining chart-size warnings came from the previously visited dashboard and are unrelated to the menu route.
- Targeted ESLint reported no errors in the edited Admin files.
- The React review confirmed derived column state is computed during render rather than synchronized with a cascading effect; lookup-heavy rendering uses `Map`/`Set`, and the server action retains authorization checks.
- Admin production build, storefront TypeScript validation and storefront production build with webpack completed successfully. The default Turbopack production build hit the known local port-binding sandbox restriction; it was not a source-code failure.

## Follow-up polish

- [P3] Consider a dedicated compact preview for mobile menu behavior in a later iteration; the supplied source and current requirement are desktop-focused.

## Appearance cleanup and Groovy banner uploads

### Evidence

- Source paths: `/var/folders/q3/9qymc_8s2s18sx2888mvrdz00000gn/T/codex-clipboard-6a2a777d-a9af-43e8-8ea8-507bae247dc1.png` and `/var/folders/q3/9qymc_8s2s18sx2888mvrdz00000gn/T/codex-clipboard-73093b87-d71a-4b22-9f1d-f60924738d0d.png`.
- Source intent: remove the mega-menu editorial editor from Appearance, remove the obsolete category-banner mode selector and expose three direct upload slots for the Groovy Home banners.
- Implementation URL: `http://localhost:3000/settings/appearance#category-banners`.
- Implementation screenshot: authenticated Chrome CUA capture, rendered inline at `1512 × 692`; the browser provider did not expose a filesystem path.
- Density normalization: the comparison used the full three-column content card because the supplied sources use different crops and desktop widths.

### Comparison and findings

- Pass 1 — [P1] The Appearance page duplicated mega-menu configuration that now belongs to `Páginas > Menu`.
  - Fix: removed the complete mega-menu editorial block from Appearance. The menu editor remains the single editing surface for mega-menu links, layout and image.
- Pass 1 — [P1] The old `Banners de Categoria` section exposed automatic/custom/disabled modes that do not map to the three fixed Groovy banner positions.
  - Fix: replaced it with exactly three vertical upload cards, ordered left-to-right, each with status, image, optional destination URL and alternative text.
- Pass 1 — [P2] Existing banner data could have been lost during the interface replacement.
  - Fix: the editor normalizes and reuses the first three stored `categoryBanners`; the authenticated visual check showed the existing second image preserved while empty positions remained explicit upload placeholders.
- Pass 1 — [P2] The generic category banner crop was horizontal (`1200×400`) and did not match the storefront composition.
  - Fix: added a dedicated Groovy image type at `900×1200` (3:4 portrait), matching the three Home cards.
- Pass 2: no remaining actionable P0/P1/P2 visual or interaction findings.

### Connection verification

- The new controls continue writing to `SiteCustomization.categoryBanners`; no parallel or presentation-only setting was introduced.
- The existing settings save action already serializes and persists `categoryBanners`.
- The storefront theme parser already reads `meta.categoryBanners`, and the Groovy Home component renders the first three active entries between the product carousels.
- For themes without this capability, the card remains visible but greyed out with `Não disponível neste tema`, matching the template capability model.

### Validation

- Targeted ESLint passed for `CustomizationTab.tsx`, `image-upload.tsx` and `settings-sidebar-nav.tsx`.
- The only ESLint errors in `admin-sidebar.tsx` are two pre-existing `set-state-in-effect` findings at lines 434 and 449, unrelated to the label-only change in this iteration.
- `git diff --check` passed.
- Admin production build completed successfully with all 148 static pages generated.
- Authenticated browser QA confirmed the new section, three upload positions, preserved current image and fixed portrait recommendation.

## Final result

final result: passed
