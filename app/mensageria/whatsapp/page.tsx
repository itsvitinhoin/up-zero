import { Suspense } from 'react'
import MensageriaContent from './mensageria-content'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'

export const metadata = {
  title: 'WhatsApp | Mensageria',
  description: 'Gerenciar WhatsApp Business e automações de mensagens',
}

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <WhatsAppPageContent />
    </Suspense>
  )
}

async function WhatsAppPageContent() {
  const cookieStore = await cookies()
  if (!cookieStore.get('adminAuthToken')?.value) {
    redirect('/login')
  }

  return <MensageriaContent />
}
