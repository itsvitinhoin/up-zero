import { requireBillingAdmin } from '@/lib/billing/auth'
import { getBillingUsage } from '@/lib/billing/usage-server'
import { BillingError } from '@/lib/billing/types'
export async function GET(request: Request) {
  const headers = {'Cache-Control':'private, no-store'}
  try { const admin = await requireBillingAdmin(request); return Response.json(await getBillingUsage(admin.storeId),{headers}) }
  catch(error) { return Response.json({error:error instanceof BillingError ? error.message : 'Não foi possível consultar o consumo.'},{status:error instanceof BillingError ? error.status : 503,headers}) }
}
