'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Plus, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SessionUser } from '@/lib/types'
import { useAdminBranch } from '@/contexts/admin-branch-context'

type AdminMobileHeaderProps = {
  session?: SessionUser | null
  storeName?: string
}

export default function AdminMobileHeader({ session: _session, storeName }: AdminMobileHeaderProps) {
  const pathname = usePathname()
  const effectiveStoreName = storeName?.trim() || 'Nome da loja'
  const { activeBranch } = useAdminBranch()

  if (pathname === '/login') return null

  return (
    <div className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-card/95 px-4 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <Image
          src="/icon.png"
          alt="Logo"
          width={26}
          height={26}
          className="h-7 w-7 rounded-xl object-contain shrink-0"
        />
        <div className="min-w-0">
          <span className="block truncate whitespace-nowrap text-sm font-semibold leading-tight">
            {effectiveStoreName}
          </span>
          {activeBranch && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground leading-tight">
              <GitBranch className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{activeBranch.name}</span>
            </span>
          )}
        </div>
      </div>

      <Link href="/orders/new">
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" aria-label="Novo pedido">
          <Plus className="h-5 w-5" />
        </Button>
      </Link>
    </div>
  )
}
