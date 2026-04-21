"use server";

import { cookies } from "next/headers";
import { resolveStorefrontApiKeyFromRequest, withStorefrontScopeHeaders } from "@/lib/actions/storefront-scope";
import { Category, InstitutionalPage } from "@/lib/types";

const RUST_URL = process.env.NEXT_PUBLIC_RUST_URL;

export async function getInstitutionalPagesAction(storeId: number): Promise<InstitutionalPage[]> {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("adminAuthToken")?.value;
    const apiKey = await resolveStorefrontApiKeyFromRequest(storeId);

    if (!apiKey) {
      console.error('API key da loja não resolvida para páginas institucionais', { storeId })
      return []
    }

    const url = `${RUST_URL}/pages`;

    const res = await fetch(url, {
      headers: withStorefrontScopeHeaders({
        ...(adminToken && { cookie: `adminAuthToken=${adminToken}` }),
      }, apiKey),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch pages", await res.text());
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export async function getInstitutionalPageAction(id: number): Promise<InstitutionalPage | null> {
  try {
    const res = await fetch(`${RUST_URL}/pages/${id}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status !== 404) console.error("Failed to fetch page", await res.text());
      return null;
    }

    return await res.json();
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
    const apiKey = await resolveStorefrontApiKeyFromRequest(storeId);

    if (!apiKey) {
      console.error('API key da loja não resolvida para página institucional por slug', { storeId, slug })
      return null
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

    return await res.json();
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
  try {
    const res = await fetch(`${RUST_URL}/pages?store_id=${data.storeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    const page = await res.json();
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
  try {
    const res = await fetch(`${RUST_URL}/pages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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

    const page = await res.json();
    return { success: true, data: page };
  } catch (error: any) {
    console.error("Error updating page:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteInstitutionalPageAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${RUST_URL}/pages/${id}`, {
      method: "DELETE",
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
