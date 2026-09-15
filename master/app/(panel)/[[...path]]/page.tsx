import { notFound } from 'next/navigation'
import { WorkspaceView } from '../../../components/workspace-view'
const sections = ['', 'lojas', 'clientes', 'modulos', 'financeiro', 'relatorios', 'equipe', 'historico']
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params
  if (!(path.length <= 1 && sections.includes(path[0] ?? '')) && !(path.length === 2 && path[0] === 'lojas' && /^[1-9]\d*$/.test(path[1]))) notFound()
  return <WorkspaceView section={path[0] ?? ''} storeId={path[1] ? Number(path[1]) : undefined} />
}
