import { NextRequest, NextResponse } from 'next/server';
import { getAdminStoreIdFromToken } from '@/lib/auth';
import { resolveStorefrontApiKeyFromRequest } from '@/lib/actions/storefront-scope';

interface ExportProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  basePrice: number;
  cost: number | null;
  colors: string;
  sizes: string;
  isActive: string;
  isFeatured: string;
}

interface ExportRequest {
  products?: ExportProduct[];
  timestamp: string;
  fetchAll?: boolean;
  search?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const timeoutMs = Math.max(
      30_000,
      Number.parseInt(process.env.EXPORT_RUST_TIMEOUT_MS || '180000', 10) || 180_000,
    );
    const requestApiKey = request.headers.get('x-api-key')?.trim() || '';
    const adminStoreId = await getAdminStoreIdFromToken();
    const userScopedApiKey = await resolveStorefrontApiKeyFromRequest(adminStoreId);
    const rustApiKey =
      requestApiKey ||
      userScopedApiKey ||
      process.env.RUST_API_KEY?.trim() ||
      '';

    // Chamar API do Rust para gerar arquivo
    const configuredBaseUrl =
      process.env.RUST_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_RUST_URL?.trim() ||
      '';

    if (!configuredBaseUrl) {
      throw new Error('URL do Rust não configurada. Defina RUST_API_URL ou NEXT_PUBLIC_RUST_URL.');
    }

    const rustApiCandidates = [configuredBaseUrl.replace(/\/+$/, '')];

    let excelResponse: Response | null = null;
    let lastError: unknown = null;
    let lastHttpError: string | null = null;
    let lastUrl = '';

