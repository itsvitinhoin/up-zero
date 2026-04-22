import { getBranchesAction, getAdminUsersForSelectAction } from '@/lib/actions/branches'
import AdminBranchesPageClient from '@/components/admin/admin-branches-page-client'
import { adminMockBranches, withAdminMockBranches } from '@/lib/admin-mock-data'
import type { Branch } from '@/lib/types'
import type { AdminUserOption } from '@/lib/actions/branches'

export const metadata = {
  title: 'Filiais | Admin',
  description: 'Gerenciar filiais e URLs segmentadas da loja',
}

export default async function AdminBranchesPage() {
  const [branchesResult, adminsResult] = await Promise.all([
    getBranchesAction(),
    getAdminUsersForSelectAction(),
  ])

  const initialBranches: Branch[] = withAdminMockBranches(
    branchesResult.success && branchesResult.data ? branchesResult.data : []
  )

  const adminUsers: AdminUserOption[] = adminsResult.success && adminsResult.data
    ? adminsResult.data
    : []

  return (
    <AdminBranchesPageClient
      initialBranches={initialBranches}
      adminUsers={adminUsers}
    />
  )
}
