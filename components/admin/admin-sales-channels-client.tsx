'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  createSalesChannelAction,
  updateSalesChannelAction,
  deleteSalesChannelAction,
  type SalesChannel,
} from '@/lib/actions/sales-channels'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2, Tag, Settings2 } from 'lucide-react'

type DialogMode = 'create' | 'edit' | 'delete' | null

interface ChannelFormData {
  name: string
  code: string
  description: string
  is_default: boolean
  is_active: boolean
  min_qty: number
  sort_order: number
}

const emptyForm = (): ChannelFormData => ({
  name: '',
  code: '',
  description: '',
  is_default: false,
  is_active: true,
  min_qty: 1,
  sort_order: 0,
})

export function AdminSalesChannelsClient({ initialChannels }: { initialChannels: SalesChannel[] }) {
  const router = useRouter()
  const [channels, setChannels] = useState<SalesChannel[]>(initialChannels)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel | null>(null)
  const [form, setForm] = useState<ChannelFormData>(emptyForm())
  const [loading, setLoading] = useState(false)

  const openCreate = () => {
    setForm(emptyForm())
    setSelectedChannel(null)
    setDialogMode('create')
  }

  const openEdit = (c: SalesChannel) => {
    setSelectedChannel(c)
    setForm({
      name: c.name,
      code: c.code,
      description: c.description ?? '',
      is_default: c.is_default,
      is_active: c.is_active,
      min_qty: c.min_qty,
      sort_order: c.sort_order,
    })
    setDialogMode('edit')
  }

  const openDelete = (c: SalesChannel) => {
    setSelectedChannel(c)
    setDialogMode('delete')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedChannel(null)
  }

  const handleSubmitCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Nome e código são obrigatórios')
      return
    }
    setLoading(true)
    const result = await createSalesChannelAction({
      name: form.name,
      code: form.code.toLowerCase().replace(/\s+/g, '-'),
      description: form.description || undefined,
      is_default: form.is_default,
      is_active: form.is_active,
      min_qty: form.min_qty,
      sort_order: form.sort_order,
    })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao criar canal')
      return
    }
    toast.success('Canal criado com sucesso')
    setChannels(prev => [...prev, result.data!])
    closeDialog()
    router.refresh()
  }

  const handleSubmitEdit = async () => {
    if (!selectedChannel || !form.name.trim()) return
    setLoading(true)
    const result = await updateSalesChannelAction(selectedChannel.id, {
      name: form.name,
      description: form.description || undefined,
      is_default: form.is_default,
      is_active: form.is_active,
      min_qty: form.min_qty,
      sort_order: form.sort_order,
    })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao atualizar canal')
      return
    }
    toast.success('Canal atualizado')
    setChannels(prev => prev.map(c => c.id === selectedChannel.id ? result.data! : c))
    closeDialog()
    router.refresh()
  }

  const handleDelete = async () => {
    if (!selectedChannel) return
    setLoading(true)
    const result = await deleteSalesChannelAction(selectedChannel.id)
    setLoading(false)
    if (!result.success) {
      toast.error(result.error ?? 'Erro ao excluir canal')
      return
    }
    toast.success('Canal excluído')
    setChannels(prev => prev.filter(c => c.id !== selectedChannel.id))
    closeDialog()
    router.refresh()
  }

  const renderChannelForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input
            placeholder="Ex: Atacado"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Código *</Label>
          <Input
            placeholder="Ex: wholesale"
            value={form.code}
            disabled={dialogMode === 'edit'}
            onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
          />
          {dialogMode === 'create' && (
            <p className="text-xs text-muted-foreground">Único, sem espaços. Não pode ser alterado.</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Input
          placeholder="Descrição opcional"
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Qtd. Mínima de Peças</Label>
          <Input
            type="number"
            min={1}
            value={form.min_qty}
            onChange={e => setForm(p => ({ ...p, min_qty: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ordem de Exibição</Label>
          <Input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_active}
            onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))}
          />
          <Label>Ativo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_default}
            onCheckedChange={v => setForm(p => ({ ...p, is_default: v }))}
          />
          <Label>Canal Padrão</Label>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Canais de Venda
          </h1>
          <p className="text-sm text-muted-foreground">
            {channels.length} canal{channels.length !== 1 ? 'is' : ''} cadastrado{channels.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Canal
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-xl border border-border/20 shadow-none overflow-hidden p-0">
        {channels.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Nenhum canal cadastrado ainda
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Qtd. Mín.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map(c => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/sales-channels/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{c.code}</TableCell>
                  <TableCell className="text-sm">{c.min_qty} pç{c.min_qty !== 1 ? 's' : ''}</TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.is_default && (
                      <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">Padrão</Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sales-channels/${c.id}`}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            Gerenciar Preços
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Canal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => openDelete(c)}
                          disabled={c.is_default}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Canal de Venda</DialogTitle>
            <DialogDescription>Configure um canal de preços para seu negócio</DialogDescription>
          </DialogHeader>
          {renderChannelForm()}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmitCreate} disabled={loading}>
              {loading ? 'Criando...' : 'Criar Canal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Canal</DialogTitle>
            <DialogDescription>Atualize as informações do canal <strong>{selectedChannel?.name}</strong></DialogDescription>
          </DialogHeader>
          {renderChannelForm()}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmitEdit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Canal</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o canal <strong>{selectedChannel?.name}</strong>?
              Todos os preços vinculados serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
