"use server";

import { cookies } from "next/headers";
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from "@/lib/actions/storefront-scope";
import { getAdminStoreIdFromToken } from "@/lib/auth";
import { checkUserPermission } from "@/lib/actions/permissions";
import { InstitutionalPage } from "@/lib/types";

const RUST_URL = process.env.NEXT_PUBLIC_RUST_URL;

async function hasPagePermission(permissionCode: string): Promise<boolean> {
  try {
    const result = await checkUserPermission(permissionCode);
    return result?.has_permission === true;
  } catch {
    return false;
  }
}

function normalizeStoreId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function mapInstitutionalPage(raw: any): InstitutionalPage {
  return {
    id: Number(raw?.id ?? 0),
    store_id: Number(raw?.store_id ?? raw?.storeId ?? 0),
    title: String(raw?.title ?? ""),
    slug: String(raw?.slug ?? ""),
    meta: raw?.meta ?? {},
    is_active: raw?.is_active == null ? Boolean(raw?.isActive ?? true) : Boolean(raw?.is_active),
    created_at: typeof raw?.created_at === "string" ? raw.created_at : (typeof raw?.createdAt === "string" ? raw.createdAt : undefined),
    updated_at: typeof raw?.updated_at === "string" ? raw.updated_at : (typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined),
  };
}

async function resolveScopedStoreId(preferredStoreId?: number | null): Promise<number | null> {
  const explicitStoreId = normalizeStoreId(preferredStoreId);
  if (explicitStoreId) return explicitStoreId;

  const adminStoreId = await getAdminStoreIdFromToken();
  return normalizeStoreId(adminStoreId);
}

async function buildScopedHeaders(preferredStoreId?: number | null, withJsonContentType = false) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("adminAuthToken")?.value;
  const scopedStoreId = await resolveScopedStoreId(preferredStoreId);
  const apiKey = await resolveStorefrontApiKeyFromRequest(scopedStoreId);

  const baseHeaders: Record<string, string> = {
    ...(withJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(adminToken ? { cookie: `adminAuthToken=${adminToken}` } : {}),
  };

  return {
    scopedStoreId,
    apiKey,
    headers: withStorefrontScopeHeaders(baseHeaders, apiKey),
  };
}

export async function getInstitutionalPagesAction(storeId?: number): Promise<InstitutionalPage[]> {
  try {
    const { scopedStoreId, apiKey, headers } = await buildScopedHeaders(storeId);

    if (!apiKey) {
      console.error('API key da loja não resolvida para páginas institucionais', {
        storeId,
        scopedStoreId,
      });
      return [];
    }

    const url = new URL(`${RUST_URL}/pages`);
    if (scopedStoreId) {
      url.searchParams.set("store_id", String(scopedStoreId));
    }

    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch pages", await res.text());
      return [];
    }

    const payload = await res.json();
    return Array.isArray(payload) ? payload.map((item) => mapInstitutionalPage(item)) : [];
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export async function getInstitutionalPageAction(id: number, storeId?: number): Promise<InstitutionalPage | null> {
  try {
    const { scopedStoreId, apiKey, headers } = await buildScopedHeaders(storeId);
    if (!apiKey) {
      console.error('API key da loja não resolvida para página institucional por id', {
        id,
        storeId,
        scopedStoreId,
      });
      return null;
    }

    const url = new URL(`${RUST_URL}/pages/${id}`);
    if (scopedStoreId) {
      url.searchParams.set("store_id", String(scopedStoreId));
    }

    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status !== 404) console.error("Failed to fetch page", await res.text());
      return null;
    }

    const payload = await res.json();
    return mapInstitutionalPage(payload);
  } catch (error) {
    console.error("Error fetching page:", error);
    return null;
  }
}

export async function getInstitutionalPageBySlugAction(
  storeId: number,
  slug: string
): Promise<InstitutionalPage | null> {
  try {
    const scopedStoreId = await resolveScopedStoreId(storeId);
    const apiKey = await resolveStorefrontApiKeyFromRequest(scopedStoreId);

    if (!apiKey) {
      console.error('API key da loja não resolvida para página institucional por slug', {
        storeId,
        scopedStoreId,
        slug,
      });
      return null;
    }

    const url = `${RUST_URL}/pages/slug/${slug}`;

    const res = await fetch(url, {
      headers: withStorefrontScopeHeaders({}, apiKey),
      next: { revalidate: 60, tags: [`page-${slug}`] },
    });

    if (!res.ok) {
      if (res.status !== 404) console.error("Failed to fetch page by slug", await res.text());
      return null;
    }

    const payload = await res.json();
    return mapInstitutionalPage(payload);
  } catch (error) {
    console.error("Error fetching page by slug:", error);
    return null;
  }
}

export async function createInstitutionalPageAction(data: {
  storeId: number;
  title: string;
  slug: string;
  meta: any;
  isActive: boolean;
}): Promise<{ success: boolean; data?: InstitutionalPage; error?: string }> {
  if (!(await hasPagePermission("pages.create"))) {
    return { success: false, error: "Você não tem permissão para criar páginas" };
  }

  try {
    const { scopedStoreId, apiKey, headers } = await buildScopedHeaders(data.storeId, true);
    if (!apiKey || !scopedStoreId) {
      return { success: false, error: "Store scope não resolvido para criar página" };
    }

    const url = new URL(`${RUST_URL}/pages`);
    url.searchParams.set("store_id", String(scopedStoreId));

    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: data.title,
        slug: data.slug,
        meta: data.meta,
        is_active: data.isActive,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      return { success: false, error: msg };
    }

    const payload = await res.json();
    const page = mapInstitutionalPage(payload);
    return { success: true, data: page };
  } catch (error: any) {
    console.error("Error creating page:", error);
    return { success: false, error: error.message };
  }
}

export async function updateInstitutionalPageAction(
  id: number,
  data: {
    title?: string;
    slug?: string;
    meta?: any;
    isActive?: boolean;
  }
): Promise<{ success: boolean; data?: InstitutionalPage; error?: string }> {
  if (!(await hasPagePermission("pages.edit"))) {
    return { success: false, error: "Você não tem permissão para editar páginas" };
  }

  try {
    const { scopedStoreId, apiKey, headers } = await buildScopedHeaders(undefined, true);
    if (!apiKey) {
      return { success: false, error: "Store scope não resolvido para atualizar página" };
    }

    const url = new URL(`${RUST_URL}/pages/${id}`);
    if (scopedStoreId) {
      url.searchParams.set("store_id", String(scopedStoreId));
    }

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers,
      body: JSON.stringify({
        title: data.title,
        slug: data.slug,
        meta: data.meta,
        is_active: data.isActive,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      return { success: false, error: msg };
    }

    const payload = await res.json();
    const page = mapInstitutionalPage(payload);
    return { success: true, data: page };
  } catch (error: any) {
    console.error("Error updating page:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteInstitutionalPageAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (!(await hasPagePermission("pages.delete"))) {
    return { success: false, error: "Você não tem permissão para excluir páginas" };
  }

  try {
    const { scopedStoreId, apiKey, headers } = await buildScopedHeaders();
    if (!apiKey) {
      return { success: false, error: "Store scope não resolvido para remover página" };
    }

    const url = new URL(`${RUST_URL}/pages/${id}`);
    if (scopedStoreId) {
      url.searchParams.set("store_id", String(scopedStoreId));
    }

    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const msg = await res.text();
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting page:", error);
    return { success: false, error: error.message };
  }
}
