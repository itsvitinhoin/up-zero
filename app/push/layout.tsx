import { Suspense, type ReactNode } from 'react'
import { ensureAdminPermission } from '@/lib/server-admin-permissions'
import { AdminRouteSkeleton } from '@/components/admin/admin-route-skeleton'
async function Authorized({ children }: { children: ReactNode }) { await ensureAdminPermission('messaging.view'); return children }
export default function PushLayout({ children }: { children: ReactNode }) { return <Suspense fallback={<AdminRouteSkeleton />}><Authorized>{children}</Authorized></Suspense> }
