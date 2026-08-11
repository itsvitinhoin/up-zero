'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { SessionUser, Category } from '@/lib/types'

export interface AdminStoreInfo {
  id?: number | string
  name?: string
  slug?: string
  email?: string
  maintenanceMode?: boolean
}

interface AdminStoreContextValue {
  session: SessionUser | null
  store: AdminStoreInfo | null
  isLoggedIn: boolean
  categories: Category[]
  storefrontUrl: string
}

const AdminStoreContext = createContext<AdminStoreContextValue | undefined>(undefined)

interface AdminStoreProviderProps {
  children: ReactNode
  session: SessionUser | null
  store: AdminStoreInfo | null
  isLoggedIn: boolean
  initialCategories?: Category[]
  storefrontUrl?: string
}

export function AdminStoreProvider({
  children,
  session,
  store,
  isLoggedIn,
  initialCategories = [],
  storefrontUrl = '/',
}: AdminStoreProviderProps) {
  const value: AdminStoreContextValue = {
    session,
    store,
    isLoggedIn,
    categories: initialCategories,
    storefrontUrl,
  }

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>
}

export function useAdminStore() {
  const context = useContext(AdminStoreContext)
  if (context === undefined) {
    throw new Error('useAdminStore must be used within AdminStoreProvider')
  }
  return context
}
