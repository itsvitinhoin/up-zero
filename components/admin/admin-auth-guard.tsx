'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type AdminAuthGuardProps = {
  isLoggedIn: boolean
  children: React.ReactNode
}

const PUBLIC_ROUTES = ['/login', '/privacy', '/politica-de-privacidade']

export default function AdminAuthGuard({ isLoggedIn, children }: AdminAuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
      router.replace('/login')
    }
  }, [isLoggedIn, pathname, router])

  return <>{children}</>
}
