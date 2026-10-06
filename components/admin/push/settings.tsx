'use client'

import { useState } from 'react'
import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { type PushSettings } from '@/lib/push/types'
import { Field, PushPage, usePushView } from './shared'
import { Choice } from './audience-filters'

export function PushSettingsPage() {
  const data = usePushView(true), [form, setForm] = useState<PushSettings | null>(null)
  const currentForm = form ?? data.view?.settings
  return <PushPage title="Configurações de Push" description="Configure o canal do aplicativo e as regras de comunicação da sua loja." data={data} configuration>
    <AdminPanel title="Integração do aplicativo" description="O canal utiliza Firebase Cloud Messaging para Android e iOS. As credenciais ficam no servidor."><div className="space-y-3">{[['Serviço de envio', data.view?.readiness.provider], ['Integração de eventos do app', data.view?.readiness.events], ['Persistência', data.view?.readiness.storage]].map(([label, ready]) => <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border p-3"><p className="text-sm">{label}</p><Badge variant={ready ? 'default' : 'secondary'}>{ready ? 'Configurado' : 'Pendente'}</Badge></div>)}</div><p className="mt-4 text-sm text-muted-foreground">O aplicativo precisa registrar seus dispositivos, preferências e eventos de compra. No iOS, a integração também depende da configuração de APNs no Firebase.</p></AdminPanel>
    {currentForm ? <AdminPanel title="Regras do canal" description="Horários e limites comerciais não atrasam a notificação operacional de pedido B2B2C."><div className="space-y-5"><div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><p className="font-medium">Habilitar Push para esta loja</p><p className="text-sm text-muted-foreground">Ative quando a integração do aplicativo estiver configurada.</p></div><Switch aria-label="Habilitar Push para esta loja" checked={currentForm.enabled} disabled={!data.view?.canEdit || (!currentForm.enabled && (!data.view?.readiness.provider || !data.view?.readiness.events))} onCheckedChange={enabled => setForm({ ...currentForm, enabled })} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Fuso horário"><Choice label="Fuso horário" value={currentForm.timezone} onChange={timezone => setForm({ ...currentForm, timezone })} options={[["America/Sao_Paulo","Brasília — America/Sao_Paulo"],["America/Manaus","Manaus — America/Manaus"],["America/Rio_Branco","Rio Branco — America/Rio_Branco"],["America/Noronha","Fernando de Noronha — America/Noronha"]]} disabled={!data.view?.canEdit} /></Field><Field label="Limite diário de mensagens comerciais por pessoa"><Input aria-label="Limite diário de mensagens" type="number" min="1" max="20" disabled={!data.view?.canEdit} value={currentForm.dailyLimit} onChange={e => setForm({ ...currentForm, dailyLimit: Number(e.target.value) })} /></Field><Field label="Início do horário de silêncio"><Input aria-label="Início do horário de silêncio" type="time" disabled={!data.view?.canEdit} value={currentForm.quietStart} onChange={e => setForm({ ...currentForm, quietStart: e.target.value })} /></Field><Field label="Fim do horário de silêncio" hint="Use horários iguais para permitir envios durante todo o dia."><Input aria-label="Fim do horário de silêncio" type="time" disabled={!data.view?.canEdit} value={currentForm.quietEnd} onChange={e => setForm({ ...currentForm, quietEnd: e.target.value })} /></Field></div><div className="flex justify-end"><Button disabled={data.busy || !data.view?.canEdit} onClick={() => void data.run('settings.save', currentForm, 'Configurações de Push salvas.')}>Salvar configurações</Button></div></div></AdminPanel> : null}
  </PushPage>
}
