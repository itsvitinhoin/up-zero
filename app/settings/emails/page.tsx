import { EmailsTab } from "@/components/admin/settings/EmailsTab"

export const metadata = {
  title: "E-mails | Configurações",
}

export default function SettingsEmailsPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-lg font-medium text-foreground">E-mails</h1>
        <p className="text-sm text-muted-foreground">
          Configure os modelos e acompanhe o histórico de comunicação da loja.
        </p>
      </div>
      <EmailsTab />
    </div>
  )
}
