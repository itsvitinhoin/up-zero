'use server'

import {
  ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE,
  ERP_BLOCKS_MANUAL_PRODUCT_CREATION_MESSAGE,
  isErpIntegrated,
} from '@/lib/erp-integration'
import { getSiteSettingsAction } from '@/lib/actions/settings'

export async function getStoreErpIntegrationStatus(): Promise<{ integrated: boolean }> {
  const result = await getSiteSettingsAction(undefined, { include: { erp: true } })
  if (!result.success || !result.data) {
    return { integrated: false }
  }

  return { integrated: isErpIntegrated(result.data.erpSettings) }
}

export async function assertManualProductCreationAllowed(): Promise<
  { allowed: true } | { allowed: false; error: string }
> {
  const { integrated } = await getStoreErpIntegrationStatus()
  if (integrated) {
    return { allowed: false, error: ERP_BLOCKS_MANUAL_PRODUCT_CREATION_MESSAGE }
  }

  return { allowed: true }
}

export async function assertManualAttributeCreationAllowed(): Promise<
  { allowed: true } | { allowed: false; error: string }
> {
  const { integrated } = await getStoreErpIntegrationStatus()
  if (integrated) {
    return { allowed: false, error: ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE }
  }

  return { allowed: true }
}
