'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type AdminAuthGuardProps = {
  isLoggedIn: boolean
  children: React.ReactNode
}

export default function AdminAuthGuard({ isLoggedIn, children }: AdminAuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isPublicRoute = pathname === '/login' || pathname === '/privacy'

  useEffect(() => {
    if (!isLoggedIn && !isPublicRoute) {
      router.replace('/login')
    }
  }, [isLoggedIn, isPublicRoute, router])

  return <>{children}</>
}
