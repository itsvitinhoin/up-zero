export function resolveAdminLoginRedirect(value?: string | string[]): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/'
  try {
    const url = new URL(value, 'https://admin.invalid')
    if (url.origin !== 'https://admin.invalid' || url.pathname === '/login') return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
