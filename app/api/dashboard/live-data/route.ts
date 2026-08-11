import { NextResponse } from 'next/server'
import { checkUserPermission } from '@/lib/actions/permissions'

function readCookieValue(rawCookie: string | null, key: string): string {
  if (!rawCookie) return ''
  const token = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
  if (!token) return ''
  return decodeURIComponent(token.slice(key.length + 1))
}

export async function GET(request: Request) {
  try {
    const permission = await checkUserPermission('reports.view').catch(() => null)
    if (permission?.has_permission !== true) {
      return NextResponse.json({ error: 'Você não tem permissão para visualizar relatórios' }, { status: 403 })
    }

    const base = (process.env.NEXT_PUBLIC_RUST_URL || '').trim().replace(/\/$/, '')
    if (!base) {
      return NextResponse.json({
        orders: [],
        customers: [],
        products: [],
        topVisitedProducts: [],
        topSoldProducts: [],
        sellerLinkFunnels: [],
        errors: {
          orders: 'NEXT_PUBLIC_RUST_URL não configurado',
          customers: 'NEXT_PUBLIC_RUST_URL não configurado',
          products: 'NEXT_PUBLIC_RUST_URL não configurado',
        },
      }, { status: 200 })
    }

    const { searchParams } = new URL(request.url)
    const candidatePaths = [
      '/internal/admin/dashboard-live-data',
      '/dashboard/live-data',
      '/v1/internal/admin/dashboard-live-data',
    ]

    const buildTarget = (path: string) => {
      const target = new URL(`${base}${path}`)
      ;['from', 'to', 'seller', 'state', 'q', 'store_id'].forEach((key) => {
        const value = searchParams.get(key)
        if (value && value.trim()) {
          target.searchParams.set(key, value.trim())
        }
      })

      const customersPage = searchParams.get('customersPage') ?? searchParams.get('customers_page')
      const customersLimit = searchParams.get('customersLimit') ?? searchParams.get('customers_limit')
      const productsPage = searchParams.get('productsPage') ?? searchParams.get('products_page')
      const productsLimit = searchParams.get('productsLimit') ?? searchParams.get('products_limit')

      if (customersPage && customersPage.trim()) target.searchParams.set('customers_page', customersPage.trim())
      if (customersLimit && customersLimit.trim()) target.searchParams.set('customers_limit', customersLimit.trim())
      if (productsPage && productsPage.trim()) target.searchParams.set('products_page', productsPage.trim())
      if (productsLimit && productsLimit.trim()) target.searchParams.set('products_limit', productsLimit.trim())
      return target
    }

    const rawCookie = request.headers.get('cookie')
    const adminToken = readCookieValue(rawCookie, 'adminAuthToken')
    const headers = {
      ...(rawCookie ? { cookie: rawCookie } : {}),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    }

    let response: Response | null = null
    for (const path of candidatePaths) {
      const current = await fetch(buildTarget(path).toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
      response = current
      if (current.status !== 404) {
        break
      }
    }

    if (!response) {
      throw new Error('Nenhuma resposta do backend para dashboard-live-data')
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return NextResponse.json({
        orders: [],
        customers: [],
        products: [],
        topVisitedProducts: [],
        topSoldProducts: [],
        sellerLinkFunnels: [],
        customerPagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
        productPagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
        errors: {
          orders: `Erro dashboard backend (${response.status})`,
          customers: body.slice(0, 120) || `Erro dashboard backend (${response.status})`,
          products: `Erro dashboard backend (${response.status})`,
        },
      }, { status: 200 })
    }

    const payload = await response.json() as {
      orders?: unknown[]
      customers?: unknown[]
      products?: unknown[]
      topVisitedProducts?: unknown[]
      topSoldProducts?: unknown[]
      sellerLinkFunnels?: unknown[]
      customerPagination?: {
        total?: number
        page?: number
        limit?: number
        totalPages?: number
      }
      productPagination?: {
        total?: number
        page?: number
        limit?: number
        totalPages?: number
      }
    }

    const customerPagination = payload.customerPagination ?? {}
    const productPagination = payload.productPagination ?? {}

    return NextResponse.json({
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      products: Array.isArray(payload.products) ? payload.products : [],
      topVisitedProducts: Array.isArray(payload.topVisitedProducts) ? payload.topVisitedProducts : [],
      topSoldProducts: Array.isArray(payload.topSoldProducts) ? payload.topSoldProducts : [],
      sellerLinkFunnels: Array.isArray(payload.sellerLinkFunnels) ? payload.sellerLinkFunnels : [],
      customerPagination: {
        total: Number(customerPagination.total ?? 0),
        page: Number(customerPagination.page ?? 1),
        limit: Number(customerPagination.limit ?? 10),
        totalPages: Number(customerPagination.totalPages ?? 1),
      },
      productPagination: {
        total: Number(productPagination.total ?? 0),
        page: Number(productPagination.page ?? 1),
        limit: Number(productPagination.limit ?? 10),
        totalPages: Number(productPagination.totalPages ?? 1),
      },
      errors: {
        orders: null,
        customers: null,
        products: null,
      },
    })
  } catch {
    return NextResponse.json({
      orders: [],
      customers: [],
      products: [],
      topVisitedProducts: [],
      topSoldProducts: [],
      sellerLinkFunnels: [],
      customerPagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      productPagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      errors: {
        orders: 'Erro ao carregar pedidos',
        customers: 'Erro ao carregar clientes',
        products: 'Erro ao carregar produtos',
      },
    }, { status: 200 })
  }
}
