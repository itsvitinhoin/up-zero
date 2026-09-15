import { redirect } from 'next/navigation'
import { getMasterSession, getWorkspace } from '../../lib/server'
import { MasterError } from '../../lib/contracts'
import { MasterShell } from '../../components/master-shell'
export const dynamic = 'force-dynamic'
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getMasterSession().catch(error => {
    if (error instanceof MasterError && [401, 403].includes(error.status)) redirect('/login')
    throw error
  })
  const data = await getWorkspace()
  return <MasterShell session={session} initialData={data}>{children}</MasterShell>
}
