'use client'
import { Button } from '@/components/ui/button'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="grid min-h-screen place-content-center gap-4 p-8 text-center"><h1 className="text-xl font-semibold">O Master está indisponível no momento</h1><p className="text-muted-foreground">Não foi possível validar o acesso. Tente novamente em instantes.</p><Button onClick={reset}>Tentar novamente</Button></main>
}
