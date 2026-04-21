import { SmartListBuilderClient } from '@/components/admin/smart-lists/smart-list-builder-client'

export const metadata = {
  title: 'Nova Smart List | Admin',
}

export const dynamic = 'force-dynamic'

export default function NewSmartListPage() {
  return <SmartListBuilderClient />
}
