import type { ProductGroup, StudioProduct } from "./types";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function normalizeProduct(
  full: unknown,
  storeId: number,
): StudioProduct {
  const data = row(full),
    product = row(data.product);
  if (Number(product.store_id ?? product.storeId) !== storeId)
    throw new Error("Produto não pertence à loja da sessão.");
  let rule: Row = {};
  try {
    rule =
      typeof product.image_grouping_rule === "string"
        ? row(JSON.parse(product.image_grouping_rule))
        : row(product.image_grouping_rule);
  } catch {
    /* invalid rule cannot be published */
  }
  const groupingType = String(rule.type || "unknown");
  const variants = array(data.variants).map(row);
  const groups = new Map<string, ProductGroup>();
  const groupAttrs = new Set(array(rule.attribute_ids).map(Number));
  for (const v of variants) {
    const attrs = array(v.attribute_values).map(row);
    const all = [...attrs]
      .sort((a, b) => Number(a.attribute_id) - Number(b.attribute_id))
      .map((a) => Number(a.value_id ?? a.attribute_value_id ?? a.id))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    const selected = attrs.filter((a) =>
      groupAttrs.has(Number(a.attribute_id)),
    );
    let key =
      typeof v.image_key === "string"
        ? v.image_key
        : typeof v.variant_image_key === "string"
          ? v.variant_image_key
          : "";
    if (!key) {
      if (groupingType === "product") key = "product";
      else if (groupingType === "full_sku" && all.length)
        key = `sku:${all.join("-")}`;
      else if (groupingType === "attributes" && selected.length)
        key = `attr:${selected
          .map((a) => ({
            attribute: Number(a.attribute_id),
            value: Number(a.value_id ?? a.attribute_value_id ?? a.id),
          }))
          .sort((a, b) => a.attribute - b.attribute)
          .map((a) => a.value)
          .join("-")}`;
    }
    if (!key) continue;
    const label =
      (groupingType === "product"
        ? "Todas as variantes"
        : (groupingType === "attributes" ? selected : attrs)
            .map((a) => String(a.value_name ?? a.name ?? a.value_code ?? ""))
            .filter(Boolean)
            .join(" / ")) || String(v.sku || key);
    const group = groups.get(key) || {
      key,
      label,
      variantIds: [],
      images: [],
      displayOrders: [],
    };
    if (Number.isSafeInteger(Number(v.id)) && Number(v.id) > 0)
      group.variantIds.push(Number(v.id));
    group.attributeValueIds = [...new Set([...(group.attributeValueIds || []), ...all])];
    groups.set(key, group);
  }
  for (const raw of array(data.image_groups)) {
    const g = row(raw),
      key = String(g.image_key ?? g.variant_image_key ?? "");
    if (!key) continue;
    const ids = array(g.variants)
      .map((v) => Number(row(v).id ?? row(v).variant_id))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    const existing =
      groups.get(key) ||
      [...groups.values()].find(
        (v) => ids.length > 0 && ids.some((id) => v.variantIds.includes(id)),
      );
    const group = existing || {
      key,
      label: String(g.label ?? key),
      variantIds: ids,
      images: [],
      displayOrders: [],
    };
    if (existing && existing.key !== key) groups.delete(existing.key);
    group.key = key;
    group.images = array(g.images)
      .map((img) =>
        typeof img === "string"
          ? img
          : String(row(img).image_url ?? row(img).url ?? ""),
      )
      .filter(Boolean);
    group.displayOrders = array(g.images)
      .map((img) => Number(row(img).display_order ?? 0))
      .filter(Number.isFinite);
    if (ids.length) group.variantIds = ids;
    groups.set(key, group);
  }
  if (groupingType === "product" && !groups.size)
    groups.set("product", { key: "product", label: "Todas as variantes", variantIds: [], images: [], displayOrders: [] });
  return {
    id: Number(product.id),
    name: String(product.name || ""),
    groupingType,
    groups: [...groups.values()],
  };
}

export function normalizeColors(payload: unknown): import("./types").StudioColor[] {
  return array(payload).map(row)
    .filter((a) => ["color", "colors", "cor", "cores"].includes(String(a.code).toLowerCase()))
    .flatMap((a) => array(a.values).map(row)).map((v) => {
      let meta = row(v.meta);
      if (typeof v.meta === "string") { try { meta = row(JSON.parse(v.meta)); } catch {} }
      let hex = String(meta.rgb || meta.hex || meta.color || meta.hexa || "").replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((c) => c + c).join("");
      return { id: Number(v.id), name: String(v.name || v.code || ""), hex: /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null };
    }).filter((c) => Number.isSafeInteger(c.id) && c.id > 0 && c.name);
}
