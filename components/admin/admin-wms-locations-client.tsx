'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, MapPin, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createWmsLocationAction,
  deleteWmsLocationAction,
  type WmsLocation,
  type WmsWarehouse,
  updateWmsLocationAction,
} from '@/lib/actions/wms'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminStore } from '@/contexts/admin-store-context'

type DialogMode = 'create' | 'edit' | 'delete' | null

type Props = {
  initialLocations: WmsLocation[]
  warehouses: WmsWarehouse[]
  loadError?: string | null
}

type FormState = {
  warehouse_id: string
  code: string
  type: string
  priority: string
  active: boolean
}

function emptyForm(warehouseId?: number): FormState {
  return {
    warehouse_id: warehouseId ? String(warehouseId) : '',
    code: '',
    type: 'SELLABLE',
    priority: '100',
    active: true,
  }
}

const LOCATION_TYPES = ['SELLABLE', 'PICKING', 'RECEIVING', 'PACKING', 'SHIPPING', 'QUARANTINE', 'DAMAGED']

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
}

export default function AdminWmsLocationsClient({ initialLocations, warehouses, loadError }: Props) {
  const router = useRouter()
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canEditInventory = permissionCodes === null || permissionCodes.includes('inventory.edit')
  const [locations, setLocations] = useState<WmsLocation[]>(initialLocations)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selected, setSelected] = useState<WmsLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [form, setForm] = useState<FormState>(emptyForm(warehouses[0]?.id))

  const filtered = useMemo(() => {
    if (warehouseFilter === 'all') return locations
    const id = Number(warehouseFilter)
    return locations.filter((location) => location.warehouse_id === id)
  }, [locations, warehouseFilter])

  function closeDialog() {
    setDialogMode(null)
    setSelected(null)
  }

  function openCreate() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    const firstWarehouseId = warehouseFilter !== 'all' ? Number(warehouseFilter) : warehouses[0]?.id
    setForm(emptyForm(firstWarehouseId))
    setSelected(null)
    setDialogMode('create')
  }

  function openEdit(item: WmsLocation) {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    setSelected(item)
    setForm({
      warehouse_id: String(item.warehouse_id),
      code: item.code,
      type: item.type,
      priority: String(item.priority),
      active: item.active,
    })
    setDialogMode('edit')
  }

  function openDelete(item: WmsLocation) {
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

    const warehouse_id = Number(form.warehouse_id)
    if (!warehouse_id || !form.code.trim()) {
      toast.error('Warehouse e codigo sao obrigatorios')
      return
    }

    setLoading(true)
    const result = await createWmsLocationAction({
      warehouse_id,
      code: normalizeCode(form.code),
      type: form.type,
      priority: Number(form.priority) || 100,
      active: form.active,
    })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setLocations((prev) => [...prev, result.data])
    toast.success('Localizacao criada com sucesso')
    closeDialog()
    router.refresh()
  }

  async function handleEdit() {
    if (!canEditInventory) {
      toast.error('Você não tem permissão para editar estoque')
      return
    }

    if (!selected) return

    setLoading(true)
    const result = await updateWmsLocationAction(selected.id, {
      code: normalizeCode(form.code),
      type: form.type,
      priority: Number(form.priority) || 100,
      active: form.active,
    })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setLocations((prev) => prev.map((location) => (location.id === selected.id ? result.data : location)))
    toast.success('Localizacao atualizada')
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
    const result = await deleteWmsLocationAction(selected.id)
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setLocations((prev) => prev.filter((location) => location.id !== selected.id))
    toast.success('Localizacao removida')
    closeDialog()
    router.refresh()
  }

  function warehouseLabel(warehouseId: number): string {
    const warehouse = warehouses.find((item) => item.id === warehouseId)
    if (!warehouse) return `#${warehouseId}`
    return `${warehouse.code} - ${warehouse.name}`
  }

  return (
    <div className='space-y-6 p-6 lg:p-8'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='flex items-center gap-2 text-lg font-medium text-foreground'>
            <MapPin className='h-5 w-5 text-primary' />
            WMS - Localizacoes
          </h1>
          <p className='text-sm text-muted-foreground'>
            {locations.length} localizacao{locations.length === 1 ? '' : 'oes'}
          </p>
          {loadError ? <p className='mt-1 text-sm text-destructive'>{loadError}</p> : null}
        </div>

        <div className='flex items-center gap-2'>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className='w-56'>
              <SelectValue placeholder='Filtrar warehouse' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos os warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.code} - {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEditInventory ? (
            <Button size='sm' onClick={openCreate} disabled={warehouses.length === 0}>
              <Plus className='mr-1 h-4 w-4' />
              Nova Localizacao
            </Button>
          ) : null}
        </div>
      </div>

      <Card className='overflow-hidden rounded-xl border border-border/20 p-0 shadow-none'>
        {filtered.length === 0 ? (
          <div className='flex h-40 items-center justify-center text-muted-foreground'>
            Nenhuma localizacao encontrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='w-12' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>{location.id}</TableCell>
                  <TableCell className='text-sm'>
                    <span className='inline-flex items-center gap-1'>
                      <Building2 className='h-3.5 w-3.5 text-muted-foreground' />
                      {warehouseLabel(location.warehouse_id)}
                    </span>
                  </TableCell>
                  <TableCell className='font-mono text-sm'>{location.code}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{location.type}</Badge>
                  </TableCell>
                  <TableCell>{location.priority}</TableCell>
                  <TableCell>
                    {location.active ? (
                      <Badge variant='outline' className='border-green-300 bg-green-50 text-green-700'>Ativa</Badge>
                    ) : (
                      <Badge variant='secondary'>Inativa</Badge>
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
                        <DropdownMenuItem onClick={() => openEdit(location)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className='text-destructive focus:text-destructive'
                          onClick={() => openDelete(location)}
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
            <DialogTitle>{dialogMode === 'create' ? 'Nova Localizacao' : 'Editar Localizacao'}</DialogTitle>
            <DialogDescription>Configure uma posicao logistica dentro do warehouse.</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>Warehouse *</Label>
              <Select
                value={form.warehouse_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, warehouse_id: value }))}
                disabled={dialogMode === 'edit'}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Selecione o warehouse' />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div className='space-y-1.5'>
                <Label>Codigo *</Label>
                <Input
                  placeholder='A01-01'
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Prioridade</Label>
                <Input
                  type='number'
                  min={1}
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                />
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Switch
                checked={form.active}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
              />
              <Label>Ativa</Label>
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
            <DialogTitle>Excluir Localizacao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {selected?.code || 'esta localizacao'}?
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
