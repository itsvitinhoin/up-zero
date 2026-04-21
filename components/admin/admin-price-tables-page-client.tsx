"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import PercentageInput from "@/components/form/PercentageInput"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, MoreHorizontal, Pencil, Trash2, DollarSign } from "lucide-react"
import {
  createPriceTableAction,
  updatePriceTableAction,
  deletePriceTableAction,
} from "@/lib/actions/settings"
import type { PriceTable } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { AdminHero, AdminPage, AdminPanel, DesktopOnly, MobileCardList } from "@/components/admin/admin-mobile-ui"

interface AdminPriceTablesPageClientProps {
  initialPriceTables: PriceTable[]
}

export default function AdminPriceTablesPageClient({
  initialPriceTables,
}: AdminPriceTablesPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [priceTables, setPriceTables] = useState<PriceTable[]>(initialPriceTables)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<PriceTable | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "PERCENTAGE" as "PERCENTAGE" | "OVERRIDE",
    percentage: "",
    isActive: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<string | null>(null)

  useEffect(() => {
    setPriceTables(initialPriceTables)
  }, [initialPriceTables])

  function openCreateDialog() {
    setEditingTable(null)
    setFormData({
      name: "",
      type: "PERCENTAGE",
      percentage: "",
      isActive: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(table: PriceTable) {
    setEditingTable(table)
    setFormData({
      name: table.name,
      type: table.type,
      percentage: table.percentage !== null ? Math.abs(table.percentage).toString() : "",
      isActive: table.isActive,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        description: "Nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const fd = new FormData()
      fd.append("name", formData.name)
      fd.append("type", formData.type)
      if (formData.type === "PERCENTAGE" && formData.percentage) {
        fd.append("percentage", Math.abs(Number(formData.percentage)).toString())
      }
      fd.append("isActive", String(formData.isActive))

      if (editingTable) {
        const result = await updatePriceTableAction(editingTable.id, fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao atualizar tabela",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }

        toast({ description: "Tabela atualizada com sucesso" })

        if (result.data) {
          setPriceTables((prev) =>
            prev.map((table) => (table.id === editingTable.id ? result.data! : table))
          )
        }
      } else {
        const result = await createPriceTableAction(fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao criar tabela",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }

        toast({ description: "Tabela criada com sucesso" })

        if (result.data) {
          setPriceTables((prev) => [result.data!, ...prev])
        }
      }

      setIsDialogOpen(false)
      router.refresh()
    } catch {
      toast({
        description: "Erro ao salvar tabela",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleDelete(id: string) {
    setTableToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!tableToDelete) return

    try {
      const result = await deletePriceTableAction(tableToDelete)
      if (!result.success) {
        toast({
          description: result.error || "Erro ao deletar tabela",
          variant: "destructive",
        })
        setDeleteDialogOpen(false)
        setTableToDelete(null)
        return
      }

      toast({ description: "Tabela deletada com sucesso" })
      setPriceTables((prev) => prev.filter((table) => table.id !== tableToDelete))
      setDeleteDialogOpen(false)
      setTableToDelete(null)
      router.refresh()
    } catch {
      toast({
        description: "Erro ao deletar tabela",
        variant: "destructive",
      })
      setDeleteDialogOpen(false)
      setTableToDelete(null)
    }
  }

  return (
    <>
      <AdminPage>
        <AdminHero
          icon={DollarSign}
          eyebrow="Precos"
          title="Regras de preco"
          description="Configure precos diferenciados para clientes B2B com leitura clara no mobile."
          actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="min-h-12 rounded-2xl cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Nova Tabela
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTable ? "Editar Regra" : "Nova Regra de Preço"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Atacado Premium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "PERCENTAGE" | "OVERRIDE") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentual sobre preço base</SelectItem>
                      <SelectItem value="OVERRIDE">Preços fixos por produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "PERCENTAGE" && (
                  <div className="space-y-2">
                    <Label htmlFor="percentage">Percentual (%)</Label>
                    <PercentageInput
                      value={formData.percentage ? parseFloat(formData.percentage) / 100 : 0}
                      onChange={(value) => setFormData({ ...formData, percentage: value == null ? "" : Math.abs(value * 100).toString() })}
                      placeholder="Ex: 10% para desconto de 10%"
                      allowNegative={false}
                      min={0}
                      max={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      Informe apenas valores positivos (ex: 10% = 10% de desconto)
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="isActive">Status</Label>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      {formData.isActive ? "Tabela ativa" : "Tabela inativa"}
                    </span>
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSaving}
                    className="cursor-pointer"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="cursor-pointer">
                    {isSaving ? "Salvando..." : editingTable ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          }
        />

        <MobileCardList>
          {priceTables.length === 0 ? (
            <AdminPanel>
              <div className="py-8 text-center">
                <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma regra de preço</p>
              </div>
            </AdminPanel>
          ) : (
            priceTables.map((table) => (
              <AdminPanel key={table.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">{table.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {table.type === "PERCENTAGE" && table.percentage !== undefined && table.percentage !== null
                          ? `${Math.abs(table.percentage)}%`
                          : "Preco fixo por produto"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={table.isActive
                        ? "text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200"
                      }
                    >
                      {table.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <Badge variant="outline" className={table.type === "PERCENTAGE" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-violet-50 text-violet-600 border-violet-100"}>
                    {table.type === "PERCENTAGE" ? "Percentual" : "Preco fixo"}
                  </Badge>
                </div>
              </AdminPanel>
            ))
          )}
        </MobileCardList>

        <DesktopOnly>
        <div className="rounded-[24px] border border-border/60 bg-card/95 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceTables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <DollarSign className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma regra de preço</p>
                  </TableCell>
                </TableRow>
              ) : (
                priceTables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={table.type === "PERCENTAGE" ? "text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100" : "text-xs font-medium bg-violet-50 text-violet-600 border border-violet-100"}>
                        {table.type === "PERCENTAGE" ? "Percentual" : "Preço Fixo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {table.type === "PERCENTAGE" && table.percentage !== undefined && table.percentage !== null
                        ? `${Math.abs(table.percentage)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={table.isActive
                          ? "text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : "text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200"
                        }
                      >
                        {table.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="cursor-pointer">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(table)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(table.id)}
                            className="text-destructive cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </DesktopOnly>
      </AdminPage>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
              <AlertDialogTitle>Excluir regra de preço?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A regra de preço e seus itens serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTableToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
