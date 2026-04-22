'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GitBranch,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Star,
  Power,
  PowerOff,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
} from 'lucide-react'
import {
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
  toggleBranchStatusAction,
  setDefaultBranchAction,
  duplicateBranchAction,
} from '@/lib/actions/branches'
import type { Branch, BranchStatus, CreateBranchInput, UpdateBranchInput } from '@/lib/types'
import type { AdminUserOption } from '@/lib/actions/branches'
import { toast } from 'sonner'

// ── Slug helpers ──────────────────────────────────────────────────────────────

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function getStorefrontBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

// ── Form state ────────────────────────────────────────────────────────────────

interface BranchFormState {
  name: string
  slug: string
  status: BranchStatus
  isDefault: boolean
  city: string
  state: string
  description: string
  responsibleName: string
  contactWhatsapp: string
  contactEmail: string
}

const EMPTY_FORM: BranchFormState = {
  name: '',
  slug: '',
  status: 'active',
  isDefault: false,
  city: '',
  state: '',
  description: '',
  responsibleName: '',
  contactWhatsapp: '',
  contactEmail: '',
}

function branchToForm(branch: Branch): BranchFormState {
  return {
    name: branch.name,
    slug: branch.slug,
    status: branch.status,
    isDefault: branch.isDefault,
    city: branch.city ?? '',
    state: branch.state ?? '',
    description: branch.description ?? '',
    responsibleName: branch.responsibleName ?? '',
    contactWhatsapp: branch.contactWhatsapp ?? '',
    contactEmail: branch.contactEmail ?? '',
  }
}

function formToCreateInput(form: BranchFormState): CreateBranchInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    status: form.status,
    isDefault: form.isDefault,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    description: form.description.trim() || null,
    responsibleName: form.responsibleName.trim() || null,
    contactWhatsapp: form.contactWhatsapp.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
  }
}

// ── Duplicate dialog ──────────────────────────────────────────────────────────

interface DuplicateDialogProps {
  open: boolean
  sourceBranch: Branch | null
  existingSlugs: string[]
  onClose: () => void
  onConfirm: (name: string, slug: string) => Promise<void>
}

function DuplicateDialog({ open, sourceBranch, existingSlugs, onClose, onConfirm }: DuplicateDialogProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open && sourceBranch) {
      const newName = `${sourceBranch.name} (cópia)`
      const newSlug = toSlug(newName)
      setName(newName)
      setSlug(newSlug)
      setSlugManual(false)
    }
  }, [open, sourceBranch])

  const slugConflict = existingSlugs.includes(slug)
  const canSubmit = name.trim().length > 0 && slug.length > 0 && isValidSlug(slug) && !slugConflict && !isSaving

  async function handleSubmit() {
    if (!canSubmit) return
    setIsSaving(true)
    await onConfirm(name.trim(), slug)
    setIsSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar Filial</DialogTitle>
          <DialogDescription>
            Informe o nome e slug da nova filial. Ela inicia inativa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugManual) setSlug(toSlug(e.target.value))
              }}
              placeholder="Ex: São Paulo Cópia"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(toSlug(e.target.value))
                setSlugManual(true)
              }}
              placeholder="ex: saopaulo-copia"
            />
            {slugConflict && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Este slug já está em uso
              </p>
            )}
            {slug && !isValidSlug(slug) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Slug inválido — use apenas letras, números e hífens
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSaving ? 'Criando...' : 'Duplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AdminBranchesPageClientProps {
  initialBranches: Branch[]
  adminUsers: AdminUserOption[]
}

