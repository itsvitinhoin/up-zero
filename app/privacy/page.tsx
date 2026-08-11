import type { Metadata } from 'next'
import { FileText, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Privacy Policy | Up Zero Mensageria',
  description: 'Privacy policy for Meta and WhatsApp Business messaging data processed by Up Zero.',
}

const sections = [
  {
    title: 'Meta data',
    text: 'We use Meta Login only to let an authenticated business user connect their own Meta Business assets. We may process the user profile, email, Business Manager, WhatsApp Business Account, phone number metadata and granted permission status needed to operate the messaging workflow.',
  },
  {
    title: 'WhatsApp data',
    text: 'We process WhatsApp Business Account data, phone number metadata, message template metadata, outbound message status and inbound customer replies received through Meta webhooks.',
  },
  {
    title: 'Templates',
    text: 'Message templates are used to create, review, select and send approved WhatsApp Business templates. Pending or rejected templates are not used for outbound sends until they are approved by Meta.',
  },
  {
    title: 'Contacts and campaigns',
    text: 'Contacts, opt-in status, tags, lists and campaign settings are used to segment audiences and prevent sending WhatsApp campaigns to contacts without opt-in.',
  },
  {
    title: 'Messages and webhooks',
    text: 'Messages sent by the app and replies received through WhatsApp webhooks are stored so the business can audit delivery, view the inbox and respond within the applicable customer service window.',
  },
  {
    title: 'Logs and retention',
    text: 'Operational logs store timestamps, event types, safe payloads, sanitized errors and recommended actions. We do not intentionally store access tokens, app secrets, client secrets or bearer tokens in logs.',
  },
  {
    title: 'Deletion',
    text: 'A business user may request deletion of integration records, contacts, lists, campaigns, messages and logs. Deletion requests are handled by support after identity and account ownership are confirmed.',
  },
]

export default function PrivacyHubPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.35)_100%)] text-foreground">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/95 p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Public policy
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Up Zero Mensageria helps a business connect Meta Business and WhatsApp Business assets, manage templates,
                send approved WhatsApp messages, create campaigns, receive replies and audit logs.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PolicyFact icon={FileText} label="App" value="Up Zero Mensageria" />
          <PolicyFact icon={Mail} label="Support" value="support@upzero.app" />
          <PolicyFact icon={FileText} label="Route" value="/privacy" />
        </div>

        <div className="grid gap-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-border/60 bg-card/95 p-5 shadow-sm">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.text}</p>
            </article>
          ))}
        </div>

        <article className="rounded-lg border border-border/60 bg-card/95 p-5 shadow-sm">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              To request access, correction or deletion, contact support at <strong className="text-foreground">support@upzero.app</strong>.
              We will verify the business account before making changes to Meta or WhatsApp related records.
            </p>
          </div>
        </article>
      </div>
    </main>
  )
}

function PolicyFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
