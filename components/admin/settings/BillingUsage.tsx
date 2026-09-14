"use client";
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/billing/catalog'
import type { UsageView } from '@/lib/billing/usage'
async function fetchUsage(signal?: AbortSignal): Promise<UsageView> {
  const response = await fetch('/api/billing/usage',{cache:'no-store',signal})
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o consumo.')
  return data
}
export function BillingUsage({ monthlyAmount }: { monthlyAmount: number | null }) {
  const [usage,setUsage] = useState<UsageView | null>(null), [error,setError] = useState(''), [loading,setLoading] = useState(true)
  useEffect(()=>{
    const controller = new AbortController()
    const update = () => { void fetchUsage(controller.signal).then(data=>{if(!controller.signal.aborted){setUsage(data);setError('')}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)}) }
    update(); const timer = setInterval(update,60000)
    return ()=>{controller.abort();clearInterval(timer)}
  },[])
  async function refresh() { setLoading(true); try {setUsage(await fetchUsage());setError('')} catch(e){setError(e instanceof Error?e.message:'Falha ao atualizar.')} finally{setLoading(false)} }
  const available = !error && usage?.whatsapp.available && usage.studio.available
  const total = available ? usage.whatsapp.amount + usage.studio.amount + (monthlyAmount || 0) : null
  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-2"><CardTitle>Uso real e previsão de cobrança</CardTitle><p className="text-sm text-muted-foreground">{usage ? `Mês de referência: ${usage.month.split('-').reverse().join('/')} · horário de Brasília` : 'Consultando consumo…'}</p></div><Button variant="outline" size="sm" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={`mr-2 size-4 ${loading?'animate-spin':''}`} />Atualizar consumo</Button></div></CardHeader>
    <CardContent className="space-y-6">
      {error && <p role="alert" className="text-sm text-destructive">{error} Os dados anteriores podem estar desatualizados.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">WhatsApp · mensalidade dos números</p><p className="mt-2 text-2xl font-semibold">{usage?.whatsapp.available?formatBRL(usage.whatsapp.amount):'—'}</p><p className="mt-1 text-xs text-muted-foreground">{usage?.whatsapp.available?`${usage.whatsapp.count} número(s) conectado(s) × R$ 99,00/mês`:'Integrações não disponíveis'}</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Estúdio IA · consumo do mês</p><p className="mt-2 text-2xl font-semibold">{usage?.studio.available?formatBRL(usage.studio.amount):'—'}</p><p className="mt-1 text-xs text-muted-foreground">{usage?.studio.available?`${usage.studio.count} pacote(s) de 4 fotos × R$ 10,00`:'Consumo não disponível'}</p></div>
        <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">{monthlyAmount===null?'Previsão dos adicionais':'Plano + adicionais estimados'}</p><p className="mt-2 text-2xl font-semibold">{total===null?'—':formatBRL(total)}</p><p className="mt-1 text-xs text-muted-foreground">{monthlyAmount===null?'Mensalidade do plano não incluída.':`Inclui ${formatBRL(monthlyAmount)} do plano.`}</p></div>
      </div>
      <p className="rounded-lg bg-amber-500/10 p-3 text-sm">Previsão, ainda não faturada automaticamente. WhatsApp considera os números conectados agora, sem proporcional por dias. O Estúdio considera um pacote completo por ensaio; ensaios incompletos e tentativas extras não acrescentam valores nesta previsão.</p>
      <section className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Números de WhatsApp integrados</h3><Link href="/mensageria/whatsapp" className="text-sm underline underline-offset-4">Gerenciar números</Link></div>
        {usage?.whatsapp.error ? <p className="text-sm text-muted-foreground">{usage.whatsapp.error}</p> : usage?.whatsapp.numbers.length ? <ul className="divide-y rounded-xl border">{usage.whatsapp.numbers.map(phone=><li key={phone.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{phone.number}</p><p className="text-xs text-muted-foreground">{phone.name}</p></div><div className="flex items-center gap-3"><Badge variant="secondary">{phone.connected?'Conectado':'Conexão não confirmada'}</Badge><span className="text-sm font-medium">{phone.connected?'R$ 99,00/mês':'Fora da previsão'}</span></div></li>)}</ul> : <p className="text-sm text-muted-foreground">{loading?'Consultando números…':'Nenhum número integrado encontrado.'}</p>}
      </section>
      <section className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Detalhamento do Estúdio IA</h3><Link href="/ai-studio" className="text-sm underline underline-offset-4">Abrir Estúdio IA</Link></div>
        {usage?.studio.error ? <p className="text-sm text-muted-foreground">{usage.studio.error}</p> : usage?.studio.jobs.length ? <div className="max-h-96 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Ensaio / cor</th><th className="p-3">Data</th><th className="p-3">Uso</th><th className="p-3">Previsão</th></tr></thead><tbody>{usage.studio.jobs.map(job=><tr key={job.id} className="border-t"><td className="p-3"><p className="font-medium">{job.name}</p><p className="text-xs text-muted-foreground">{job.color}</p></td><td className="whitespace-nowrap p-3">{new Date(job.date).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}{job.legacyDate&&<p className="text-xs text-muted-foreground">Data de criação</p>}</td><td className="p-3"><p>{job.images}/4 fotos · {job.complete?'Pacote completo':'Incompleto'}</p><p className="text-xs text-muted-foreground">{job.attempts} tentativa(s) de geração</p></td><td className="whitespace-nowrap p-3 font-medium">{job.complete?formatBRL(job.amount):'Não incluído'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">{loading?'Consultando ensaios…':'Nenhum ensaio neste mês.'}</p>}
        <p className="text-xs text-muted-foreground">Pacotes novos usam a data da primeira conclusão. Ensaios anteriores sem essa data usam a data de criação. Aprovar, publicar ou baixar as mesmas fotos não adiciona outro pacote.</p>
      </section>
      {usage&&<p className="text-xs text-muted-foreground">Atualizado às {new Date(usage.updatedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})}. Atualização automática a cada minuto.</p>}
    </CardContent>
  </Card>
}
