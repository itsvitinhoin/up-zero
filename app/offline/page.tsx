import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Offline | Admin',
  description: 'Dados sincronizados do ERP da loja física',
}

export default function OfflinePage() {
  redirect('/offline/customers')
}
