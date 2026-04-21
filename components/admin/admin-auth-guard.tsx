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

  useEffect(() => {
    if (!isLoggedIn && pathname !== '/login') {
      router.replace('/login')
    }
  }, [isLoggedIn, pathname, router])

  return <>{children}</>
}
