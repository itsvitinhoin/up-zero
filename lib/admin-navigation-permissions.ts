const PRODUCT_MENU_VIEW_CODE = 'products.view'
const ORDER_MENU_VIEW_CODE = 'orders.view'
const ORDER_CREATE_CODE = 'orders.create'
const CUSTOMER_MENU_VIEW_CODE = 'customers.view'
const OFFLINE_CUSTOMERS_VIEW_CODE = 'offline.view_customers'
const OFFLINE_SELLERS_VIEW_CODE = 'offline.view_sellers'
const OFFLINE_ORDERS_VIEW_CODE = 'offline.view_orders'
const OFFLINE_ASSIGNMENT_VIEW_CODE = 'offline.view_assignment'
const PRICES_MENU_VIEW_CODE = 'prices.view'
const PAGES_MENU_VIEW_CODE = 'pages.view'
const CUSTOM_LINKS_MENU_VIEW_CODE = 'custom_links.view'
const MESSAGING_MENU_VIEW_CODE = 'messaging.view'
const ASSETS_MENU_VIEW_CODE = 'assets.view'
const ASSETS_EDIT_CODE = 'assets.edit'
const INVENTORY_MENU_VIEW_CODE = 'inventory.view'
const INVENTORY_MANAGE_MOVEMENTS_CODE = 'inventory.manage_movements'
const SETTINGS_MENU_VIEW_CODE = 'settings.view'
const SETTINGS_MANAGE_ROLES_CODE = 'settings.manage_roles'
const USERS_MENU_VIEW_CODE = 'users.view'

function normalizePermissionCodes(permissionCodes?: string[]): Set<string> | null {
  if (!Array.isArray(permissionCodes)) return null

  const normalized = permissionCodes
    .map((code) => String(code || '').trim().toLowerCase())
    .filter(Boolean)

  return new Set(normalized)
}

export function canAccessNavHref(
  href: string,
  permissionCodes?: string[],
  options?: { isSystemRole?: boolean },
): boolean {
  const normalizedHref = String(href || '').trim().toLowerCase()
  if (!normalizedHref) return true

  const permissionSet = normalizePermissionCodes(permissionCodes)
  const isSystemRole = options?.isSystemRole === true

  if (isSystemRole) return true

  // Sem contexto de permissões ainda: não bloqueia navegação para evitar regressão.
  if (!permissionSet) return true

  if (normalizedHref === '/') {
    return true
  }

  if (normalizedHref === '/products') {
    return permissionSet.has(PRODUCT_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/custom-links' || normalizedHref.startsWith('/custom-links/')) {
    return permissionSet.has(CUSTOM_LINKS_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/assets/showcase' || normalizedHref.startsWith('/assets/showcase/')) {
    return permissionSet.has(ASSETS_EDIT_CODE)
  }

  if (normalizedHref === '/assets' || normalizedHref.startsWith('/assets/')) {
    return permissionSet.has(ASSETS_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/wms/receipts') {
    return permissionSet.has(INVENTORY_MANAGE_MOVEMENTS_CODE)
  }

  if (normalizedHref === '/wms' || normalizedHref.startsWith('/wms/')) {
    return permissionSet.has(INVENTORY_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/users' || normalizedHref.startsWith('/users/')) {
    return permissionSet.has(USERS_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/settings/permissions') {
    return permissionSet.has(SETTINGS_MANAGE_ROLES_CODE)
  }

  if (normalizedHref === '/settings' || normalizedHref.startsWith('/settings/')) {
    return permissionSet.has(SETTINGS_MENU_VIEW_CODE)
  }

  if (
    normalizedHref === '/whatsapp'
    || normalizedHref.startsWith('/whatsapp/')
    || normalizedHref === '/mensageria'
    || normalizedHref.startsWith('/mensageria/')
    || normalizedHref === '/smart-lists'
    || normalizedHref.startsWith('/smart-lists/')
    || normalizedHref === '/campaigns'
    || normalizedHref.startsWith('/campaigns/')
  ) {
    return permissionSet.has(MESSAGING_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/customers') {
    return permissionSet.has(CUSTOMER_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/offline/customers' || normalizedHref.startsWith('/offline/customers/')) {
    return permissionSet.has(OFFLINE_CUSTOMERS_VIEW_CODE)
  }

  if (normalizedHref === '/offline/sellers' || normalizedHref.startsWith('/offline/sellers/')) {
    return permissionSet.has(OFFLINE_SELLERS_VIEW_CODE)
  }

  if (normalizedHref === '/offline/orders' || normalizedHref.startsWith('/offline/orders/')) {
    return permissionSet.has(OFFLINE_ORDERS_VIEW_CODE)
  }

  if (
    normalizedHref === '/offline/attribution'
    || normalizedHref.startsWith('/offline/attribution/')
    || normalizedHref === '/offline/conflicts'
    || normalizedHref.startsWith('/offline/conflicts/')
  ) {
    return permissionSet.has(OFFLINE_ASSIGNMENT_VIEW_CODE)
  }

  if (normalizedHref === '/offline' || normalizedHref.startsWith('/offline/')) {
    return (
      permissionSet.has(OFFLINE_CUSTOMERS_VIEW_CODE)
      || permissionSet.has(OFFLINE_SELLERS_VIEW_CODE)
      || permissionSet.has(OFFLINE_ORDERS_VIEW_CODE)
      || permissionSet.has(OFFLINE_ASSIGNMENT_VIEW_CODE)
    )
  }

  if (
    normalizedHref === '/orders'
    || normalizedHref === '/orders/invoices'
    || normalizedHref === '/orders/labels'
    || normalizedHref === '/payment-links'
    || normalizedHref === '/carrinhos-abandonados'
  ) {
    return permissionSet.has(ORDER_MENU_VIEW_CODE)
  }

  if (normalizedHref === '/orders/new') {
    return permissionSet.has(ORDER_CREATE_CODE)
  }

  if (
    normalizedHref === '/sales-channels'
    || normalizedHref === '/price-tables'
    || normalizedHref === '/tier-discounts'
    || normalizedHref === '/coupons'
  ) {
    return permissionSet.has(PRICES_MENU_VIEW_CODE)
  }

  if (
    normalizedHref === '/pages/menu'
    || normalizedHref === '/pages/institutional'
    || normalizedHref.startsWith('/pages/')
  ) {
    return permissionSet.has(PAGES_MENU_VIEW_CODE)
  }

  return true
}
