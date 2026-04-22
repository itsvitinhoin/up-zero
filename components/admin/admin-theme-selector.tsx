'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

interface AdminThemeSelectorProps {
  compact?: boolean
}

export default function AdminThemeSelector({ compact = false }: AdminThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light'
  const isDark = resolvedTheme === 'dark'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleTheme}
      className={compact ? 'h-8 w-8 p-0' : 'h-9 w-9 p-0'}
      aria-label={`Trocar tema para ${isDark ? 'light' : 'dark'}`}
      title={`Trocar para ${isDark ? 'Light' : 'Dark'}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
