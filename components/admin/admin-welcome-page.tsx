type AdminWelcomePageProps = {
  userName: string
}

export default function AdminWelcomePage({ userName }: AdminWelcomePageProps) {
  const trimmedName = String(userName || '').trim()
  const firstName = trimmedName.split(/\s+/)[0] || 'Admin'

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-8 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Painel administrativo
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Olá, {firstName}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Bem-vinda ao admin. Use o menu ao lado para acessar as áreas liberadas para o seu perfil.
        </p>
      </div>
    </div>
  )
}
