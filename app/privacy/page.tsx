import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Up Zero',
  description: 'Privacy Policy for Up Zero WhatsApp Business messaging integration.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Up Zero</p>
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: May 6, 2026</p>
        </div>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p>
            Up Zero provides a business messaging dashboard that helps authorized business users connect their Meta Business account and WhatsApp Business Account, manage WhatsApp message templates, send WhatsApp messages using approved templates, and receive customer replies through WhatsApp webhooks.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">Meta and WhatsApp Data We Use</h2>
          <p>
            When a business user connects with Meta, we may process the user&apos;s public profile information, email address, Business Manager name and ID, WhatsApp Business Account name and ID, WhatsApp phone number display information, approved message template metadata, message IDs returned by Meta, webhook delivery statuses, and customer reply content received through WhatsApp webhooks.
          </p>
          <p>
            We do not display access tokens, app secrets, client secrets, bearer tokens, or full credential values in the application interface.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">How We Use This Data</h2>
          <p>
            We use this data only to connect the business user&apos;s WhatsApp Business assets, list and manage message templates, send WhatsApp messages using approved templates, receive customer replies, show inbox and webhook logs, and help the business audit its own messaging workflow.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">Retention and Deletion</h2>
          <p>
            Connection metadata, selected business assets, template metadata, message logs, and webhook events are retained only as long as needed to operate the messaging integration and support business audit needs. A business user may request deletion of connection metadata, message logs, and webhook events at any time.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">Support and Data Removal</h2>
          <p>
            To request support, data export, or removal of Meta and WhatsApp integration data, contact us at{' '}
            <a className="underline underline-offset-4" href="mailto:suporte@upzero.com.br">suporte@upzero.com.br</a>.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-7">
          <h2 className="text-lg font-semibold">Security</h2>
          <p>
            We restrict Meta and WhatsApp data to authorized administrative users and use server-side API calls for sensitive WhatsApp Cloud API operations whenever possible. Secrets must be stored in server environment variables and must not be exposed through public client-side variables.
          </p>
        </section>

        <div className="border-t border-border pt-6 text-sm">
          <Link href="/login" className="underline underline-offset-4">Return to login</Link>
        </div>
      </div>
    </main>
  )
}
