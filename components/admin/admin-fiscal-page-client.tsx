"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus, Pencil, Trash2, Receipt, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import AddressInput from "@/components/form/AddressInput"
import {
  createFiscalEmitterAction,
  createFiscalNatureAction,
  updateFiscalNatureAction,
  updateFiscalEmitterAction,
  deleteFiscalEmitterAction,
  getFiscalEmittersAction,
  deleteFiscalNatureAction,
  getFiscalNatureFullAction,
  getNatureEmittersAction,
  upsertTaxRuleAction,
  upsertNatureEmittersAction,
  createStateExceptionAction,
  deleteStateExceptionAction,
  type FiscalEmitter,
  type FiscalNatureEmitterLinkWithEmitter,
  type FiscalNatureScope,
  type FiscalOperationNature,
  type FiscalOperationNatureFull,
  type FiscalOperationTaxRule,
  type FiscalOperationStateException,
} from "@/lib/actions/fiscal"

// ---------------------------------------------------------------------------
// Constantes de domínio fiscal
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { value: "NFe", label: "NF-e" },
  { value: "NFCe", label: "NFC-e" },
  { value: "NFSe", label: "NFS-e" },
]

const PERSON_TYPES = [
  { value: "PF", label: "Pessoa Física" },
  { value: "PJ", label: "Pessoa Jurídica" },
]

const CONSUMER_PRESENCE_OPTIONS = [
  { value: "0", label: "0 – Não se aplica" },
  { value: "1", label: "1 – Presencial" },
  { value: "2", label: "2 – Não presencial (Internet)" },
  { value: "3", label: "3 – Não presencial (Teleatendimento)" },
  { value: "4", label: "4 – NFC-e entrega em domicílio" },
  { value: "9", label: "9 – Outros" },
]

const PURPOSES = [
  { value: "1", label: "1 – Normal" },
  { value: "2", label: "2 – Complementar" },
  { value: "3", label: "3 – Ajuste" },
  { value: "4", label: "4 – Devolução" },
]

const SCOPE_OPTIONS: { value: FiscalNatureScope; label: string; description: string }[] = [
  { value: "INTRAESTADUAL", label: "Dentro do Estado", description: "Destinatário na mesma UF do emitente" },
  { value: "INTERESTADUAL", label: "Fora do Estado", description: "Destinatário em UF diferente do emitente" },
  { value: "AMBOS", label: "Ambos", description: "Aplica-se em qualquer tipo de operação" },
]

const ICMS_BASE_MODES = [
  { value: "0", label: "0 – Margem Valor Agregado" },
  { value: "1", label: "1 – Pauta" },
  { value: "2", label: "2 – Preço Tabelado Máximo" },
  { value: "3", label: "3 – Valor da Operação" },
]

const ICMS_ST_BASE_MODES = [
  { value: "0", label: "0 – Preço Tabelado" },
  { value: "1", label: "1 – Lista Negativa" },
  { value: "2", label: "2 – Lista Positiva" },
  { value: "3", label: "3 – Lista Neutra" },
  { value: "4", label: "4 – Margem Valor Agregado" },
  { value: "5", label: "5 – Pauta" },
  { value: "6", label: "6 – Valor da Operação" },
]

const TAX_TYPES = [
  { value: "ICMS", label: "ICMS" },
  { value: "ST", label: "ICMS-ST" },
  { value: "IPI", label: "IPI" },
  { value: "PIS", label: "PIS" },
  { value: "COFINS", label: "COFINS" },
]

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2)
}

