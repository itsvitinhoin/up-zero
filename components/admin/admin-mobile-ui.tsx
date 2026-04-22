"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function AdminPage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-h-full space-y-5 px-4 pb-24 pt-4 sm:px-5 lg:space-y-6 lg:px-8 lg:pb-8 lg:pt-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AdminHero({
  icon: Icon,
  title,
  description,
  actions,
  eyebrow,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/95 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            {eyebrow ? (
              <Badge variant="outline" className="h-7 rounded-full px-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {eyebrow}
              </Badge>
            ) : null}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                {Icon ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {actions ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}

export function AdminStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon?: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
  }

  return (
    <Card className="border-border/60 bg-card/95 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {Icon ? (
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tones[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("border-border/60 bg-card/95 shadow-sm", className)}>
      <CardContent className="p-3 sm:p-4">{children}</CardContent>
    </Card>
  )
}

export function AdminPanel({
  title,
  description,
  children,
  action,
  className,
}: {
  title?: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("border-border/60 bg-card/95 shadow-sm", className)}>
      {title || description || action ? (
        <CardHeader className="space-y-2 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title ? <CardTitle className="text-base sm:text-lg">{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {action}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn("p-4 pt-0 sm:p-5 sm:pt-0", !title && !description && !action && "pt-4 sm:pt-5")}>
        {children}
      </CardContent>
    </Card>
  )
}

export function MobileCardList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("space-y-3 lg:hidden", className)}>{children}</div>
}

export function DesktopOnly({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("hidden lg:block", className)}>{children}</div>
}
