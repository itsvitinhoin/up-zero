import { redirect } from 'next/navigation'

export const instant = false

export const metadata = {
  title: 'Filiais | Admin',
  description: 'Gerenciar filiais e URLs segmentadas da loja',
}

export default function AdminBranchesPage() {
  redirect('/settings/branches')
}