export default function AdminBranchesPageClient({ initialBranches, adminUsers }: AdminBranchesPageClientProps) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM)
  const [slugManual, setSlugManual] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null)

  // Duplicate dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [branchToDuplicate, setBranchToDuplicate] = useState<Branch | null>(null)


  useEffect(() => {
    setBranches(initialBranches)
  }, [initialBranches])

  const storefrontBase = getStorefrontBaseUrl()
  const existingSlugs = branches.map((b) => b.slug)

  // ── Form validation ────────────────────────────────────────────────────────

  const slugConflict = (() => {
    if (!form.slug) return false
    if (editingBranch && editingBranch.slug === form.slug) return false
    return existingSlugs.includes(form.slug)
  })()

  const slugInvalid = form.slug.length > 0 && !isValidSlug(form.slug)

  const formErrors = {
    name: form.name.trim().length === 0 ? 'Nome obrigatório' : null,
    slug: slugConflict
      ? 'Este slug já está em uso'
      : slugInvalid
        ? 'Apenas letras minúsculas, números e hífens'
        : form.slug.length === 0
          ? 'Slug obrigatório'
          : null,
  }
  const formValid = !formErrors.name && !formErrors.slug

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingBranch(null)
    setForm(EMPTY_FORM)
    setSlugManual(false)

    setDialogOpen(true)
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch)
    setForm(branchToForm(branch))
    setSlugManual(true)

    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingBranch(null)
  }

  const updateForm = useCallback(<K extends keyof BranchFormState>(key: K, value: BranchFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'name' && !slugManual) {
        next.slug = toSlug(String(value))
      }
      return next
    })
  }, [slugManual])

  // ── Save branch ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!formValid || isSaving) return
    setIsSaving(true)

    const input = formToCreateInput(form)

    let result: Awaited<ReturnType<typeof createBranchAction>>
    if (editingBranch) {
      const updateInput: UpdateBranchInput = input
      result = await updateBranchAction(editingBranch.id, updateInput)
    } else {
      result = await createBranchAction(input)
    }

    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error ?? 'Erro ao salvar filial')
      return
    }

    toast.success(editingBranch ? 'Filial atualizada' : 'Filial criada')
    closeDialog()
    router.refresh()

    if (result.data) {
      setBranches((prev) => {
        if (editingBranch) {
          return prev.map((b) => b.id === editingBranch.id ? result.data! : b)
        }
        return [...prev, result.data!]
      })
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────────────

  async function handleToggleStatus(branch: Branch) {
    const newStatus: BranchStatus = branch.status === 'active' ? 'inactive' : 'active'
    setIsSaving(true)
    const result = await toggleBranchStatusAction(branch.id, newStatus)
    setIsSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao alterar status')
      return
    }
    setBranches((prev) => prev.map((b) => b.id === branch.id ? { ...b, status: newStatus } : b))
    toast.success(newStatus === 'active' ? 'Filial ativada' : 'Filial desativada')
    router.refresh()
  }

  // ── Set default ────────────────────────────────────────────────────────────

  async function handleSetDefault(branch: Branch) {
    if (branch.isDefault) return
    setIsSaving(true)
    const result = await setDefaultBranchAction(branch.id)
    setIsSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao definir padrão')
      return
    }
    setBranches((prev) => prev.map((b) => ({ ...b, isDefault: b.id === branch.id })))
    toast.success(`"${branch.name}" definida como filial padrão`)
    router.refresh()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!branchToDelete) return
    setIsSaving(true)
    const result = await deleteBranchAction(branchToDelete.id)
    setIsSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao remover filial')
      return
    }
    setBranches((prev) => prev.filter((b) => b.id !== branchToDelete.id))
    toast.success('Filial removida')
    setDeleteDialogOpen(false)
    setBranchToDelete(null)
    router.refresh()
  }

  // ── Duplicate ──────────────────────────────────────────────────────────────

  async function handleDuplicate(name: string, slug: string) {
    if (!branchToDuplicate) return
    const result = await duplicateBranchAction(branchToDuplicate.id, { name, slug })
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao duplicar filial')
      return
    }
    if (result.data) {
      setBranches((prev) => [...prev, result.data!])
    }
    toast.success('Filial duplicada')
    setDuplicateDialogOpen(false)
    setBranchToDuplicate(null)
    router.refresh()
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = branches.filter((b) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      (b.city ?? '').toLowerCase().includes(q) ||
      (b.state ?? '').toLowerCase().includes(q) ||
      (b.responsibleName ?? '').toLowerCase().includes(q)
    )
  })

  const activeCount = branches.filter((b) => b.status === 'active').length
  const inactiveCount = branches.filter((b) => b.status === 'inactive').length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
              <GitBranch className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Filiais</h1>
              <p className="text-xs text-muted-foreground">
                URLs segmentadas da loja — ex: brand.com/saopaulo
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 rounded-2xl shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Filial</span>
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: branches.length, icon: GitBranch, color: 'text-foreground' },
          { label: 'Ativas', value: activeCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inativas', value: inactiveCount, icon: CircleDashed, color: 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
            <Icon className={`h-4 w-4 ${color} shrink-0`} />
            <div>
              <p className="text-lg font-semibold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar filiais..."
            className="pl-9 rounded-2xl"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <GitBranch className="h-10 w-10 text-muted-foreground/30" />
            {branches.length === 0 ? (
              <>
                <p className="font-medium text-muted-foreground">Nenhuma filial criada</p>
                <p className="text-sm text-muted-foreground/70">
                  Crie sua primeira filial para segmentar a loja por URL.
                </p>
                <Button onClick={openCreate} variant="outline" className="mt-2 gap-2 rounded-2xl">
                  <Plus className="h-4 w-4" />
                  Nova Filial
                </Button>
              </>
            ) : (
              <p className="font-medium text-muted-foreground">Nenhuma filial encontrada</p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="pl-5">Filial</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((branch) => (
                    <BranchRow
                      key={branch.id}
                      branch={branch}
                      storefrontBase={storefrontBase}
                      isSaving={isSaving}
                      onEdit={openEdit}
                      onToggleStatus={handleToggleStatus}
                      onSetDefault={handleSetDefault}
                      onDuplicate={(b) => { setBranchToDuplicate(b); setDuplicateDialogOpen(true) }}
                      onDelete={(b) => { setBranchToDelete(b); setDeleteDialogOpen(true) }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/40">
              {filtered.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  storefrontBase={storefrontBase}
                  isSaving={isSaving}
                  onEdit={openEdit}
                  onToggleStatus={handleToggleStatus}
                  onSetDefault={handleSetDefault}
                  onDuplicate={(b) => { setBranchToDuplicate(b); setDuplicateDialogOpen(true) }}
                  onDelete={(b) => { setBranchToDelete(b); setDeleteDialogOpen(true) }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Editar Filial' : 'Nova Filial'}</DialogTitle>
            <DialogDescription>
              {editingBranch
                ? 'Atualize os dados da filial.'
                : 'Preencha os dados para criar uma nova filial segmentada.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* URL preview */}
            {form.slug && (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {storefrontBase}/<span className="font-semibold text-foreground">{form.slug || 'slug'}</span>
                </span>
              </div>
            )}

            {/* Main data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Ex: São Paulo"
                />
                {form.name.trim().length === 0 && isSaving && (
                  <p className="text-xs text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Slug <span className="text-destructive">*</span>
                  <span className="text-[11px] text-muted-foreground ml-1 font-normal">(URL)</span>
                </Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    updateForm('slug', toSlug(e.target.value))
                    setSlugManual(true)
                  }}
                  placeholder="ex: saopaulo"
                />
                {formErrors.slug && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.slug}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => updateForm('status', v as BranchStatus)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => updateForm('city', e.target.value)}
                  placeholder="São Paulo"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input
                  value={form.state}
                  onChange={(e) => updateForm('state', e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Descrição opcional da filial"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center justify-between sm:col-span-2 rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Filial padrão</p>
                  <p className="text-xs text-muted-foreground">
                    Utilizada quando nenhuma filial específica for identificada
                  </p>
                </div>
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(v) => updateForm('isDefault', v)}
                />
              </div>
            </div>

            {/* Contact section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Responsável</Label>
                  {adminUsers.length > 0 ? (
                    <Select
                      value={form.responsibleName || '__none__'}
                      onValueChange={(v) => updateForm('responsibleName', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Selecionar responsável..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {adminUsers.map((user) => (
                          <SelectItem key={user.id} value={user.name}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.responsibleName}
                      onChange={(e) => updateForm('responsibleName', e.target.value)}
                      placeholder="Nome do responsável"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail de contato</Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateForm('contactEmail', e.target.value)}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={form.contactWhatsapp}
                    onChange={(e) => updateForm('contactWhatsapp', e.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formValid || isSaving}>
              {isSaving ? 'Salvando...' : editingBranch ? 'Salvar' : 'Criar Filial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover filial</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{' '}
              <span className="font-semibold">"{branchToDelete?.name}"</span>?{' '}
              Dados históricos (pedidos, clientes) com este branch_id são preservados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Duplicate dialog ──────────────────────────────────────────────────── */}
      <DuplicateDialog
        open={duplicateDialogOpen}
        sourceBranch={branchToDuplicate}
        existingSlugs={existingSlugs}
        onClose={() => { setDuplicateDialogOpen(false); setBranchToDuplicate(null) }}
        onConfirm={handleDuplicate}
      />
    </div>
  )
}

// ── Branch table row ──────────────────────────────────────────────────────────

interface BranchRowProps {
  branch: Branch
  storefrontBase: string
  isSaving: boolean
  onEdit: (b: Branch) => void
  onToggleStatus: (b: Branch) => void
  onSetDefault: (b: Branch) => void
  onDuplicate: (b: Branch) => void
  onDelete: (b: Branch) => void
}

function BranchRow({
  branch,
  storefrontBase,
  isSaving,
  onEdit,
  onToggleStatus,
  onSetDefault,
  onDuplicate,
  onDelete,
}: BranchRowProps) {
  const url = `${storefrontBase}/${branch.slug}`

  return (
    <TableRow className="group">
      <TableCell className="pl-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${branch.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate">{branch.name}</span>
              {branch.isDefault && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 shrink-0">
                  Padrão
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">/{branch.slug}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group/link"
        >
          <span className="font-mono truncate max-w-[160px]">{url}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
        </a>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs ${
            branch.status === 'active'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400'
              : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          {branch.status === 'active' ? 'Ativa' : 'Inativa'}
        </Badge>
      </TableCell>
      <TableCell>
        {branch.city && branch.state
          ? <span className="text-sm">{branch.city}, {branch.state}</span>
          : branch.city || branch.state
            ? <span className="text-sm">{branch.city || branch.state}</span>
            : <span className="text-muted-foreground/40 text-xs">—</span>}
      </TableCell>
      <TableCell>
        {branch.responsibleName
          ? <span className="text-sm">{branch.responsibleName}</span>
          : <span className="text-muted-foreground/40 text-xs">—</span>}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {branch.createdAt.toLocaleDateString('pt-BR')}
        </span>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" disabled={isSaving}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit(branch)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDefault(branch)} disabled={branch.isDefault} className="gap-2">
              <Star className="h-3.5 w-3.5" />
              Definir como padrão
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(branch)} className="gap-2">
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleStatus(branch)} className="gap-2">
              {branch.status === 'active'
                ? <><PowerOff className="h-3.5 w-3.5" />Desativar</>
                : <><Power className="h-3.5 w-3.5" />Ativar</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(branch)}
              className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

// ── Branch mobile card ────────────────────────────────────────────────────────

function BranchCard({
  branch,
  storefrontBase,
  isSaving,
  onEdit,
  onToggleStatus,
  onSetDefault,
  onDuplicate,
  onDelete,
}: BranchRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${branch.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm">{branch.name}</span>
            {branch.isDefault && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 shrink-0">
                Padrão
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ${
                branch.status === 'active'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20'
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {branch.status === 'active' ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <a
            href={`${storefrontBase}/${branch.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="font-mono">/{branch.slug}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          {(branch.city || branch.responsibleName) && (
            <p className="text-xs text-muted-foreground">
              {[branch.city && branch.state ? `${branch.city}, ${branch.state}` : branch.city, branch.responsibleName]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isSaving}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onEdit(branch)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetDefault(branch)} disabled={branch.isDefault} className="gap-2">
            <Star className="h-3.5 w-3.5" />
            Definir como padrão
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(branch)} className="gap-2">
            <Copy className="h-3.5 w-3.5" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onToggleStatus(branch)} className="gap-2">
            {branch.status === 'active'
              ? <><PowerOff className="h-3.5 w-3.5" />Desativar</>
              : <><Power className="h-3.5 w-3.5" />Ativar</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(branch)}
            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
