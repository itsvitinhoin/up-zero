'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AudienceFilters } from '@/lib/push/types'
import { Field } from './shared'

export function Choice({ value, onChange, options, label, disabled }: { value: string; onChange: (value: string) => void; options: [string, string][]; label: string; disabled?: boolean }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select>
}
export function AudienceFilterForm({ value, onChange }: { value: AudienceFilters; onChange: (value: AudienceFilters) => void }) {
  const set = (key: keyof AudienceFilters, next: string | number | null) => onChange({ ...value, [key]: next })
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nome"><Input aria-label="Nome do cliente" placeholder="Nome ou razão social" value={value.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="CNPJ / CPF"><Input aria-label="CNPJ ou CPF" placeholder="Documento completo ou parcial" value={value.document} onChange={e => set('document', e.target.value)} /></Field>
      <Field label="Status do cadastro"><Choice label="Status do cadastro" value={value.status} onChange={v => set('status', v)} options={[["ALL","Todos"],["PENDING","Pendente"],["APPROVED","Aprovado"],["REJECTED","Rejeitado"]]} /></Field>
      <Field label="Dispositivo"><Choice label="Dispositivo" value={value.platform} onChange={v => set('platform', v)} options={[["ALL","Android e iOS"],["ANDROID","Android"],["IOS","iOS"]]} /></Field>
      <Field label="Cadastro no aplicativo" hint="Identificado pelo registro do dispositivo no app."><Choice label="Cadastro no aplicativo" value={value.installed} onChange={v => set('installed', v)} options={[["YES","Já cadastrou dispositivo no app"],["NO","Ainda não cadastrou dispositivo"],["ALL","Todos os cadastrados"]]} /></Field>
      <Field label="Fez pedido no período"><Choice label="Fez pedido no período" value={value.hasOrdered} onChange={v => set('hasOrdered', v)} options={[["ALL","Todos"],["YES","Sim"],["NO","Não"]]} /></Field>
    </div>
    <div className="rounded-xl border p-4 space-y-4"><div><p className="text-sm font-semibold">Período e quantidade de compras</p><p className="mt-1 text-xs text-muted-foreground">Pedidos cancelados e estornados são excluídos. A quantidade conta compras confirmadas ou pagas no período.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Período das compras"><Choice label="Tipo de período das compras" value={value.orderLastDays ? 'rolling' : 'fixed'} onChange={v => onChange({ ...value, orderLastDays: v === 'rolling' ? 30 : 0, orderFrom: '', orderTo: '' })} options={[["fixed","Datas específicas / todo o histórico"],["rolling","Últimos dias — atualiza diariamente"]]} /></Field>
        {value.orderLastDays ? <Field label="Últimos dias"><Input aria-label="Últimos dias" type="number" min="1" max="3650" value={value.orderLastDays} onChange={e => set('orderLastDays', Math.max(1, Number(e.target.value)))} /></Field> : <><Field label="Compras a partir de"><Input aria-label="Compras a partir de" type="date" value={value.orderFrom} onChange={e => set('orderFrom', e.target.value)} /></Field><Field label="Compras até"><Input aria-label="Compras até" type="date" value={value.orderTo} onChange={e => set('orderTo', e.target.value)} /></Field></>}
        <Field label="Quantidade mínima de compras"><Input aria-label="Quantidade mínima de compras" type="number" min="0" placeholder="Sem mínimo" value={value.minPurchases ?? ''} onChange={e => set('minPurchases', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        <Field label="Quantidade máxima de compras"><Input aria-label="Quantidade máxima de compras" type="number" min="0" placeholder="Sem máximo" value={value.maxPurchases ?? ''} onChange={e => set('maxPurchases', e.target.value === '' ? null : Number(e.target.value))} /></Field>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Cadastro no app a partir de"><Input aria-label="Cadastro no app a partir de" type="date" value={value.downloadFrom} onChange={e => set('downloadFrom', e.target.value)} /></Field><Field label="Cadastro no app até"><Input aria-label="Cadastro no app até" type="date" value={value.downloadTo} onChange={e => set('downloadTo', e.target.value)} /></Field></div>
  </div>
}
