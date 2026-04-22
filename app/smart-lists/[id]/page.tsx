import { notFound } from 'next/navigation'
import { getSmartListAction } from '@/lib/actions/smart-lists'
import { SmartListDetailClient } from '@/components/admin/smart-lists/smart-list-detail-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SmartListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getSmartListAction(id)
  if (!result.success || !result.data) notFound()
  return <SmartListDetailClient list={result.data} />
}
