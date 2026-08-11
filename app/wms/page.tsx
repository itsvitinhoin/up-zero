import { redirect } from 'next/navigation'

export const metadata = { title: 'WMS | Admin' }

export default function WmsRootPage() {
  redirect('/wms/receipts')
}
