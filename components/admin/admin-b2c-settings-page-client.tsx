'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CheckCircle2,
  Copy,
  Filter,
  ListFilter,
  MapPin,
  Pencil,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { updateB2CSettingsAction } from '@/lib/actions/b2c-leads'
import type {
  B2CDistributionMode,
  B2CDistributionSettings,
  B2CResellerLevel,
  B2CResellerList,
  B2CResellerListPriority,
  EligibleB2CReseller,
} from '@/lib/b2c-leads/types'
import { cn } from '@/lib/utils'

const MODES: Array<{ value: B2CDistributionMode; title: string; description: string }> = [
  { value: 'MANUAL', title: 'Manual', description: 'A marca escolhe o revendedor em cada pedido.' },
  { value: 'AUTOMATIC', title: 'Automática', description: 'A roleta distribui por região, prioridade e menor carga.' },
  { value: 'TIERED', title: 'Por níveis', description: 'As listas Preferencial, Gold, Silver e Bronze definem a ordem.' },
]

const PRIORITY_LABELS: Record<B2CResellerListPriority, string> = {
  PREFERRED: 'Preferencial',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
}

const PRIORITY_TONES: Record<B2CResellerListPriority, string> = {
  PREFERRED: 'border-primary/20 bg-primary/10 text-primary',
  GOLD: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  SILVER: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  BRONZE: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
}

