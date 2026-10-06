import { Suspense } from 'react'
import { PushCampaignEditor } from '@/components/admin/push/campaign-editor'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
export const metadata = { title: 'Nova campanha de Push | Admin' }
async function Editor({ searchParams }: { searchParams: Promise<{ draft?: string }> }) { const { draft } = await searchParams; return <PushCampaignEditor draft={draft} /> }
export default function Page({ searchParams }: { searchParams: Promise<{ draft?: string }> }) { return <Suspense fallback={<AdminRouteSkeleton />}><Editor searchParams={searchParams} /></Suspense> }
