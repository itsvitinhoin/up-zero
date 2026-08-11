'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createWmsWarehouseAction,
  deleteWmsWarehouseAction,
  type WmsWarehouse,
  updateWmsWarehouseAction,
} from '@/lib/actions/wms'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminStore } from '@/contexts/admin-store-context'

type DialogMode = 'create' | 'edit' | 'delete' | null

type Props = {
  initialWarehouses: WmsWarehouse[]
  loadError?: string | null
}

type WarehouseForm = {
  code: string
  name: string
  active: boolean
}

function emptyForm(): WarehouseForm {
  return { code: '', name: '', active: true }
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
}

export default function AdminWmsWarehousesClient({ initialWarehouses, loadError }: Props) {
  const router = useRouter()
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canEditInventory = permissionCodes === null || permissionCodes.includes('inventory.edit')
  const [warehouses, setWarehouses] = useState<WmsWarehouse[]>(initialWarehouses)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selected, setSelected] = useState<WmsWarehouse | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<WarehouseForm>(emptyForm())

  function closeDialog() {
    setDialogMode(null)
    setSelected(null)
  }

  function openCreate() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setForm(emptyForm())
    setSelected(null)
    setDialogMode('create')
  }

  function openEdit(item: WmsWarehouse) {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setSelected(item)
    setForm({ code: item.code, name: item.name, active: item.active })
    setDialogMode('edit')
  }

  function openDelete(item: WmsWarehouse) {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setSelected(item)
    setDialogMode('delete')
  }

  async function handleCreate() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Codigo e nome sao obrigatorios')
      return
    }

    setLoading(true)
    const result = await createWmsWarehouseAction({
      code: normalizeCode(form.code),
      name: form.name.trim(),
      active: form.active,
      meta: {},
    })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setWarehouses((prev) => [...prev, result.data])
    toast.success('Warehouse criado com sucesso')
    closeDialog()
    router.refresh()
  }

  async function handleEdit() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!selected) return
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Codigo e nome sao obrigatorios')
      return
    }

    setLoading(true)
    const result = await updateWmsWarehouseAction(selected.id, {
      code: normalizeCode(form.code),
      name: form.name.trim(),
      active: form.active,
    })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setWarehouses((prev) => prev.map((w) => (w.id === selected.id ? result.data : w)))
    toast.success('Warehouse atualizado')
    closeDialog()
    router.refresh()
  }

  async function handleDelete() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!selected) return

    setLoading(true)
    const result = await deleteWmsWarehouseAction(selected.id)
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setWarehouses((prev) => prev.filter((w) => w.id !== selected.id))
    toast.success('Warehouse removido')
    closeDialog()
    router.refresh()
  }

  return (
    <div className='space-y-6 p-6 lg:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='flex items-center gap-2 text-lg font-medium text-foreground'>
            <Building2 className='h-5 w-5 text-primary' />
            WMS - Warehouses
          </h1>
          <p className='text-sm text-muted-foreground'>
            {warehouses.length} warehouse{warehouses.length === 1 ? '' : 's'}
          </p>
          {loadError ? <p className='mt-1 text-sm text-destructive'>{loadError}</p> : null}
        </div>

        {canEditInventory ? (
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-1 h-4 w-4' />
            Novo Warehouse
          </Button>
        ) : null}
      </div>

      <Card className='overflow-hidden rounded-xl border border-border/20 p-0 shadow-none'>
        {warehouses.length === 0 ? (
          <div className='flex h-40 items-center justify-center text-muted-foreground'>
            Nenhum warehouse cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='w-12' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell>{warehouse.id}</TableCell>
                  <TableCell className='font-mono text-sm'>{warehouse.code}</TableCell>
                  <TableCell className='font-medium'>{warehouse.name}</TableCell>
                  <TableCell>
                    {warehouse.active ? (
                      <Badge variant='outline' className='border-green-300 bg-green-50 text-green-700'>Ativo</Badge>
                    ) : (
                      <Badge variant='secondary'>Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEditInventory ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='sm'>
                          <MoreVertical className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => openEdit(warehouse)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className='text-destructive focus:text-destructive'
                          onClick={() => openDelete(warehouse)}
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogMode === 'create' || dialogMode === 'edit'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Novo Warehouse' : 'Editar Warehouse'}</DialogTitle>
            <DialogDescription>Configure o centro de distribuicao da loja.</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label>Codigo *</Label>
                <Input
                  placeholder='CD_SP'
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Nome *</Label>
                <Input
                  placeholder='CD Sao Paulo'
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Switch
                checked={form.active}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
              />
              <Label>Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>Cancelar</Button>
            <Button onClick={dialogMode === 'create' ? handleCreate : handleEdit} disabled={loading || !canEditInventory}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === 'delete'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Warehouse</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {selected?.name || 'este warehouse'}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete} disabled={loading || !canEditInventory}>
              {loading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