function percentToBps(val: string): number {
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function emptyTaxRule(): Partial<FiscalOperationTaxRule> {
  return {
    csosn: undefined,
    cst_icms: undefined,
    cfop: "",
    icms_rate_bps: 0,
    icms_interstate_split_bps: 0,
    icms_base_mode: 3,
    icms_base_reduction_bps: 0,
    icms_st_rate_bps: 0,
    icms_st_base_mode: 4,
    icms_st_mva_bps: 0,
    cst_ipi: undefined,
    ipi_rate_bps: 0,
    ipi_framework_code: "",
    cst_pis: undefined,
    pis_rate_bps: 0,
    pis_base_reduction_bps: 0,
    cst_cofins: undefined,
    cofins_rate_bps: 0,
    cofins_base_reduction_bps: 0,
    cst_ibs: undefined,
    ibs_rate_bps: 0,
    cst_cbs: undefined,
    cbs_rate_bps: 0,
  }
}

function hasTaxRuleData(rule: Partial<FiscalOperationTaxRule>): boolean {
  const normalized = {
    ...emptyTaxRule(),
    ...rule,
  }

  return [
    normalized.csosn,
    normalized.cst_icms,
    normalized.cfop,
    normalized.cst_ipi,
    normalized.ipi_framework_code,
    normalized.cst_pis,
    normalized.cst_cofins,
    normalized.cst_ibs,
    normalized.cst_cbs,
  ].some((value) => (value ?? "").toString().trim().length > 0)
    || [
      normalized.icms_rate_bps,
      normalized.icms_interstate_split_bps,
      normalized.icms_base_reduction_bps,
      normalized.icms_st_rate_bps,
      normalized.icms_st_mva_bps,
      normalized.ipi_rate_bps,
      normalized.pis_rate_bps,
      normalized.pis_base_reduction_bps,
      normalized.cofins_rate_bps,
      normalized.cofins_base_reduction_bps,
      normalized.ibs_rate_bps,
      normalized.cbs_rate_bps,
    ].some((value) => Number(value ?? 0) !== 0)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminFiscalPageClientProps {
  initialNatures: FiscalOperationNature[]
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function AdminFiscalPageClient({ initialNatures }: AdminFiscalPageClientProps) {
  const { toast } = useToast()
  const [natures, setNatures] = useState<FiscalOperationNature[]>(initialNatures)
  const [activeTab, setActiveTab] = useState<"emitters" | "natures">("emitters")

  // Modal de criação/edição
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNature, setEditingNature] = useState<FiscalOperationNatureFull | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)

  // Confirmação de exclusão da natureza
  const [deleteTarget, setDeleteTarget] = useState<FiscalOperationNature | null>(null)

  // Formulário – Aba Geral
  const [form, setForm] = useState({
    name: "",
    active: true,
    platforms: [] as string[],
    person_types: ["PF", "PJ"] as string[],
    consumer_presence: "2",
    operation_type: "SAIDA",
    purpose: "1",
    scope: "AMBOS" as FiscalNatureScope,
    notes: "",
  })

  // Formulário – Regra Tributária
  const [taxRule, setTaxRule] = useState<Partial<FiscalOperationTaxRule>>(emptyTaxRule())

  // Formulário – Nova exceção
  const [excForm, setExcForm] = useState({
    states: [] as string[],
    tax_type: "ICMS",
    csosn: "",
    cst: "",
    cfop: "",
    rate_bps_str: "",
    notes: "",
  })

  const [isSaving, setIsSaving] = useState(false)

  // Emitentes fiscais
  const [emitters, setEmitters] = useState<FiscalEmitter[]>([])
  const [isLoadingEmitters, setIsLoadingEmitters] = useState(true)
  const [emitterDialogOpen, setEmitterDialogOpen] = useState(false)
  const [editingEmitter, setEditingEmitter] = useState<FiscalEmitter | null>(null)
  const [emitterDeleteTarget, setEmitterDeleteTarget] = useState<FiscalEmitter | null>(null)
  const [emitterForm, setEmitterForm] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    address_zip: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    active: true,
  })
  const [natureEmitters, setNatureEmitters] = useState<FiscalNatureEmitterLinkWithEmitter[]>([])
  const [natureEmitterDrafts, setNatureEmitterDrafts] = useState<Record<number, {
    enabled: boolean
    active: boolean
    selection_mode: "fixed" | "round_robin" | "weighted_random"
    priority: number
    weight: number
  }>>({})

  useEffect(() => {
    loadEmitters()
  }, [])

  useEffect(() => {
    if (editingNature) {
      hydrateNatureEmitterDrafts(natureEmitters)
    }
  }, [emitters])

  async function loadEmitters(): Promise<FiscalEmitter[]> {
    setIsLoadingEmitters(true)
    const list = await getFiscalEmittersAction()
    setEmitters(list)
    setIsLoadingEmitters(false)
    return list
  }

  function openCreateEmitter() {
    setEditingEmitter(null)
    setEmitterForm({
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      address_zip: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      active: true,
    })
    setEmitterDialogOpen(true)
  }

  function openEditEmitter(emitter: FiscalEmitter) {
    setEditingEmitter(emitter)
    setEmitterForm({
      name: emitter.name,
      cnpj: emitter.cnpj,
      email: emitter.email ?? "",
      phone: emitter.phone ?? "",
      address_zip: emitter.address_zip ?? "",
      address_street: emitter.address_street ?? "",
      address_number: emitter.address_number ?? "",
      address_complement: emitter.address_complement ?? "",
      address_neighborhood: emitter.address_neighborhood ?? "",
      address_city: emitter.address_city ?? "",
      address_state: emitter.address_state ?? "",
      active: emitter.active,
    })
    setEmitterDialogOpen(true)
  }

  async function handleSaveEmitter() {
    if (!emitterForm.name.trim() || !emitterForm.cnpj.trim() || !emitterForm.email.trim() || !emitterForm.address_state.trim()) {
      toast({ title: "Nome, CNPJ, e-mail e UF são obrigatórios", variant: "destructive" })
      return
    }

    if (editingEmitter) {
      const res = await updateFiscalEmitterAction(editingEmitter.id, {
        name: emitterForm.name.trim(),
        cnpj: emitterForm.cnpj.trim(),
        email: emitterForm.email.trim(),
        phone: emitterForm.phone.trim() || undefined,
        address_zip: emitterForm.address_zip.trim() || undefined,
        address_street: emitterForm.address_street.trim() || undefined,
        address_number: emitterForm.address_number.trim() || undefined,
        address_complement: emitterForm.address_complement.trim() || undefined,
        address_neighborhood: emitterForm.address_neighborhood.trim() || undefined,
        address_city: emitterForm.address_city.trim() || undefined,
        address_state: emitterForm.address_state.trim().toUpperCase() || undefined,
        active: emitterForm.active,
      })
      if (!res.success) {
        toast({ title: res.error ?? "Erro ao atualizar emitente", variant: "destructive" })
        return
      }
      toast({ title: "Emitente atualizado" })
    } else {
      const res = await createFiscalEmitterAction({
        name: emitterForm.name.trim(),
        cnpj: emitterForm.cnpj.trim(),
        email: emitterForm.email.trim(),
        phone: emitterForm.phone.trim() || undefined,
        address_zip: emitterForm.address_zip.trim() || undefined,
        address_street: emitterForm.address_street.trim() || undefined,
        address_number: emitterForm.address_number.trim() || undefined,
        address_complement: emitterForm.address_complement.trim() || undefined,
        address_neighborhood: emitterForm.address_neighborhood.trim() || undefined,
        address_city: emitterForm.address_city.trim() || undefined,
        address_state: emitterForm.address_state.trim().toUpperCase() || undefined,
        active: emitterForm.active,
      })
      if (!res.success) {
        toast({ title: res.error ?? "Erro ao criar emitente", variant: "destructive" })
        return
      }
      toast({ title: "Emitente criado" })
    }

    await loadEmitters()
    setEmitterDialogOpen(false)
  }

  async function handleDeleteEmitter() {
    if (!emitterDeleteTarget) return
    const res = await deleteFiscalEmitterAction(emitterDeleteTarget.id)
    if (!res.success) {
      toast({ title: res.error ?? "Erro ao excluir emitente", variant: "destructive" })
      return
    }
    toast({ title: "Emitente excluído" })
    setEmitterDeleteTarget(null)
    await loadEmitters()
  }

  function hydrateNatureEmitterDrafts(links: FiscalNatureEmitterLinkWithEmitter[]) {
    const draft: Record<number, {
      enabled: boolean
      active: boolean
      selection_mode: "fixed" | "round_robin" | "weighted_random"
      priority: number
      weight: number
    }> = {}

    for (const emitter of emitters) {
      const link = links.find((entry) => entry.emitter_id === emitter.id)
      draft[emitter.id] = {
        enabled: Boolean(link),
        active: link?.active ?? true,
        selection_mode: (link?.selection_mode ?? "fixed") as "fixed" | "round_robin" | "weighted_random",
        priority: link?.priority ?? 100,
        weight: link?.weight ?? 1,
      }
    }

    setNatureEmitterDrafts(draft)
  }

  async function handleSaveNatureEmitters() {
    if (!editingNature) return
    const payload = Object.entries(natureEmitterDrafts)
      .filter(([, cfg]) => cfg.enabled)
      .map(([emitterId, cfg]) => ({
        emitter_id: Number(emitterId),
        active: cfg.active,
        selection_mode: cfg.selection_mode,
        priority: cfg.priority,
        weight: cfg.weight,
      }))

    const res = await upsertNatureEmittersAction(editingNature.id, payload)
    if (!res.success) {
      toast({ title: res.error ?? "Erro ao salvar vínculos", variant: "destructive" })
      return
    }

    const links = await getNatureEmittersAction(editingNature.id)
    setNatureEmitters(links)
    hydrateNatureEmitterDrafts(links)
    toast({ title: "Vínculos de emitentes salvos" })
  }

  // -------------------------------------------------------------------------
  // Abrir modal (criar)
  // -------------------------------------------------------------------------
  function openCreate() {
    setEditingNature(null)
    setNatureEmitters([])
    hydrateNatureEmitterDrafts([])
    setForm({ name: "", active: true, platforms: [], person_types: ["PF", "PJ"], consumer_presence: "2", operation_type: "SAIDA", purpose: "1", scope: "AMBOS", notes: "" })
    setTaxRule(emptyTaxRule())
    setExcForm({ states: [], tax_type: "ICMS", csosn: "", cst: "", cfop: "", rate_bps_str: "", notes: "" })
    setDialogOpen(true)
  }

  // -------------------------------------------------------------------------
  // Abrir modal (editar) – carrega dados completos
  // -------------------------------------------------------------------------
  async function openEdit(nature: FiscalOperationNature) {
    setIsLoadingFull(true)
    setDialogOpen(true)
    const emittersList = emitters.length > 0 ? emitters : await loadEmitters()
    const full = await getFiscalNatureFullAction(nature.id)
    const links = await getNatureEmittersAction(nature.id)
    setIsLoadingFull(false)
    if (!full) {
      toast({ title: "Erro ao carregar natureza", variant: "destructive" })
      setDialogOpen(false)
      return
    }
    setEditingNature(full)
    setNatureEmitters(links)
    if (emittersList.length === 0) {
      setNatureEmitterDrafts({})
    } else {
      const draft: Record<number, {
        enabled: boolean
        active: boolean
        selection_mode: "fixed" | "round_robin" | "weighted_random"
        priority: number
        weight: number
      }> = {}
      for (const emitter of emittersList) {
        const link = links.find((entry) => entry.emitter_id === emitter.id)
        draft[emitter.id] = {
          enabled: Boolean(link),
          active: link?.active ?? true,
          selection_mode: (link?.selection_mode ?? "fixed") as "fixed" | "round_robin" | "weighted_random",
          priority: link?.priority ?? 100,
          weight: link?.weight ?? 1,
        }
      }
      setNatureEmitterDrafts(draft)
    }
    setForm({
      name: full.name,
      active: full.active,
      platforms: full.platforms,
      person_types: full.person_types,
      consumer_presence: String(full.consumer_presence),
      operation_type: full.operation_type,
      purpose: full.purpose,
      scope: full.scope ?? "AMBOS",
      notes: full.notes ?? "",
    })
    setTaxRule(full.tax_rule ?? emptyTaxRule())
    setExcForm({ states: [], tax_type: "ICMS", csosn: "", cst: "", cfop: "", rate_bps_str: "", notes: "" })
  }

  // -------------------------------------------------------------------------
  // Salvar natureza + regra tributária
  // -------------------------------------------------------------------------
  async function handleSaveNature() {
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" })
      return
    }
    setIsSaving(true)
    const payload = {
      name: form.name.trim(),
      active: form.active,
      platforms: form.platforms,
      person_types: form.person_types,
      consumer_presence: parseInt(form.consumer_presence),
      operation_type: form.operation_type,
      purpose: form.purpose,
      scope: form.scope,
      notes: form.notes,
    }

    let nature: FiscalOperationNature
    if (editingNature) {
      const res = await updateFiscalNatureAction(editingNature.id, payload)
      if (!res.success) {
        toast({ title: res.error ?? "Erro ao atualizar", variant: "destructive" })
        setIsSaving(false)
        return
      }
      nature = res.data!
      setNatures(prev => prev.map(n => n.id === nature.id ? nature : n))
    } else {
      const res = await createFiscalNatureAction(payload)
      if (!res.success) {
        toast({ title: res.error ?? "Erro ao criar", variant: "destructive" })
        setIsSaving(false)
        return
      }
      nature = res.data!
      setNatures(prev => [...prev, nature])
    }

    if (hasTaxRuleData(taxRule)) {
      const taxRuleRes = await upsertTaxRuleAction(nature.id, taxRule)
      if (!taxRuleRes.success) {
        toast({ title: taxRuleRes.error ?? "Erro ao salvar regra tributária", variant: "destructive" })
        setIsSaving(false)
        return
      }
    }

    toast({ title: editingNature ? "Natureza atualizada" : "Natureza criada" })
    setIsSaving(false)
    setDialogOpen(false)
  }

  // -------------------------------------------------------------------------
  // Excluir natureza
  // -------------------------------------------------------------------------
  async function handleDeleteNature() {
    if (!deleteTarget) return
    const res = await deleteFiscalNatureAction(deleteTarget.id)
    if (!res.success) {
      toast({ title: res.error ?? "Erro ao excluir", variant: "destructive" })
    } else {
      setNatures(prev => prev.filter(n => n.id !== deleteTarget.id))
      toast({ title: "Natureza excluída" })
    }
    setDeleteTarget(null)
  }

  // -------------------------------------------------------------------------
  // Adicionar exceção por estado
  // -------------------------------------------------------------------------
  async function handleAddException() {
    if (!editingNature || excForm.states.length === 0) {
      toast({ title: "Selecione ao menos um estado", variant: "destructive" })
      return
    }
    const res = await createStateExceptionAction(editingNature.id, {
      states: excForm.states,
      tax_type: excForm.tax_type,
      csosn: excForm.csosn || undefined,
      cst: excForm.cst || undefined,
      cfop: excForm.cfop || undefined,
      rate_bps: excForm.rate_bps_str ? percentToBps(excForm.rate_bps_str) : undefined,
      notes: excForm.notes || undefined,
    })
    if (!res.success) {
      toast({ title: res.error ?? "Erro ao criar exceção", variant: "destructive" })
      return
    }
    setEditingNature(prev => prev ? {
      ...prev,
      state_exceptions: [...prev.state_exceptions, res.data!],
    } : prev)
    setExcForm({ states: [], tax_type: "ICMS", csosn: "", cst: "", cfop: "", rate_bps_str: "", notes: "" })
    toast({ title: "Exceção adicionada" })
  }

  async function handleDeleteException(excId: number) {
    if (!editingNature) return
    const res = await deleteStateExceptionAction(editingNature.id, excId)
    if (!res.success) {
      toast({ title: res.error ?? "Erro ao excluir exceção", variant: "destructive" })
      return
    }
    setEditingNature(prev => prev ? {
      ...prev,
      state_exceptions: prev.state_exceptions.filter(e => e.id !== excId),
    } : prev)
  }

  // -------------------------------------------------------------------------
  // Toggle plataforma / tipo pessoa
  // -------------------------------------------------------------------------
  function togglePlatform(val: string) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(val) ? f.platforms.filter(p => p !== val) : [...f.platforms, val],
    }))
  }

  function togglePersonType(val: string) {
    setForm(f => ({
      ...f,
      person_types: f.person_types.includes(val) ? f.person_types.filter(p => p !== val) : [...f.person_types, val],
    }))
  }

  function toggleExcState(val: string) {
    setExcForm(f => ({
      ...f,
      states: f.states.includes(val) ? f.states.filter(s => s !== val) : [...f.states, val],
    }))
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 [&_label]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer">
      {/* Cabeçalho com navegação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configurações Fiscais</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie emitentes e naturezas de operação para emissão de NF-e / NFC-e
            </p>
          </div>
        </div>
      </div>

      {/* Navegação de abas */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("emitters")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "emitters"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Emitentes fiscais
          </button>
          <button
            onClick={() => setActiveTab("natures")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "natures"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Naturezas de Operação
          </button>
        </div>
      </div>

      {/* ====== SEÇÃO: EMITENTES FISCAIS ====== */}
      {activeTab === "emitters" && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Emitentes fiscais</CardTitle>
              <Button onClick={openCreateEmitter} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Novo emitente
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingEmitters ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Carregando emitentes...
                      </TableCell>
                    </TableRow>
                  ) : emitters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhum emitente cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    emitters.map((emitter) => (
                      <TableRow key={emitter.id}>
                        <TableCell className="font-medium">{emitter.name}</TableCell>
                        <TableCell>{emitter.cnpj}</TableCell>
                        <TableCell>{emitter.email || "—"}</TableCell>
                        <TableCell>{emitter.phone || "—"}</TableCell>
                        <TableCell>{emitter.address_state || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={emitter.active ? "default" : "outline"}>
                            {emitter.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEditEmitter(emitter)} className="cursor-pointer">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEmitterDeleteTarget(emitter)} className="cursor-pointer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== SEÇÃO: NATUREZAS DE OPERAÇÃO ====== */}
      {activeTab === "natures" && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Naturezas de Operação</CardTitle>
              <Button onClick={openCreate} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Nova natureza
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Plataformas</TableHead>
                    <TableHead>Tipo operação</TableHead>
                    <TableHead>Finalidade</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {natures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhuma natureza cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    natures.map(n => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {SCOPE_OPTIONS.find(s => s.value === n.scope)?.label ?? n.scope ?? "Ambos"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {n.platforms.map(p => (
                              <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{n.operation_type}</TableCell>
                        <TableCell>{PURPOSES.find(p => p.value === n.purpose)?.label ?? n.purpose}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={n.active ? "default" : "outline"}>
                            {n.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(n)} className="cursor-pointer">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(n)} className="cursor-pointer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Drawer lateral: criar / editar natureza                            */}
      {/* ------------------------------------------------------------------ */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[60vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden"
        >
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-lg font-semibold">
                {editingNature ? `Editar: ${editingNature.name}` : "Nova Natureza de Operação"}
              </SheetTitle>
              <SheetClose asChild>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoadingFull ? (
              <div className="py-12 text-center text-muted-foreground">Carregando...</div>
            ) : (
              <Tabs defaultValue="geral" className="p-6">
                <TabsList className="w-full">
                  <TabsTrigger value="geral" className="flex-1 cursor-pointer">Geral</TabsTrigger>
                  <TabsTrigger value="tributario" className="flex-1 cursor-pointer">Regime Tributário</TabsTrigger>
                  <TabsTrigger value="ipi" className="flex-1 cursor-pointer">IPI</TabsTrigger>
                  <TabsTrigger value="pis-cofins" className="flex-1 cursor-pointer">PIS / COFINS</TabsTrigger>
                  {editingNature && (
                    <TabsTrigger value="excecoes" className="flex-1 cursor-pointer">Exceções</TabsTrigger>
                  )}
                  {editingNature && (
                    <TabsTrigger value="emitentes" className="flex-1 cursor-pointer">Emitentes</TabsTrigger>
                  )}
                </TabsList>

              {/* ========================= ABA GERAL ========================= */}
              <TabsContent value="geral" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex.: Venda de Mercadoria"
                    />
                  </div>

                  {/* Plataformas */}
                  <div className="space-y-1.5">
                    <Label>Plataformas</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(p => (
                        <label key={p.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={form.platforms.includes(p.value)}
                            onChange={() => togglePlatform(p.value)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tipo Pessoa */}
                  <div className="space-y-1.5">
                    <Label>Tipo de Pessoa</Label>
                    <div className="flex flex-wrap gap-3">
                      {PERSON_TYPES.map(p => (
                        <label key={p.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={form.person_types.includes(p.value)}
                            onChange={() => togglePersonType(p.value)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Presença do consumidor */}
                  <div className="space-y-1.5">
                    <Label>Presença do Consumidor</Label>
                    <Select
                      value={form.consumer_presence}
                      onValueChange={v => setForm(f => ({ ...f, consumer_presence: v }))}
                    >
                      <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONSUMER_PRESENCE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo operação */}
                  <div className="space-y-1.5">
                    <Label>Tipo de Operação</Label>
                    <Select
                      value={form.operation_type}
                      onValueChange={v => setForm(f => ({ ...f, operation_type: v }))}
                    >
                      <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAIDA">Saída</SelectItem>
                        <SelectItem value="ENTRADA">Entrada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Finalidade */}
                  <div className="space-y-1.5">
                    <Label>Finalidade da Emissão</Label>
                    <Select
                      value={form.purpose}
                      onValueChange={v => setForm(f => ({ ...f, purpose: v }))}
                    >
                      <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PURPOSES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Escopo geográfico */}
                  <div className="col-span-2 space-y-1.5">
                    <Label>Escopo geográfico</Label>
                    <p className="text-xs text-muted-foreground">
                      Define quando esta natureza é escolhida automaticamente com base na UF do destinatário
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {SCOPE_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-2 cursor-pointer rounded-lg border p-3 flex-1 min-w-40 transition-colors ${
                            form.scope === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="scope"
                            value={opt.value}
                            checked={form.scope === opt.value}
                            onChange={() => setForm(f => ({ ...f, scope: opt.value as FiscalNatureScope }))}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Ativo */}
                  <div className="flex items-center gap-3">
                    <Switch
                      className="cursor-pointer"
                      checked={form.active}
                      onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
                    />
                    <Label>Natureza ativa</Label>
                  </div>

                  {/* Observações */}
                  <div className="col-span-2 space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Anotações internas..."
                    />
                  </div>
                </div>
              </TabsContent>

              {/* =================== ABA REGIME TRIBUTÁRIO =================== */}
              <TabsContent value="tributario" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>CSOSN (Simples Nacional)</Label>
                    <Input
                      value={taxRule.csosn ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, csosn: e.target.value || undefined }))}
                      placeholder="ex: 400"
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CST ICMS (Lucro Real/Presumido)</Label>
                    <Input
                      value={taxRule.cst_icms ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_icms: e.target.value || undefined }))}
                      placeholder="ex: 00"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CFOP *</Label>
                    <Input
                      value={taxRule.cfop ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cfop: e.target.value }))}
                      placeholder="ex: 5102"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota ICMS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.icms_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, icms_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="12.00"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="space-y-1.5">
                    <Label>Modalidade BC ICMS</Label>
                    <Select
                      value={String(taxRule.icms_base_mode ?? 3)}
                      onValueChange={v => setTaxRule(r => ({ ...r, icms_base_mode: parseInt(v) }))}
                    >
                      <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICMS_BASE_MODES.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Redução BC ICMS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.icms_base_reduction_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, icms_base_reduction_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="space-y-1.5">
                    <Label>Alíquota ICMS-ST (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.icms_st_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, icms_st_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>MVA ST (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.icms_st_mva_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, icms_st_mva_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modalidade BC ICMS-ST</Label>
                    <Select
                      value={String(taxRule.icms_st_base_mode ?? 4)}
                      onValueChange={v => setTaxRule(r => ({ ...r, icms_st_base_mode: parseInt(v) }))}
                    >
                      <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICMS_ST_BASE_MODES.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Partilha Interestadual (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.icms_interstate_split_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, icms_interstate_split_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ========================= ABA IPI ========================= */}
              <TabsContent value="ipi" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>CST IPI</Label>
                    <Input
                      value={taxRule.cst_ipi ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_ipi: e.target.value || undefined }))}
                      placeholder="ex: 49"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota IPI (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.ipi_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, ipi_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Código de Enquadramento Legal</Label>
                    <Input
                      value={taxRule.ipi_framework_code ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, ipi_framework_code: e.target.value }))}
                      placeholder="3 dígitos, ex: 999"
                      maxLength={3}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ===================== ABA PIS / COFINS ===================== */}
              <TabsContent value="pis-cofins" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">PIS</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>CST PIS</Label>
                    <Input
                      value={taxRule.cst_pis ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_pis: e.target.value || undefined }))}
                      placeholder="ex: 01"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota PIS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.pis_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, pis_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="0.65"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Redução BC PIS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.pis_base_reduction_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, pis_base_reduction_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">COFINS</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>CST COFINS</Label>
                    <Input
                      value={taxRule.cst_cofins ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_cofins: e.target.value || undefined }))}
                      placeholder="ex: 01"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota COFINS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.cofins_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, cofins_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="3.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Redução BC COFINS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.cofins_base_reduction_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, cofins_base_reduction_bps: percentToBps(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">IBS</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação Tributária IBS</Label>
                    <Input
                      value={taxRule.cst_ibs ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_ibs: e.target.value || undefined }))}
                      placeholder="ex: 000"
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota IBS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.ibs_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, ibs_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="0.10"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">CBS</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação Tributária CBS</Label>
                    <Input
                      value={taxRule.cst_cbs ?? ""}
                      onChange={e => setTaxRule(r => ({ ...r, cst_cbs: e.target.value || undefined }))}
                      placeholder="ex: 000"
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alíquota CBS (%)</Label>
                    <Input
                      value={bpsToPercent(taxRule.cbs_rate_bps ?? 0)}
                      onChange={e => setTaxRule(r => ({ ...r, cbs_rate_bps: percentToBps(e.target.value) }))}
                      placeholder="0.90"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ===================== ABA EXCEÇÕES ======================== */}
              {editingNature && (
                <TabsContent value="excecoes" className="space-y-4 pt-4">
                  {/* Tabela de exceções existentes */}
                  {editingNature.state_exceptions.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estados</TableHead>
                          <TableHead>Imposto</TableHead>
                          <TableHead>CFOP</TableHead>
                          <TableHead>Alíquota</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingNature.state_exceptions.map(exc => (
                          <TableRow key={exc.id}>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {exc.states.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                              </div>
                            </TableCell>
                            <TableCell>{exc.tax_type}</TableCell>
                            <TableCell>{exc.cfop ?? "—"}</TableCell>
                            <TableCell>
                              {exc.rate_bps != null ? `${bpsToPercent(exc.rate_bps)}%` : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteException(exc.id)} className="cursor-pointer">
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <Separator />
                  <p className="text-sm font-medium">Nova exceção</p>

                  {/* Seletor de estados */}
                  <div className="space-y-1.5">
                    <Label>Estados</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {BR_STATES.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleExcState(s)}
                          className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                            excForm.states.includes(s)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo Imposto</Label>
                      <Select value={excForm.tax_type} onValueChange={v => setExcForm(f => ({ ...f, tax_type: v }))}>
                        <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TAX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>CFOP</Label>
                      <Input value={excForm.cfop} onChange={e => setExcForm(f => ({ ...f, cfop: e.target.value }))} maxLength={4} placeholder="6102" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Alíquota (%)</Label>
                      <Input value={excForm.rate_bps_str} onChange={e => setExcForm(f => ({ ...f, rate_bps_str: e.target.value }))} placeholder="12.00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CSOSN</Label>
                      <Input value={excForm.csosn} onChange={e => setExcForm(f => ({ ...f, csosn: e.target.value }))} maxLength={3} placeholder="500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CST</Label>
                      <Input value={excForm.cst} onChange={e => setExcForm(f => ({ ...f, cst: e.target.value }))} maxLength={2} placeholder="10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Obs.</Label>
                      <Input value={excForm.notes} onChange={e => setExcForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                    </div>
                  </div>

                  <Button variant="outline" onClick={handleAddException} className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar exceção
                  </Button>
                </TabsContent>
              )}

              {editingNature && (
                <TabsContent value="emitentes" className="space-y-4 pt-4">
                  {emitters.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Cadastre pelo menos um emitente para vincular a esta natureza.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {emitters.map((emitter) => {
                        const cfg = natureEmitterDrafts[emitter.id] ?? {
                          enabled: false,
                          active: true,
                          selection_mode: "fixed" as const,
                          priority: 100,
                          weight: 1,
                        }

                        return (
                          <div key={emitter.id} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={cfg.enabled}
                                  onChange={(event) => {
                                    const checked = event.target.checked
                                    setNatureEmitterDrafts((prev) => ({
                                      ...prev,
                                      [emitter.id]: { ...cfg, enabled: checked },
                                    }))
                                  }}
                                />
                                {emitter.name}
                              </label>
                              <Badge variant={emitter.active ? "default" : "outline"}>{emitter.cnpj}</Badge>
                            </div>

                            {cfg.enabled && (
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Modo de seleção</Label>
                                  <Select
                                    value={cfg.selection_mode}
                                    onValueChange={(value) => {
                                      const selectionMode = value as "fixed" | "round_robin" | "weighted_random"
                                      setNatureEmitterDrafts((prev) => ({
                                        ...prev,
                                        [emitter.id]: { ...cfg, selection_mode: selectionMode },
                                      }))
                                    }}
                                  >
                                    <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Fixo</SelectItem>
                                      <SelectItem value="round_robin">Rodízio</SelectItem>
                                      <SelectItem value="weighted_random">Sorteio por peso</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1.5">
                                  <Label>Prioridade</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={cfg.priority}
                                    onChange={(event) => {
                                      const priority = Number(event.target.value || 0)
                                      setNatureEmitterDrafts((prev) => ({
                                        ...prev,
                                        [emitter.id]: { ...cfg, priority },
                                      }))
                                    }}
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label>Peso</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={cfg.weight}
                                    onChange={(event) => {
                                      const weight = Math.max(1, Number(event.target.value || 1))
                                      setNatureEmitterDrafts((prev) => ({
                                        ...prev,
                                        [emitter.id]: { ...cfg, weight },
                                      }))
                                    }}
                                  />
                                </div>

                                <div className="col-span-3 flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={cfg.active}
                                    onChange={(event) => {
                                      const active = event.target.checked
                                      setNatureEmitterDrafts((prev) => ({
                                        ...prev,
                                        [emitter.id]: { ...cfg, active },
                                      }))
                                    }}
                                  />
                                  Vínculo ativo para emissão
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      <Button variant="outline" onClick={handleSaveNatureEmitters} className="cursor-pointer">
                        Salvar vínculos de emitentes
                      </Button>

                      {natureEmitters.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Vínculos atuais: {natureEmitters.length}
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              )}
              </Tabs>
            )}
          </div>

          <div className="p-6 border-t flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Cancelar</Button>
            <Button onClick={handleSaveNature} disabled={isSaving} className="cursor-pointer">
              {isSaving ? "Salvando..." : (editingNature ? "Salvar alterações" : "Criar natureza")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------ */}
      {/* Confirmação de exclusão                                             */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir natureza?</AlertDialogTitle>
            <AlertDialogDescription>
              A natureza <strong>{deleteTarget?.name}</strong> e todas as suas regras e exceções serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNature} className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={emitterDialogOpen} onOpenChange={setEmitterDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingEmitter ? "Editar emitente" : "Novo emitente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={emitterForm.name}
                onChange={(event) => setEmitterForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Razão social / identificação interna"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ *</Label>
              <Input
                value={emitterForm.cnpj}
                onChange={(event) => setEmitterForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={emitterForm.phone}
                onChange={(event) => setEmitterForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                required
                value={emitterForm.email}
                onChange={(event) => setEmitterForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="fiscal@empresa.com"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <AddressInput
                values={{
                  zip_code: emitterForm.address_zip,
                  street_name: emitterForm.address_street,
                  house_number: emitterForm.address_number,
                  address_complement: emitterForm.address_complement,
                  neighborhood: emitterForm.address_neighborhood,
                  city: emitterForm.address_city,
                  state: emitterForm.address_state,
                }}
                onChange={(field, value) => {
                  setEmitterForm((prev) => {
                    switch (field) {
                      case "zip_code":
                        return { ...prev, address_zip: value }
                      case "street_name":
                        return { ...prev, address_street: value }
                      case "house_number":
                        return { ...prev, address_number: value }
                      case "address_complement":
                        return { ...prev, address_complement: value }
                      case "neighborhood":
                        return { ...prev, address_neighborhood: value }
                      case "city":
                        return { ...prev, address_city: value }
                      case "state":
                        return { ...prev, address_state: value.toUpperCase() }
                      default:
                        return prev
                    }
                  })
                }}
                onBulkChange={(fields) => {
                  setEmitterForm((prev) => ({
                    ...prev,
                    ...(fields.zip_code !== undefined ? { address_zip: fields.zip_code } : {}),
                    ...(fields.street_name !== undefined ? { address_street: fields.street_name } : {}),
                    ...(fields.house_number !== undefined ? { address_number: fields.house_number } : {}),
                    ...(fields.address_complement !== undefined ? { address_complement: fields.address_complement } : {}),
                    ...(fields.neighborhood !== undefined ? { address_neighborhood: fields.neighborhood } : {}),
                    ...(fields.city !== undefined ? { address_city: fields.city } : {}),
                    ...(fields.state !== undefined ? { address_state: fields.state.toUpperCase() } : {}),
                  }))
                }}
                errors={{
                  state: !emitterForm.address_state.trim() ? "UF é obrigatória para seleção automática de natureza" : undefined,
                }}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emitterForm.active}
                onChange={(event) => setEmitterForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Emitente ativo
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setEmitterDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleSaveEmitter} className="cursor-pointer">
              {editingEmitter ? "Salvar emitente" : "Criar emitente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!emitterDeleteTarget} onOpenChange={(v) => { if (!v) setEmitterDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir emitente?</AlertDialogTitle>
            <AlertDialogDescription>
              O emitente <strong>{emitterDeleteTarget?.name}</strong> será removido e desvinculado das naturezas de operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmitter}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir emitente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