    for (const baseUrl of rustApiCandidates) {
      const endpoint = `${baseUrl}/api/export/products/excel`;
      const categoriesEndpoint = `${baseUrl}/categories`;
      const cookieHeader = request.headers.get('cookie') ?? '';
      lastUrl = endpoint;
      try {
        let productsToExport = Array.isArray(body.products) ? body.products : [];

        if (body.fetchAll === true) {
          const categoryById = new Map<string, string>();
          const categoriesRes = await fetch(categoriesEndpoint, {
            headers: {
              ...(rustApiKey ? { 'x-api-key': rustApiKey } : {}),
              ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            signal: AbortSignal.timeout(timeoutMs),
            cache: 'no-store',
          });

          if (categoriesRes.ok) {
            const categoriesJson = await categoriesRes.json();
            if (Array.isArray(categoriesJson)) {
              for (const category of categoriesJson) {
                const id = String(category?.id ?? '');
                const name = String(category?.name ?? '');
                if (id && name) {
                  categoryById.set(id, name);
                }
              }
            }
          }

          const limit = 100;
          let page = 1;
          let total = 0;
          const allItems: any[] = [];

          while (true) {
            const productsUrl = new URL('/products-paginated', baseUrl);
            productsUrl.searchParams.set('page', String(page));
            productsUrl.searchParams.set('limit', String(limit));
            productsUrl.searchParams.set('summary', 'true');
            if (body.search && body.search.trim().length > 0) {
              productsUrl.searchParams.set('search', body.search.trim());
            }

            const productsRes = await fetch(productsUrl.toString(), {
              headers: {
                ...(rustApiKey ? { 'x-api-key': rustApiKey } : {}),
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
              },
              signal: AbortSignal.timeout(timeoutMs),
              cache: 'no-store',
            });

            if (!productsRes.ok) {
              const reason = await productsRes.text().catch(() => '');
              if (productsRes.status === 401 && !rustApiKey) {
                lastHttpError = 'X-API-Key ausente. A chave deve vir do usuário logado (escopo da loja) ou da env RUST_API_KEY.';
                throw new Error(lastHttpError);
              }
              lastHttpError = `Falha ao listar produtos na página ${page}: ${productsRes.status} ${reason}`;
              throw new Error(lastHttpError);
            }

            const paginated = await productsRes.json();
            const items = Array.isArray(paginated?.items) ? paginated.items : [];
            total = Number(paginated?.total ?? 0);
            allItems.push(...items);

            if (items.length === 0 || allItems.length >= total) {
              break;
            }

            page += 1;
          }

          productsToExport = allItems.map((item: any) => {
            const product = item?.product || item || {};
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const categoryIds = Array.isArray(item?.category_ids) ? item.category_ids : [];

            const firstVariant = variants[0] || {};
            const colors = new Set<string>();
            const sizes = new Set<string>();
            const images = new Set<string>();

            for (const variant of variants) {
              if (Array.isArray(variant?.images)) {
                for (const image of variant.images) {
                  if (typeof image === 'string' && image.length > 0) {
                    images.add(image);
                  }
                }
              }

              const attrs = Array.isArray(variant?.attribute_values) ? variant.attribute_values : [];
              for (const attr of attrs) {
                const code = String(attr?.attribute_code || '').trim().toLowerCase();
                const name = String(attr?.attribute_name || '').trim().toLowerCase();
                const valueName = String(attr?.value_name || '').trim();
                if (!valueName) continue;

                if (['color', 'colors', 'cor', 'cores'].includes(code) || name.includes('cor') || name.includes('color')) {
                  colors.add(valueName);
                }

                if (['size', 'sizes', 'tamanho', 'tamanhos'].includes(code) || name.includes('tamanho') || name.includes('size')) {
                  sizes.add(valueName.toUpperCase());
                }
              }
            }

            const categoryName = categoryIds.length > 0
              ? categoryById.get(String(categoryIds[0])) || '-'
              : '-';

            return {
              id: String(product?.id || ''),
              name: String(product?.name || ''),
              sku: String(product?.code || ''),
              category: categoryName,
              description: String(product?.description || ''),
              basePrice: Number(firstVariant?.price_cents ?? 0) / 100,
              cost: typeof firstVariant?.cost_cents === 'number' ? Number(firstVariant.cost_cents) / 100 : null,
              colors: Array.from(colors).join(', '),
              sizes: Array.from(sizes).join(', '),
              isActive: product?.active === false ? 'Inativo' : 'Ativo',
              isFeatured: 'Não',
            } as ExportProduct;
          });
        }

        if (!Array.isArray(productsToExport) || productsToExport.length === 0) {
          return NextResponse.json(
            { message: 'Nenhum produto para exportar' },
            { status: 400 }
          );
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(rustApiKey ? { 'x-api-key': rustApiKey } : {}),
          },
          body: JSON.stringify({
            products: productsToExport,
            timestamp: body.timestamp,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          excelResponse = response;
          break;
        }

        lastHttpError = `HTTP ${response.status} ao chamar ${endpoint}`;
        lastError = new Error(lastHttpError);
      } catch (error) {
        lastError = error;
      }
    }

    if (!excelResponse) {
      const cause = lastHttpError || (lastError instanceof Error ? lastError.message : String(lastError));
      throw new Error(
        `Falha ao conectar no serviço Rust de exportação. Endpoints testados: ${rustApiCandidates.join(', ')}. Ultimo erro: ${cause}`
      );
    }

    if (!excelResponse.ok) {
      const errorText = await excelResponse.text();
      console.error('Erro do Rust:', errorText, 'endpoint:', lastUrl);
      throw new Error(`Erro ao gerar arquivo: ${excelResponse.statusText}`);
    }

    // Repassar arquivo gerado pelo Rust
    const buffer = await excelResponse.arrayBuffer();
    const contentType = excelResponse.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition =
      excelResponse.headers.get('content-disposition') ||
      `attachment; filename="produtos-${new Date().toISOString().split('T')[0]}.xlsx"`;
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error('Erro ao exportar produtos:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao exportar produtos',
      },
      { status: 500 }
    );
  }
}
