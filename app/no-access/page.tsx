import Link from 'next/link'

export const metadata = {
  title: 'Sem acesso',
}

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sem permissao para acessar esta pagina</h1>
      <p className="text-sm text-muted-foreground">
        Sua conta esta autenticada, mas nao possui a permissao necessaria para este recurso.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Voltar ao inicio
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Trocar usuario
        </Link>
      </div>
    </main>
  )
}
