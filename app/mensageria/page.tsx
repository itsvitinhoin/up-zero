import { Suspense } from 'react'
import AdminMensageriaPageClient from '@/components/admin/admin-mensageria-page-client'
import { getMensageriaOverviewAction } from '@/lib/actions/messaging'
import type { ReactElement } from 'react'
import type { MessageFlow, MessageTemplate, WhatsAppConfig } from '@/lib/types'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

type MensageriaInitialData = {
  whatsappConfig: WhatsAppConfig
  templates: MessageTemplate[]
  flows: MessageFlow[]
}

const AdminMensageriaPageClientWithInitial = AdminMensageriaPageClient as unknown as (
  props: { initialData?: MensageriaInitialData }
) => ReactElement

export const metadata = {
  title: 'Automações | Admin',
  description: 'Configure automacoes, fluxos e integracao de WhatsApp Business',
}

export const instant = false

export default function AdminMensageriaPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminMensageriaPageContent />
    </Suspense>
  )
}

async function AdminMensageriaPageContent() {
  const result = await getMensageriaOverviewAction()
  const initialData = result.success && result.data
    ? result.data
    : undefined

  return <AdminMensageriaPageClientWithInitial initialData={initialData} />
}
