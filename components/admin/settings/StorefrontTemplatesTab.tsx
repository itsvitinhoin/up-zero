"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import { Check, ExternalLink, LayoutTemplate, Loader2, Palette, Rocket } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminStore } from "@/contexts/admin-store-context"
import { installStorefrontTemplateAction } from "@/lib/actions/settings"
import { getStorefrontHref } from "@/lib/storefront-url"
import {
  STOREFRONT_TEMPLATES,
  type StorefrontTemplateKey,
} from "@/lib/storefront-templates"
import type { SiteSettings } from "@/lib/types"

interface StorefrontTemplatesTabProps {
  settings: SiteSettings
  setSettings: Dispatch<SetStateAction<SiteSettings | null>>
  canEdit: boolean
}

function TemplatePreview({ templateKey }: { templateKey: StorefrontTemplateKey }) {
  if (templateKey === "groovy") {
    return (
      <div className="aspect-[16/9] overflow-hidden rounded-t-xl border-b bg-[#e2e2e2]">
        <div className="h-4 bg-[#151515]" />
        <div className="flex h-10 items-center justify-between bg-white px-5">
          <div className="h-2 w-20 rounded-full bg-neutral-800" />
          <div className="flex gap-2">
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
            <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
          </div>
        </div>
        <div className="h-[62%] bg-gradient-to-br from-neutral-300 via-neutral-100 to-neutral-400" />
        <div className="grid grid-cols-2 gap-2 bg-white p-3">
          <div className="h-7 bg-neutral-200" />
          <div className="h-7 bg-neutral-300" />
        </div>
      </div>
    )
  }

  return (
    <div className="aspect-[16/9] overflow-hidden rounded-t-xl border-b bg-white">
      <div className="flex h-12 items-center justify-between border-b px-5">
        <div className="h-2 w-16 rounded-full bg-primary/70" />
        <div className="flex gap-2">
          <span className="h-1.5 w-8 rounded-full bg-muted-foreground/25" />
          <span className="h-1.5 w-8 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
      <div className="m-3 h-[55%] rounded bg-muted" />
      <div className="mx-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => <span key={index} className="h-8 rounded bg-muted" />)}
      </div>
    </div>
  )
}

export function StorefrontTemplatesTab({ settings, setSettings, canEdit }: StorefrontTemplatesTabProps) {
  const { session } = useAdminStore()
  const [installing, setInstalling] = useState<StorefrontTemplateKey | null>(null)
  const activeKey = settings.customization.templateKey === "groovy" ? "groovy" : "classic"

  async function installAndPublish(templateKey: StorefrontTemplateKey) {
    const template = STOREFRONT_TEMPLATES[templateKey]
    const confirmed = window.confirm(
      `Instalar e publicar o template ${template.name}? O conteúdo existente será preservado e opções incompatíveis ficarão desabilitadas.`,
    )
    if (!confirmed) return

    setInstalling(templateKey)
    try {
      const result = await installStorefrontTemplateAction(templateKey)
      if (!result.success || !result.data) {
        toast.error(result.error || "Não foi possível publicar o template")
        return
      }
      setSettings(result.data)
      toast.success(`Template ${template.name} instalado e publicado`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar o template")
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5" />
                Templates da Vitrine
              </CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                Visualize, instale e publique layouts sem perder banners ou configurações. O editor de Aparência se adapta automaticamente às capacidades do tema ativo.
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings/appearance">
                <Palette className="mr-2 h-4 w-4" />
                Editar tema ativo
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {(Object.values(STOREFRONT_TEMPLATES) as Array<(typeof STOREFRONT_TEMPLATES)[StorefrontTemplateKey]>).map((template) => {
          const isActive = activeKey === template.key
          const previewStoreId = template.previewStoreId || session?.storeId
          const previewHref = getStorefrontHref(previewStoreId)
          const canPreview = Boolean(template.previewStoreId || isActive)
          const isInstalling = installing === template.key

          return (
            <Card key={template.key} className={isActive ? "overflow-hidden border-primary shadow-sm" : "overflow-hidden"}>
              <TemplatePreview templateKey={template.key} />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                  {isActive ? (
                    <Badge className="gap-1"><Check className="h-3 w-3" />Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Disponível</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  {template.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {highlight}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  {canPreview ? (
                    <Button asChild variant="outline">
                      <a href={previewHref} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver prévia
                      </a>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>Prévia após instalar</Button>
                  )}
                  <Button
                    type="button"
                    disabled={!canEdit || installing !== null}
                    onClick={() => void installAndPublish(template.key)}
                  >
                    {isInstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    {isActive ? "Republicar" : "Instalar e publicar"}
                  </Button>
                </div>

                {isActive && settings.customization.templatePublishedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Última publicação: {new Date(settings.customization.templatePublishedAt).toLocaleString("pt-BR")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
