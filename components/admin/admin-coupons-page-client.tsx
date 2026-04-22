"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"
import { AdminHero, AdminPage, AdminPanel, AdminToolbar, DesktopOnly, MobileCardList } from "@/components/admin/admin-mobile-ui"
import { usePaginatedList } from "@/hooks/use-paginated-list"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import CurrencyInput from "@/components/form/CurrencyInput"
import IntegerInput from "@/components/form/IntegerInput"
import PercentageInput from "@/components/form/PercentageInput"
import { Plus, MoreHorizontal, Pencil, Trash2, Ticket, Search } from "lucide-react"
import { 
  createCouponAction, 
  updateCouponAction, 
  deleteCouponAction 
} from "@/lib/actions/coupons"
import type { Coupon, CouponType } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin"

interface AdminCouponsPageClientProps {
  initialCoupons: Coupon[]
  storeId: number | null
  locale?: string
}

export default function AdminCouponsPageClient({
  initialCoupons,
  storeId,
  locale,
}: AdminCouponsPageClientProps) {
  const { toast } = useToast()
  const normalizedLocale = normalizeAdminLocale(locale)
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback)
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [search, setSearch] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage" as CouponType,
    value: "",
    startsAt: "",
    endsAt: "",
    maxUses: "",
    minOrderValue: "",
    isActive: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCoupons(initialCoupons)
  }, [initialCoupons])

  const filteredCoupons = coupons.filter((coupon) =>
    coupon.code.toLowerCase().includes(search.toLowerCase())
  )

  const pageSize = 20
  const {
    totalPages,
    safeCurrentPage,
    pageStart,
    pageEnd,
    paginatedItems: paginatedCoupons,
  } = usePaginatedList({
    items: filteredCoupons,
    currentPage,
    pageSize,
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function openCreateDialog() {
    setEditingCoupon(null)
    setFormData({
      code: "",
      type: "percentage",
      value: "",
      startsAt: "",
      endsAt: "",
      maxUses: "",
      minOrderValue: "",
      isActive: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(coupon: Coupon) {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.type === 'percentage'
        ? (coupon.valueCents).toString()  // Percentual mantido como está
        : (coupon.valueCents / 100).toString(),  // Fixed type: converter centavos para reais
      startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().split("T")[0] : "",
      endsAt: coupon.endsAt ? new Date(coupon.endsAt).toISOString().split("T")[0] : "",
      maxUses: coupon.maxUses?.toString() || "",
      minOrderValue: coupon.minOrderValueCents ? (coupon.minOrderValueCents / 100).toString() : "",
      isActive: coupon.isActive,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.code.trim()) {
      toast({
        description: tr("admin.coupons.validation.codeRequired", "Code is required"),
        variant: "destructive",
      })
      return
    }
    if (!formData.value) {
      toast({
        description: tr("admin.coupons.validation.valueRequired", "Value is required"),
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const fd = new FormData()
      fd.append("code", formData.code.toUpperCase())
      fd.append("type", formData.type)
      
      // Diferentes conversões conforme tipo
      if (formData.type === 'percentage') {
        // Percentual: enviar como está (Decimal)
        fd.append("value", formData.value)
      } else {
        // Fixed: converter para centavos
        const valueCents = Math.round(parseFloat(formData.value) * 100)
        fd.append("value", String(valueCents))
      }
      
      if (formData.startsAt) fd.append("startsAt", formData.startsAt)
      if (formData.endsAt) fd.append("endsAt", formData.endsAt)
      fd.append("maxUses", formData.maxUses)
      // Converter minOrderValue para centavos (sempre monetário)
      if (formData.minOrderValue) {
        const minCents = Math.round(parseFloat(formData.minOrderValue) * 100)
        fd.append("minOrderValue", String(minCents))
      } else {
        fd.append("minOrderValue", "")
      }
      fd.append("isActive", String(formData.isActive))
      if (storeId) {
        fd.append("storeId", String(storeId))
      }

      if (editingCoupon) {
        const result = await updateCouponAction(editingCoupon.id, fd)
        if (!result.success) {
          toast({
            description: result.error || tr("admin.coupons.error.update", "Failed to update coupon"),
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: tr("admin.coupons.success.updated", "Coupon updated successfully"),
        })

        if (result.data) {
          setCoupons((prev) =>
            prev.map((coupon) =>
              coupon.id === editingCoupon.id ? result.data! : coupon
            )
          )
        }
      } else {
        const result = await createCouponAction(fd)
        if (!result.success) {
          toast({
            description: result.error || tr("admin.coupons.error.create", "Failed to create coupon"),
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: tr("admin.coupons.success.created", "Coupon created successfully"),
        })

        if (result.data) {
          setCoupons((prev) => [result.data!, ...prev])
        }
      }

      setIsDialogOpen(false)
    } catch (error) {
      toast({
        description: tr("admin.coupons.error.save", "Failed to save coupon"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleDelete(id: string) {
    setCouponToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!couponToDelete) return

    try {
      const result = await deleteCouponAction(couponToDelete)
      if (!result.success) {
        toast({
          description: result.error || tr("admin.coupons.error.delete", "Failed to delete coupon"),
          variant: "destructive",
        })
        setDeleteDialogOpen(false)
        setCouponToDelete(null)
        return
      }

      toast({
        description: tr("admin.coupons.success.deleted", "Coupon deleted successfully"),
      })
      setCoupons((prev) => prev.filter((coupon) => coupon.id !== couponToDelete))
      setDeleteDialogOpen(false)
      setCouponToDelete(null)
    } catch (error) {
      toast({
        description: tr("admin.coupons.error.delete", "Failed to delete coupon"),
        variant: "destructive",
      })
      setDeleteDialogOpen(false)
      setCouponToDelete(null)
    }
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString(normalizedLocale)
  }

  const formatCouponValue = (type: CouponType, valueCents: number) => {
    if (type === "percentage") {
      return `${valueCents}%`
    }
    // Para fixed: valueCents está em centavos, converter para reais
    const reais = (valueCents / 100).toFixed(2)
    return `R$ ${reais}`
  }

  return (
    <AdminPage>
      <AdminHero
        icon={Ticket}
        eyebrow="Promocoes"
        title={tr("admin.coupons.title", "Coupons")}
        description={tr("admin.coupons.subtitle", "Manage discount coupons")}
        actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="min-h-12 rounded-2xl cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              {tr("admin.coupons.new", "New Coupon")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? tr("admin.coupons.edit", "Edit Coupon") : tr("admin.coupons.new", "New Coupon")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">{tr("admin.coupons.fields.code", "Code")}</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="PROMO10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{tr("admin.coupons.fields.type", "Type")}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: CouponType) => 
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{tr("admin.coupons.type.percentage", "Percentage (%)")}</SelectItem>
                      <SelectItem value="fixed">{tr("admin.coupons.type.fixed", "Fixed Amount (R$)")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="value">{tr("admin.coupons.fields.value", "Value")}</Label>
                  {formData.type === "percentage" ? (
                    <PercentageInput
                      value={formData.value === "" ? null : Number(formData.value) / 100}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          value:
                            value == null
                              ? ""
                              : String(Number((value * 100).toFixed(2))),
                        })
                      }
                      placeholder="10"
                      min={0}
                      max={100}
                    />
                  ) : (
                    <CurrencyInput
                      value={formData.value === "" ? null : Number(formData.value)}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          value: value == null ? "" : String(value),
                        })
                      }
                      placeholder="50,00"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minOrderValue">{tr("admin.coupons.fields.minOrderValue", "Minimum Order Value")}</Label>
                  <CurrencyInput
                    value={formData.minOrderValue ? parseFloat(formData.minOrderValue) : null}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        minOrderValue: value == null ? "" : String(value),
                      })
                    }
                    placeholder={tr("admin.common.optional", "Optional")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">{tr("admin.coupons.fields.startsAt", "Start Date")}</Label>
                  <Input
                    id="startsAt"
                    type="date"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endsAt">{tr("admin.coupons.fields.endsAt", "End Date")}</Label>
                  <Input
                    id="endsAt"
                    type="date"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">{tr("admin.coupons.fields.maxUses", "Maximum Uses")}</Label>
                <IntegerInput
                  value={formData.maxUses === "" ? null : Number(formData.maxUses)}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      maxUses: value == null ? "" : String(value),
                    })
                  }
                  placeholder={tr("admin.coupons.unlimited", "Unlimited")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">{tr("admin.coupons.fields.status", "Status")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isActive ? tr("admin.coupons.activeDescription", "Active coupon") : tr("admin.coupons.inactiveDescription", "Inactive coupon")}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
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
                  {tr("admin.common.cancel", "Cancel")}
                </Button>
                <Button type="submit" disabled={isSaving} className="cursor-pointer">
                  {isSaving ? tr("admin.common.saving", "Saving...") : editingCoupon ? tr("admin.coupons.save", "Save") : tr("admin.coupons.create", "Create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <AdminToolbar>
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tr("admin.coupons.searchPlaceholder", "Search by code...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-12 rounded-2xl pl-9"
          />
        </div>
      </AdminToolbar>

      <MobileCardList>
        {filteredCoupons.length === 0 ? (
          <AdminPanel>
            <div className="py-8 text-center">
              <Ticket className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {coupons.length === 0 
                  ? tr("admin.coupons.empty", "No coupons found") 
                  : tr("admin.coupons.emptySearch", "No coupons match the search")}
              </p>
            </div>
          </AdminPanel>
        ) : (
          paginatedCoupons.map((coupon) => (
            <AdminPanel key={coupon.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-base font-semibold text-foreground">{coupon.code}</p>
                    <p className="text-sm text-muted-foreground">{formatCouponValue(coupon.type, coupon.valueCents)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${coupon.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                    {coupon.isActive ? tr("admin.coupons.active", "Active") : tr("admin.coupons.inactive", "Inactive")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Inicio</p>
                    <p className="font-medium text-foreground">{formatDate(coupon.startsAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fim</p>
                    <p className="font-medium text-foreground">{formatDate(coupon.endsAt)}</p>
                  </div>
                </div>
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
              <TableHead>{tr("admin.coupons.table.code", "Code")}</TableHead>
              <TableHead>{tr("admin.coupons.table.discount", "Discount")}</TableHead>
              <TableHead>{tr("admin.coupons.table.validFrom", "Valid From")}</TableHead>
              <TableHead>{tr("admin.coupons.table.validUntil", "Valid Until")}</TableHead>
              <TableHead>{tr("admin.coupons.table.maxUses", "Max Uses")}</TableHead>
              <TableHead>{tr("admin.coupons.table.status", "Status")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCoupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Ticket className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {coupons.length === 0 
                      ? tr("admin.coupons.empty", "No coupons found") 
                      : tr("admin.coupons.emptySearch", "No coupons match the search")}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCoupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                  <TableCell>
                    {formatCouponValue(coupon.type, coupon.valueCents)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(coupon.startsAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(coupon.endsAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon.maxUses || "—"}
                  </TableCell>
                  <TableCell>
                    {coupon.isActive ? (
                      <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md">
                        {tr("admin.coupons.active", "Active")}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-md">
                        {tr("admin.coupons.inactive", "Inactive")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(coupon)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          {tr("admin.coupons.editAction", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(coupon.id)}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tr("admin.coupons.deleteAction", "Delete")}
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

      {filteredCoupons.length > 0 && (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: filteredCoupons.length,
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("admin.coupons.deleteTitle", "Confirm deletion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("admin.coupons.deleteConfirm", "Are you sure you want to delete this coupon? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              onClick={() => {
                setDeleteDialogOpen(false)
                setCouponToDelete(null)
              }}
            >
              {tr("admin.common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
            >
              {tr("admin.coupons.deleteAction", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}
