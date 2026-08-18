import Link from 'next/link'
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react'

export type BilingualLegalSection = {
  titlePt: string
  titleEn: string
  paragraphsPt: readonly string[]
  paragraphsEn: readonly string[]
  itemsPt?: readonly string[]
  itemsEn?: readonly string[]
}

type LegalDocumentPageProps = {
  currentPath: '/privacy' | '/terms' | '/data-deletion'
  titlePt: string
  titleEn: string
  summaryPt: string
  summaryEn: string
  sections: readonly BilingualLegalSection[]
  calloutPt?: string
  calloutEn?: string
}

const legalLinks = [
  { href: '/privacy', labelPt: 'Privacidade', labelEn: 'Privacy' },
  { href: '/terms', labelPt: 'Termos de Uso', labelEn: 'Terms of Service' },
  { href: '/data-deletion', labelPt: 'Exclusão de dados', labelEn: 'Data deletion' },
] as const

export function LegalDocumentPage({
  currentPath,
  titlePt,
  titleEn,
  summaryPt,
  summaryEn,
  sections,
  calloutPt,
  calloutEn,
}: LegalDocumentPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.35)_100%)] text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/70 p-5 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Documento público · Public document
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">UP Zero · Grupo UP</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{titlePt}</h1>
                  <p className="mt-1 text-xl text-muted-foreground">{titleEn}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Última atualização · Last updated</p>
                <p className="mt-1">15 de agosto de 2026 · August 15, 2026</p>
              </div>
            </div>

            <nav className="mt-7 flex flex-wrap gap-2" aria-label="Documentos legais / Legal documents">
              {legalLinks.map((link) => {
                const isCurrent = link.href === currentPath
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={
                      isCurrent
                        ? 'rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background'
                        : 'rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted'
                    }
                  >
                    {link.labelPt} · {link.labelEn}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="grid gap-px bg-border lg:grid-cols-2">
            <div className="bg-card p-5 sm:p-7" lang="pt-BR">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Português</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{summaryPt}</p>
            </div>
            <div className="bg-card p-5 sm:p-7" lang="en">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">English</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{summaryEn}</p>
            </div>
          </div>
        </header>

        {calloutPt && calloutEn ? (
          <aside className="mt-5 grid gap-px overflow-hidden rounded-xl border border-primary/25 bg-primary/20 lg:grid-cols-2">
            <p className="bg-card p-5 text-sm leading-6" lang="pt-BR">{calloutPt}</p>
            <p className="bg-card p-5 text-sm leading-6" lang="en">{calloutEn}</p>
          </aside>
        ) : null}

        <div className="mt-5 space-y-4">
          {sections.map((section, index) => (
            <article key={`${section.titlePt}-${index}`} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border/70 bg-muted/25 px-5 py-4 sm:px-6">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-semibold">{section.titlePt}</h2>
                  <p className="text-sm text-muted-foreground">{section.titleEn}</p>
                </div>
              </div>

              <div className="grid gap-px bg-border lg:grid-cols-2">
                <LegalLanguageContent language="pt-BR" label="Português" paragraphs={section.paragraphsPt} items={section.itemsPt} />
                <LegalLanguageContent language="en" label="English" paragraphs={section.paragraphsEn} items={section.itemsEn} />
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Canal oficial para dúvidas e solicitações: acesse o site da UP Zero e selecione Contato ou Suporte.</p>
              <p lang="en">Official channel for questions and requests: visit the UP Zero website and select Contact or Support.</p>
              <a
                href="https://upzero.com.br/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4"
              >
                upzero.com.br
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

function LegalLanguageContent({
  language,
  label,
  paragraphs,
  items,
}: {
  language: 'pt-BR' | 'en'
  label: string
  paragraphs: readonly string[]
  items?: readonly string[]
}) {
  return (
    <div className="bg-card p-5 sm:p-6" lang={language}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {items && items.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 marker:text-primary">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
