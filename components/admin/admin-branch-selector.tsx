'use client'

import {
  GitBranch,
  ChevronDown,
  Check,
  Globe,
  CircleDot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAdminBranch } from '@/contexts/admin-branch-context'

/**
 * Global branch filter selector.
 * Renders in the sidebar below the "Ver Vitrine" button.
 * Persists the selected branch to a cookie and triggers router.refresh()
 * so server components reload with the new branch scope.
 *
 * Hidden when there are no branches (graceful degradation).
 */
export function AdminBranchSelector() {
  const { branches, activeBranchId, activeBranch, setActiveBranch } = useAdminBranch()

  if (branches.length === 0) return null

  const label = activeBranch ? activeBranch.name : 'Todas as Filiais'

  return (
    <div className="px-4 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-9 justify-between px-3 rounded-2xl border-border/60 bg-muted/30 text-[12px] font-medium gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              {activeBranch ? (
                <CircleDot className={`h-3 w-3 shrink-0 ${activeBranch.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
              ) : (
                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{label}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={4} className="w-60">
          {/* All branches option */}
          <DropdownMenuItem
            onClick={() => setActiveBranch(null)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">Todas as Filiais</span>
            {activeBranchId === null && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>

          {branches.length > 0 && <DropdownMenuSeparator />}

          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => setActiveBranch(branch.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  branch.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/25'
                }`}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{branch.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">/{branch.slug}</span>
              </div>
              {activeBranchId === branch.id && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