export function AdminB2CSettingsPageClient({
  initialSettings,
  resellers,
  initialError,
}: {
  initialSettings: B2CDistributionSettings
  resellers: EligibleB2CReseller[]
  initialError: string | null
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [editingList, setEditingList] = useState<B2CResellerList | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeLists = useMemo(() => settings.resellerLists.filter((list) => list.enabled), [settings.resellerLists])
  const activeResellerIds = useMemo(
    () => new Set(activeLists.flatMap((list) => resellers.filter((reseller) => resellerMatchesList(reseller, list)).map((reseller) => reseller.id))),
    [activeLists, resellers],
  )

  const saveSettings = () => {
    startTransition(async () => {
      const enabledResellerIds = [...activeResellerIds]
      const preferredResellerIds = resellers
        .filter((reseller) => activeLists.some((list) => list.priority === 'PREFERRED' && resellerMatchesList(reseller, list)))
        .map((reseller) => reseller.id)
      const resellerLevels = Object.fromEntries(resellers.map((reseller) => [
        reseller.id,
        effectiveResellerLevel(reseller, activeLists),
      ])) as Record<string, B2CResellerLevel>
      const resellerDirectory = resellers.map((reseller) => ({ ...reseller, level: resellerLevels[reseller.id] || 'BRONZE' }))
      const result = await updateB2CSettingsAction({
        ...settings,
        enabledResellerIds,
        preferredResellerIds,
        resellerLevels,
        resellerDirectory,
      })
      if (!result.success || !result.data) {
        toast.error(result.error || 'Não foi possível salvar as configurações B2C.')
        return
      }
      setSettings(result.data)
      toast.success('Configurações de distribuição B2C salvas.')
    })
  }

  const saveList = (list: B2CResellerList) => {
    setSettings((current) => ({
      ...current,
      resellerLists: current.resellerLists.some((item) => item.id === list.id)
        ? current.resellerLists.map((item) => item.id === list.id ? list : item)
        : [...current.resellerLists, list],
    }))
    setEditingList(null)
  }

  const createList = () => {
    const now = new Date().toISOString()
    setEditingList({
      id: `list-${Date.now().toString(36)}`,
      name: '',
      description: '',
      enabled: true,
      priority: 'BRONZE',
      filters: {
        requireApproved: true,
        requirePreviousOrder: true,
        maxDaysSinceLastOrder: 90,
        minOrders: 1,
        minTotalSpent: 0,
        states: [],
      },
      includedResellerIds: [],
      excludedResellerIds: [],
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <div className="space-y-6 p-6 pb-28 lg:p-8 lg:pb-28">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">Configure as regras de distribuição e as listas de revendedores do canal B2C.</p>
      </div>

      {initialError ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{initialError}</div>
      ) : null}

      <Card id="distribution-mode" className="scroll-mt-6 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-primary" />Distribuição B2C</CardTitle>
          <CardDescription>Defina como os pedidos entram na roleta. As listas abaixo determinam quem pode receber cada oportunidade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup
            value={settings.mode}
            onValueChange={(value) => setSettings((current) => ({ ...current, mode: value as B2CDistributionMode }))}
            className="grid gap-3 lg:grid-cols-3"
          >
            {MODES.map((mode) => (
              <Label
                key={mode.value}
                htmlFor={`mode-${mode.value}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/40',
                  settings.mode === mode.value && 'border-primary/50 bg-primary/5',
                )}
              >
                <RadioGroupItem id={`mode-${mode.value}`} value={mode.value} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">{mode.title}</span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{mode.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Priorizar revendedores da mesma UF</p>
              <p className="text-xs text-muted-foreground">Quando houver empate, a roleta usa o estado informado pela consumidora.</p>
            </div>
            <Switch
              checked={settings.filters.prioritizeSameState}
              onCheckedChange={(checked) => setSettings((current) => ({ ...current, filters: { ...current.filters, prioritizeSameState: checked } }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="reseller-lists" className="scroll-mt-6 border-border/50">
        <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:grid-rows-[auto_auto]">
          <CardTitle className="flex items-center gap-2 text-base"><ListFilter className="h-5 w-5 text-primary" />Listas de revendedores</CardTitle>
          <CardDescription>Crie grupos por filtros e atribua um nível. Um revendedor pode participar de mais de uma lista.</CardDescription>
          <Button onClick={createList} className="mt-3 w-full rounded-full sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />Nova lista
          </Button>
        </CardHeader>
        <CardContent>
          {settings.resellerLists.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
              <UsersRound className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma lista criada</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">Crie uma lista e use filtros de compra, localização ou aprovação para montar a roleta.</p>
              <Button onClick={createList} variant="outline" className="mt-4 rounded-full"><Plus className="mr-2 h-4 w-4" />Criar primeira lista</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.resellerLists.map((list) => {
                const count = resellers.filter((reseller) => resellerMatchesList(reseller, list)).length
                return (
                  <div key={list.id} className={cn('rounded-xl border border-border/60 p-4 transition-colors', !list.enabled && 'bg-muted/30 opacity-70')}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Filter className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{list.name}</p>
                            <Badge variant="outline" className={cn('rounded-full font-normal', PRIORITY_TONES[list.priority])}>{PRIORITY_LABELS[list.priority]}</Badge>
                            {!list.enabled ? <Badge variant="secondary" className="rounded-full font-normal">Pausada</Badge> : null}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{list.description || summarizeFilters(list)}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{count} revendedor{count === 1 ? '' : 'es'}</span>
                            <span>{summarizeFilters(list)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 self-end lg:self-auto">
                        <Switch
                          checked={list.enabled}
                          onCheckedChange={(checked) => setSettings((current) => ({ ...current, resellerLists: current.resellerLists.map((item) => item.id === list.id ? { ...item, enabled: checked, updatedAt: new Date().toISOString() } : item) }))}
                          aria-label={`${list.enabled ? 'Pausar' : 'Ativar'} ${list.name}`}
                          className="mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={() => setEditingList(list)} aria-label={`Editar ${list.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Duplicar ${list.name}`}
                          onClick={() => {
                            const now = new Date().toISOString()
                            setSettings((current) => ({ ...current, resellerLists: [...current.resellerLists, { ...list, id: `list-${Date.now().toString(36)}`, name: `${list.name} (cópia)`, createdAt: now, updatedAt: now }] }))
                          }}
                        ><Copy className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Excluir ${list.name}`}
                          onClick={() => setSettings((current) => ({ ...current, resellerLists: current.resellerLists.filter((item) => item.id !== list.id) }))}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="wheel-rules" className="scroll-mt-6 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-primary" />Como a roleta usa as listas</CardTitle>
          <CardDescription>As regras são aplicadas de forma previsível sempre que um novo pedido B2C é distribuído.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            ['1', 'Filtra', 'Considera somente revendedores das listas ativas.'],
            ['2', 'Prioriza', 'Preferencial vem antes de Gold, Silver e Bronze.'],
            ['3', 'Equilibra', 'Em empate, usa UF e quem recebeu menos pedidos.'],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-xl border border-border/60 p-4">
              <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={saveSettings} disabled={isPending} className="fixed bottom-20 right-6 z-40 h-12 rounded-full px-5 shadow-lg sm:bottom-6">
        <Save className="mr-2 h-4 w-4" />{isPending ? 'Salvando...' : 'Salvar'}
      </Button>

      <ResellerListSheet
        list={editingList}
        resellers={resellers}
        onOpenChange={(open) => { if (!open) setEditingList(null) }}
        onSave={saveList}
      />
    </div>
  )
}

function ResellerListSheet({
  list,
  resellers,
  onOpenChange,
  onSave,
}: {
  list: B2CResellerList | null
  resellers: EligibleB2CReseller[]
  onOpenChange: (open: boolean) => void
  onSave: (list: B2CResellerList) => void
}) {
  const [search, setSearch] = useState('')
  if (!list) return <Sheet open={false} />

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{list.name ? 'Editar lista' : 'Nova lista de revendedores'}</SheetTitle>
          <SheetDescription>Combine filtros e ajustes manuais para definir quem participa deste nível da roleta.</SheetDescription>
        </SheetHeader>
        <ListEditor key={list.id} initialList={list} resellers={resellers} search={search} onSearchChange={setSearch} onSave={onSave} />
      </SheetContent>
    </Sheet>
  )
}

function ListEditor({
  initialList,
  resellers,
  search,
  onSearchChange,
  onSave,
}: {
  initialList: B2CResellerList
  resellers: EligibleB2CReseller[]
  search: string
  onSearchChange: (value: string) => void
  onSave: (list: B2CResellerList) => void
}) {
  const [draft, setDraft] = useState(initialList)
  const matches = resellers.filter((reseller) => resellerMatchesList(reseller, draft))
  const visibleResellers = resellers.filter((reseller) => normalize(`${reseller.name} ${reseller.city || ''} ${reseller.state || ''}`).includes(normalize(search)))
  const updateFilters = <Key extends keyof B2CResellerList['filters']>(key: Key, value: B2CResellerList['filters'][Key]) => {
    setDraft((current) => ({ ...current, filters: { ...current.filters, [key]: value }, updatedAt: new Date().toISOString() }))
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="list-name">Nome da lista</Label>
              <Input id="list-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Gold — Sul e Sudeste" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="list-description">Descrição</Label>
              <Textarea id="list-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Explique em uma frase quando esta lista deve ser usada." className="min-h-20 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Nível na roleta</Label>
              <Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as B2CResellerListPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREFERRED">Preferencial</SelectItem>
                  <SelectItem value="GOLD">Gold</SelectItem>
                  <SelectItem value="SILVER">Silver</SelectItem>
                  <SelectItem value="BRONZE">Bronze</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div><p className="text-sm font-medium">Lista ativa</p><p className="text-xs text-muted-foreground">Participa da roleta</p></div>
              <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium">Filtros da lista</p><p className="text-xs text-muted-foreground">Todos os critérios ativos precisam ser atendidos.</p></div>
              <Badge variant="secondary" className="rounded-full font-normal">{matches.length} encontrados</Badge>
            </div>
            <div className="space-y-3 rounded-xl border border-border/60 p-4">
              <CompactSwitch label="Cadastro aprovado" checked={draft.filters.requireApproved} onCheckedChange={(checked) => updateFilters('requireApproved', checked)} />
              <CompactSwitch label="Já realizou pelo menos um pedido" checked={draft.filters.requirePreviousOrder} onCheckedChange={(checked) => updateFilters('requirePreviousOrder', checked)} />
              <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
                <NumberField label="Comprou nos últimos" suffix="dias" value={draft.filters.maxDaysSinceLastOrder} nullable onChange={(value) => updateFilters('maxDaysSinceLastOrder', value)} />
                <NumberField label="Mínimo de pedidos" value={draft.filters.minOrders} onChange={(value) => updateFilters('minOrders', value || 0)} />
                <NumberField label="Valor mínimo comprado" prefix="R$" value={draft.filters.minTotalSpent} onChange={(value) => updateFilters('minTotalSpent', value || 0)} />
              </div>
              <div className="space-y-1.5 border-t border-border/60 pt-4">
                <Label htmlFor="list-states" className="text-xs">Estados atendidos</Label>
                <Input
                  id="list-states"
                  value={draft.filters.states.join(', ')}
                  onChange={(event) => updateFilters('states', parseStates(event.target.value))}
                  placeholder="Todos os estados ou informe SP, RJ, MG"
                />
                <p className="text-[11px] text-muted-foreground">Separe as UFs por vírgula. Deixe vazio para considerar o Brasil inteiro.</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3">
              <p className="text-sm font-medium">Ajuste manual</p>
              <p className="text-xs text-muted-foreground">Inclua ou exclua parceiros sem mudar os filtros da lista.</p>
            </div>
            <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar revendedor, cidade ou UF" className="mb-3 rounded-full" />
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
              {visibleResellers.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">Nenhum revendedor encontrado.</p> : visibleResellers.map((reseller) => {
                const checked = resellerMatchesList(reseller, draft)
                const passesFilters = resellerPassesFilters(reseller, draft.filters)
                return (
                  <Label key={reseller.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        setDraft((current) => {
                          const included = new Set(current.includedResellerIds)
                          const excluded = new Set(current.excludedResellerIds)
                          if (nextChecked === true) {
                            excluded.delete(reseller.id)
                            if (!passesFilters) included.add(reseller.id)
                          } else {
                            included.delete(reseller.id)
                            if (passesFilters) excluded.add(reseller.id)
                          }
                          return { ...current, includedResellerIds: [...included], excludedResellerIds: [...excluded] }
                        })
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{reseller.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{[reseller.city, reseller.state].filter(Boolean).join(' / ') || 'Sem localização'} · {reseller.ordersCount} pedido(s) · {formatMoney(reseller.totalSpent)}</span>
                    </span>
                    <Badge variant="outline" className="rounded-full text-[10px] font-normal">{passesFilters ? 'Pelos filtros' : checked ? 'Manual' : 'Fora'}</Badge>
                  </Label>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <SheetFooter className="border-t bg-background px-6 py-4 sm:flex-row sm:justify-between">
        <p className="self-center text-xs text-muted-foreground">{matches.length} revendedor{matches.length === 1 ? '' : 'es'} nesta lista</p>
        <Button disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString() })} className="rounded-full px-5"><Save className="mr-2 h-4 w-4" />Salvar lista</Button>
      </SheetFooter>
    </>
  )
}

function CompactSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3"><p className="text-sm">{label}</p><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>
}

function NumberField({ label, value, onChange, nullable = false, prefix, suffix }: { label: string; value: number | null; onChange: (value: number | null) => void; nullable?: boolean; prefix?: string; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {prefix ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span> : null}
        <Input type="number" min="0" value={value ?? ''} onChange={(event) => { const raw = event.target.value; onChange(raw === '' && nullable ? null : Math.max(0, Number(raw) || 0)) }} className={cn(prefix && 'pl-9', suffix && 'pr-11')} placeholder={nullable ? 'Sem limite' : '0'} />
        {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  )
}

function resellerMatchesList(reseller: EligibleB2CReseller, list: B2CResellerList) {
  if (list.excludedResellerIds.includes(reseller.id)) return false
  if (list.includedResellerIds.includes(reseller.id)) return true
  return resellerPassesFilters(reseller, list.filters)
}

function resellerPassesFilters(reseller: EligibleB2CReseller, filters: B2CResellerList['filters']) {
  if (filters.requireApproved && !reseller.eligible) return false
  if (filters.requirePreviousOrder && reseller.ordersCount < 1) return false
  if (reseller.ordersCount < filters.minOrders || reseller.totalSpent < filters.minTotalSpent) return false
  if (filters.states.length > 0 && (!reseller.state || !filters.states.includes(reseller.state.toUpperCase()))) return false
  if (filters.maxDaysSinceLastOrder !== null) {
    if (!reseller.lastOrderAt) return false
    const age = Date.now() - new Date(reseller.lastOrderAt).getTime()
    if (!Number.isFinite(age) || age > filters.maxDaysSinceLastOrder * 86_400_000) return false
  }
  return true
}

function effectiveResellerLevel(reseller: EligibleB2CReseller, lists: B2CResellerList[]): B2CResellerLevel {
  const weights: Record<B2CResellerListPriority, number> = { PREFERRED: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
  const priority = lists
    .filter((list) => resellerMatchesList(reseller, list))
    .sort((left, right) => weights[right.priority] - weights[left.priority])[0]?.priority
  return priority === 'GOLD' || priority === 'SILVER' ? priority : 'BRONZE'
}

function summarizeFilters(list: B2CResellerList) {
  const parts: string[] = []
  if (list.filters.maxDaysSinceLastOrder !== null) parts.push(`últimos ${list.filters.maxDaysSinceLastOrder} dias`)
  if (list.filters.minOrders > 0) parts.push(`${list.filters.minOrders}+ pedidos`)
  if (list.filters.minTotalSpent > 0) parts.push(`${formatMoney(list.filters.minTotalSpent)}+`)
  if (list.filters.states.length > 0) parts.push(list.filters.states.join(', '))
  return parts.length ? parts.join(' · ') : 'Sem filtros adicionais'
}

function parseStates(value: string) {
  return [...new Set(value.split(',').map((state) => state.trim().toUpperCase().slice(0, 2)).filter((state) => state.length === 2))]
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
