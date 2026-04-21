'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider } from '@/components/theme-provider'

type RootThemeBoundaryProps = {
  children: React.ReactNode
}

export default function RootThemeBoundary({ children }: RootThemeBoundaryProps) {
  const pathname = usePathname()
  const isApiRoute = pathname?.startsWith('/api')

  if (!pathname || isApiRoute) {
    return <>{children}</>
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme="light"
      storageKey="root-theme"
    >
      {children}
    </ThemeProvider>
  )
}
