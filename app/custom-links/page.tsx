import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Share2, MousePointerClick, TrendingUp } from 'lucide-react'
import { CustomLinksCreateButton, CustomLinksListClient } from '@/components/admin/custom-links-list-client'
import { listCustomLinksAction } from '@/lib/actions/custom-links'
import Loading from './loading'

export const metadata = {
  title: 'Links Personalizados | Admin',
}

export const instant = false

export default function CustomLinksPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomLinksPageContent />
    </Suspense>
  )
}

async function CustomLinksPageContent() {
  const linksResult = await listCustomLinksAction()
  const links = linksResult.success && linksResult.data ? linksResult.data : []
  const metrics = {
    totalLinksGenerated: links.length,
    totalClicks: links.reduce((sum, link) => sum + Number(link.clicks || 0), 0),
    totalOrders: links.reduce((sum, link) => sum + Number(link.orders || 0), 0),
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Links Personalizados</h1>
          <p className="text-muted-foreground text-sm mt-1">Crie e gerencie links com produtos selecionados</p>
        </div>
        <CustomLinksCreateButton />
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Links Gerados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{metrics.totalLinksGenerated}</div>
            <p className="text-xs text-muted-foreground mt-1">links personalizados criados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-blue-500" />
              Cliques no Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{metrics.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">cliques totais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Vendas do Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">pedidos gerados</p>
          </CardContent>
        </Card>
      </div>

      <CustomLinksListClient links={links} />
    </div>
  )
}
