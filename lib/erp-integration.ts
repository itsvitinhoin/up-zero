import type { ErpSettings } from '@/lib/types'

export function getDefaultErpSettings(): ErpSettings {
  return { provider: 'NONE' }
}

export function isErpIntegrated(erpSettings?: ErpSettings | null): boolean {
  const provider = erpSettings?.provider ?? getDefaultErpSettings().provider
  return provider !== 'NONE'
}

export const ERP_BLOCKS_MANUAL_PRODUCT_CREATION_MESSAGE =
  'Produtos devem ser criados pelo ERP integrado.'

export const ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE =
  'Atributos devem ser criados pelo ERP integrado.'

export const ERP_BLOCKS_MANUAL_SKU_EDIT_MESSAGE =
  'Com ERP integrado, SKUs de produto e variantes são gerenciados pelo ERP.'
