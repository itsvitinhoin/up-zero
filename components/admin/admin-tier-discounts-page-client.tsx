"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import IntegerInput from "@/components/form/IntegerInput"
import PercentageInput from "@/components/form/PercentageInput"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Switch } from "@/components/ui/switch"
import { Plus, MoreHorizontal, Pencil, Trash2, Layers } from "lucide-react"
import {
  getTierDiscountsAction,
  createTierDiscountAction,
  updateTierDiscountAction,
  deleteTierDiscountAction,
} from "@/lib/actions/settings"
import type { TierDiscount } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface AdminTierDiscountsPageClientProps {
  initialTiers: TierDiscount[]
}

export default function AdminTierDiscountsPageClient({
  initialTiers,
}: AdminTierDiscountsPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [tiers, setTiers] = useState<TierDiscount[]>(initialTiers)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<TierDiscount | null>(null)
  const [formData, setFormData] = useState({
    minPieces: "",
    discountPct: "",
    isActive: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tierToDelete, setTierToDelete] = useState<string | null>(null)

  function openCreateDialog() {
    setEditingTier(null)
    setFormData({
      minPieces: "",
      discountPct: "",
      isActive: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(tier: TierDiscount) {
    setEditingTier(tier)
    setFormData({
      minPieces: tier.minPieces.toString(),
      discountPct: tier.discountPct.toString(),
      isActive: tier.isActive,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.minPieces.trim()) {
      toast({
        description: "Mínimo de peças é obrigatório",
        variant: "destructive",
      })
      return
    }

    if (!formData.discountPct.trim()) {
      toast({
        description: "Desconto é obrigatório",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const fd = new FormData()
      fd.append("minPieces", formData.minPieces)
      fd.append("discountPct", formData.discountPct)
      fd.append("isActive", String(formData.isActive))

      if (editingTier) {
        const result = await updateTierDiscountAction(editingTier.id, fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao atualizar tier",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: "Tier atualizado com sucesso",
        })

        if (result.data) {
          setTiers((prev) =>
            prev.map((tier) =>
              tier.id === editingTier.id ? result.data! : tier
            )
          )
        }
      } else {
        const result = await createTierDiscountAction(fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao criar tier",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: "Tier criado com sucesso",
        })

        if (result.data) {
          setTiers((prev) => [result.data!, ...prev])
        }
      }

      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        description: "Erro ao salvar tier",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleDelete(id: string) {
    setTierToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!tierToDelete) return

    try {
      const result = await deleteTierDiscountAction(tierToDelete)
      if (!result.success) {
        toast({
          description: result.error || "Erro ao deletar tier",
          variant: "destructive",
        })
        setDeleteDialogOpen(false)
        setTierToDelete(null)
        return
      }

      toast({
        description: "Tier deletado com sucesso",
      })
      setTiers((prev) => prev.filter((tier) => tier.id !== tierToDelete))
      setDeleteDialogOpen(false)
      setTierToDelete(null)
      router.refresh()
    } catch (error) {
      toast({
        description: "Erro ao deletar tier",
        variant: "destructive",
      })
      setDeleteDialogOpen(false)
      setTierToDelete(null)
    }
  }

  return (
    <>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Descontos por Quantidade
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure descontos progressivos baseados na quantidade
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Novo Tier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTier ? "Editar Tier de Desconto" : "Novo Tier de Desconto"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="minPieces">Mínimo de Peças</Label>
                  <IntegerInput
                    value={formData.minPieces === "" ? null : Number(formData.minPieces)}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        minPieces: value == null ? "" : String(value),
                      })
                    }
                    placeholder="Ex: 6"
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountPct">Desconto (%)</Label>
                  <PercentageInput
                    value={formData.discountPct === "" ? null : Number(formData.discountPct) / 100}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        discountPct:
                          value == null
                            ? ""
                            : String(Number((value * 100).toFixed(2))),
                      })
                    }
                    placeholder="Ex: 5"
                    min={0}
                    max={100}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive">Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.isActive ? "Tier ativo" : "Tier inativo"}
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
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
                    {isSaving ? "Salvando..." : editingTier ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-blue-100 p-4 bg-blue-50">
          <p className="text-sm text-blue-600">
            <strong>Como funciona:</strong> Quando o cliente atingir o mínimo de
            peças no carrinho, o desconto percentual é aplicado automaticamente.
            Os tiers são cumulativos - o maior tier aplicável será usado.
          </p>
        </div>

        <div className="rounded-xl border border-border/20 bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mínimo de Peças</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Layers className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum tier configurado</p>
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">
                      {tier.minPieces}+ peças
                    </TableCell>
                    <TableCell>{tier.discountPct}%</TableCell>
                    <TableCell>
                      {tier.isActive ? (
                        <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-xs bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-md">
                          Inativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(tier)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(tier.id)}
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
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tier?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tier será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSaving}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
