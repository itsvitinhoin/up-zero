'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { Attribute } from '@/lib/actions/attributes'

export interface AttributesContextType {
  attributes: Attribute[]
  colorAttribute?: Attribute
  sizeAttribute?: Attribute
  storeId: number | null
}

const AttributesContext = createContext<AttributesContextType | undefined>(undefined)

interface AttributesProviderProps {
  attributes: Attribute[]
  storeId: number | null
  children: ReactNode
}

export function AttributesProvider({ attributes, storeId, children }: AttributesProviderProps) {
  const colorAttribute = attributes.find((a) => a.code === 'color')
  const sizeAttribute = attributes.find((a) => a.code === 'size')

  const value: AttributesContextType = {
    attributes,
    colorAttribute,
    sizeAttribute,
    storeId,
  }

  return (
    <AttributesContext.Provider value={value}>
      {children}
    </AttributesContext.Provider>
  )
}

export function useAttributes() {
  const context = useContext(AttributesContext)
  if (context === undefined) {
    throw new Error('useAttributes deve ser usado dentro de AttributesProvider')
  }
  return context
}
