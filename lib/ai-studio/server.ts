import { cookies } from "next/headers";
import {
  isLocalAdminToken,
  verifyLocalAdminToken,
} from "@/lib/local-admin-session";
import { normalizeProduct } from "./catalog";

export class StudioError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Admin = { storeId: number; userId: string; cookie: string };
export async function backend(
  admin: Pick<Admin, "cookie">,
  pathname: string,
  init: RequestInit = {},
) {
  const base = process.env.NEXT_PUBLIC_RUST_URL;
  if (!base)
    throw new StudioError(503, "O backend de produtos não está configurado.");
  return fetch(new URL(pathname, base), {
    ...init,
    headers: { ...init.headers, cookie: admin.cookie },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}
export async function requireAdmin(request: Request): Promise<Admin> {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (
      !origin ||
      new URL(origin).host !== host ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new StudioError(403, "Origem da solicitação inválida.");
  }
  const token = (await cookies()).get("adminAuthToken")?.value;
  if (!token)
    throw new StudioError(401, "Entre no Admin para acessar o Estúdio.");
  const cookie = `adminAuthToken=${token}`;
  // Unlike legacy UI auth, AI billing must never trust an unsigned JWT fallback.
  if (process.env.NODE_ENV !== "production" && isLocalAdminToken(token)) {
    const local = await verifyLocalAdminToken(
      token,
      process.env.LOCAL_ADMIN_SESSION_SECRET ||
        process.env.LOCAL_ADMIN_PASSWORD ||
        "",
    );
    if (local)
      return {
        storeId: Number(local.store_id),
        userId: String(local.sub),
        cookie,
      };
  }
  const me = await backend({ cookie }, "/admin/me");
  if (!me.ok) throw new StudioError(401, "Sessão expirada.");
  const user = await me.json();
  const storeId = Number(user.store_id ?? user.storeId);
  if (
    user.authenticated === false ||
    !Number.isSafeInteger(storeId) ||
    storeId <= 0 ||
    !(user.id ?? user.admin_id)
  )
    throw new StudioError(
      403,
      "Não foi possível validar o administrador e a loja.",
    );
  const permission = await backend(
    { cookie },
    "/permissions/check?code=products.manage_images",
  );
  if (!permission.ok || (await permission.json()).has_permission !== true)
    throw new StudioError(
      403,
      "Você precisa da permissão de gerenciar imagens de produtos.",
    );
  return { storeId, userId: String(user.id ?? user.admin_id), cookie };
}
export async function getProduct(admin: Admin, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new StudioError(400, "Produto inválido.");
  const response = await backend(admin, `/products/${id}/full`);
  if (!response.ok)
    throw new StudioError(
      response.status === 404 ? 404 : 502,
      "Não foi possível consultar o produto.",
    );
  try {
    return normalizeProduct(await response.json(), admin.storeId);
  } catch {
    throw new StudioError(403, "Produto indisponível nesta loja.");
  }
}
