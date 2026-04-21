'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch } from '@/lib/types'

const BRANCH_COOKIE_KEY = 'ADMIN_BRANCH_ID'

interface AdminBranchContextValue {
  /** All active branches for the current store */
  branches: Branch[]
  /** Currently selected branch id. null = "All branches" aggregated view */
  activeBranchId: string | null
  /** Resolved Branch object for the active branch, or null for "all" */
  activeBranch: Branch | null
  /**
   * Switch the active branch filter.
   * Persists to cookie so it survives page navigation and SSR refresh.
   * Triggers router.refresh() to reload server components with the new filter.
   */
  setActiveBranch: (id: string | null) => void
}

const AdminBranchContext = createContext<AdminBranchContextValue | undefined>(undefined)

interface AdminBranchProviderProps {
  children: ReactNode
  initialBranches: Branch[]
  /** Initial active branch id, read from cookie server-side */
  initialBranchId: string | null
}

export function AdminBranchProvider({
  children,
  initialBranches,
  initialBranchId,
}: AdminBranchProviderProps) {
  const router = useRouter()
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(initialBranchId)

  const setActiveBranch = useCallback(
    (id: string | null) => {
      setActiveBranchIdState(id)
      if (typeof document !== 'undefined') {
        if (id) {
          document.cookie = `${BRANCH_COOKIE_KEY}=${id}; path=/; max-age=2592000; samesite=lax`
        } else {
          document.cookie = `${BRANCH_COOKIE_KEY}=; path=/; max-age=0; samesite=lax`
        }
      }
      // Refresh server components so pages can read the updated cookie
      router.refresh()
    },
    [router],
  )

  const activeBranch =
    activeBranchId !== null
      ? (initialBranches.find((b) => b.id === activeBranchId) ?? null)
      : null

  return (
    <AdminBranchContext.Provider
      value={{ branches: initialBranches, activeBranchId, activeBranch, setActiveBranch }}
    >
      {children}
    </AdminBranchContext.Provider>
  )
}

export function useAdminBranch() {
  const context = useContext(AdminBranchContext)
  if (context === undefined) {
    throw new Error('useAdminBranch must be used within AdminBranchProvider')
  }
  return context
}
