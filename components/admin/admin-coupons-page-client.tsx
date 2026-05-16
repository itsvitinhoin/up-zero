"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import AdminPaginationControls from "@/components/admin/admin-pagination-controls"
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from "@/components/admin/admin-mobile-ui"
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
import { Plus, MoreHorizontal, Pencil, Trash2, Ticket, Search, Tag, Zap, CreditCard } from "lucide-react"
import {
  createCouponAction,
  updateCouponAction,
  deleteCouponAction,
} from "@/lib/actions/coupons"
import type {
  Category,
  Coupon,
  CouponType,
  DiscountPriority,
  DiscountRuleType,
  DiscountTarget,
  DiscountTargetType,
  DiscountType,
  Product,
} from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin"

type FormState = {
  name: string
  code: string
  ruleType: DiscountRuleType
  discountType: DiscountType
  value: string
  startsAt: string
  endsAt: string
  maxUses: string
  maxUsesPerCustomer: string
  minOrderValue: string
  minItemsQuantity: string
  firstPurchaseOnly: boolean
  firstPurchaseMinOrderValue: string
  firstPurchaseMinItemsQuantity: string
  canStack: boolean
  priority: DiscountPriority
  paymentMethod: string
  applyToAllProducts: boolean
  includeTargets: DiscountTarget[]
  excludeTargets: DiscountTarget[]
  excludePromotionalProducts: boolean
  excludeDiscountedProducts: boolean
  isActive: boolean
}

interface AdminCouponsPageClientProps {
  initialCoupons: Coupon[]
  initialProducts: Product[]
  initialCategories: Category[]
  storeId: number | null
  locale?: string
}

type CouponAdvancedConfig = Pick<
  Coupon,
  | "name"
  | "ruleType"
  | "discountType"
  | "minItemsQuantity"
  | "firstPurchaseOnly"
  | "firstPurchaseMinOrderValueCents"
  | "firstPurchaseMinItemsQuantity"
  | "maxUsesPerCustomer"
  | "canStack"
  | "priority"
  | "paymentMethod"
  | "applyToAllProducts"
  | "includeTargets"
  | "excludeTargets"
  | "excludePromotionalProducts"
  | "excludeDiscountedProducts"
>

const advancedCouponConfigStorageKey = "admin_coupon_advanced_configs_v1"

const emptyForm: FormState = {
  name: "",
  code: "",
  ruleType: "coupon",
  discountType: "percentage",
  value: "",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  maxUsesPerCustomer: "",
  minOrderValue: "",
  minItemsQuantity: "",
  firstPurchaseOnly: false,
  firstPurchaseMinOrderValue: "",
  firstPurchaseMinItemsQuantity: "",
  canStack: false,
  priority: "medium",
  paymentMethod: "pix",
  applyToAllProducts: true,
  includeTargets: [],
  excludeTargets: [],
  excludePromotionalProducts: false,
  excludeDiscountedProducts: false,
  isActive: true,
}

const ruleTypeLabels: Record<DiscountRuleType, string> = {
  coupon: "Cupom manual",
  automatic: "Automatica",
  payment_method: "Metodo de pagamento",
}

const priorityLabels: Record<DiscountPriority, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
}

function toDateInputValue(date: Date | string | undefined) {
  if (!date) return ""
  return new Date(date).toISOString().split("T")[0] ?? ""
}

function getCouponType(discountType: DiscountType): CouponType {
  return discountType === "fixed_amount" ? "fixed" : "percentage"
}

function couponToForm(coupon: Coupon): FormState {
  const discountType = coupon.discountType ?? (coupon.type === "fixed" ? "fixed_amount" : "percentage")
  return {
    name: coupon.name || coupon.code,
    code: coupon.ruleType === "coupon" || !coupon.ruleType ? coupon.code : "",
    ruleType: coupon.ruleType ?? "coupon",
    discountType,
    value: discountType === "percentage" ? String(coupon.valueCents) : String(coupon.valueCents / 100),
    startsAt: toDateInputValue(coupon.startsAt),
    endsAt: toDateInputValue(coupon.endsAt),
    maxUses: coupon.maxUses?.toString() || "",
    maxUsesPerCustomer: coupon.maxUsesPerCustomer?.toString() || "",
    minOrderValue: coupon.minOrderValueCents ? String(coupon.minOrderValueCents / 100) : "",
    minItemsQuantity: coupon.minItemsQuantity?.toString() || "",
    firstPurchaseOnly: coupon.firstPurchaseOnly ?? false,
    firstPurchaseMinOrderValue: coupon.firstPurchaseMinOrderValueCents ? String(coupon.firstPurchaseMinOrderValueCents / 100) : "",
    firstPurchaseMinItemsQuantity: coupon.firstPurchaseMinItemsQuantity?.toString() || "",
    canStack: coupon.canStack ?? false,
    priority: coupon.priority ?? "medium",
    paymentMethod: coupon.paymentMethod || "pix",
    applyToAllProducts: coupon.applyToAllProducts ?? coupon.scope.type === "ALL",
    includeTargets: coupon.includeTargets ?? [],
    excludeTargets: coupon.excludeTargets ?? [],
    excludePromotionalProducts: coupon.excludePromotionalProducts ?? false,
    excludeDiscountedProducts: coupon.excludeDiscountedProducts ?? false,
    isActive: coupon.isActive,
  }
}

function createGeneratedCode(formData: FormState) {
  const base = formData.ruleType === "payment_method" ? formData.paymentMethod : formData.name
  const normalized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
  return `${formData.ruleType === "automatic" ? "AUTO" : "PM"}-${normalized || "REGRA"}`
}

function hasPromotionalPrice(product: Product) {
  return product.variants?.some((variant) => typeof variant.priceOverride === "number" && variant.priceOverride > 0) ?? false
}

function readAdvancedCouponConfigs(): Record<string, CouponAdvancedConfig> {
  if (typeof window === "undefined") return {}
  const raw = window.localStorage.getItem(advancedCouponConfigStorageKey)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, CouponAdvancedConfig>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeAdvancedCouponConfigs(configs: Record<string, CouponAdvancedConfig>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(advancedCouponConfigStorageKey, JSON.stringify(configs))
}

function toAdvancedCouponConfig(coupon: Coupon): CouponAdvancedConfig {
  return {
    name: coupon.name,
    ruleType: coupon.ruleType,
    discountType: coupon.discountType,
    minItemsQuantity: coupon.minItemsQuantity,
    firstPurchaseOnly: coupon.firstPurchaseOnly,
    firstPurchaseMinOrderValueCents: coupon.firstPurchaseMinOrderValueCents,
    firstPurchaseMinItemsQuantity: coupon.firstPurchaseMinItemsQuantity,
    maxUsesPerCustomer: coupon.maxUsesPerCustomer,
    canStack: coupon.canStack,
    priority: coupon.priority,
    paymentMethod: coupon.paymentMethod,
    applyToAllProducts: coupon.applyToAllProducts,
    includeTargets: coupon.includeTargets,
    excludeTargets: coupon.excludeTargets,
    excludePromotionalProducts: coupon.excludePromotionalProducts,
    excludeDiscountedProducts: coupon.excludeDiscountedProducts,
  }
}

function mergeAdvancedCouponConfigs(coupons: Coupon[]) {
  const configs = readAdvancedCouponConfigs()
  return coupons.map((coupon) => ({
    ...coupon,
    ...(configs[coupon.id] ?? {}),
  }))
}

function persistAdvancedCouponConfig(coupon: Coupon) {
  const configs = readAdvancedCouponConfigs()
  configs[coupon.id] = toAdvancedCouponConfig(coupon)
  writeAdvancedCouponConfigs(configs)
}

function removeAdvancedCouponConfig(couponId: string) {
  const configs = readAdvancedCouponConfigs()
  delete configs[couponId]
  writeAdvancedCouponConfigs(configs)
}

export default function AdminCouponsPageClient({
  initialCoupons,
  initialProducts,
  initialCategories,
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
  const [formData, setFormData] = useState<FormState>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCoupons(mergeAdvancedCouponConfigs(initialCoupons))
  }, [initialCoupons])

  const tagTargets = useMemo<DiscountTarget[]>(() => {
    const tags = new Set<string>()
    initialProducts.forEach((product) => {
      product.tags.forEach((tagName) => tags.add(tagName))
    })
    return Array.from(tags).sort().map((tagName) => ({
      type: "tag",
      id: tagName,
      name: tagName,
    }))
  }, [initialProducts])

  const targetOptions = useMemo<Record<Extract<DiscountTargetType, "product" | "category" | "tag">, DiscountTarget[]>>(
    () => ({
      product: initialProducts.map((product) => ({ type: "product", id: product.id, name: product.name })),
      category: initialCategories.map((category) => ({ type: "category", id: category.id, name: category.name })),
      tag: tagTargets,
    }),
    [initialCategories, initialProducts, tagTargets],
  )

  const filteredCoupons = coupons.filter((coupon) => {
    const searchable = [coupon.name, coupon.code, coupon.paymentMethod, ruleTypeLabels[coupon.ruleType ?? "coupon"]]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return searchable.includes(search.toLowerCase())
  })

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

  const activeCoupons = coupons.filter((coupon) => coupon.isActive && (coupon.ruleType ?? "coupon") === "coupon").length
  const activeAutomaticRules = coupons.filter((coupon) => coupon.isActive && (coupon.ruleType ?? "coupon") !== "coupon").length
  const totalUses = coupons.reduce((sum, coupon) => sum + (coupon.currentUses || 0), 0)
  const promotionalProducts = initialProducts.filter(hasPromotionalPrice).length

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
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(coupon: Coupon) {
    setEditingCoupon(coupon)
    setFormData(couponToForm(coupon))
    setIsDialogOpen(true)
  }

  function updateForm(patch: Partial<FormState>) {
    setFormData((current) => ({ ...current, ...patch }))
  }

  function toggleTarget(listName: "includeTargets" | "excludeTargets", target: DiscountTarget) {
    setFormData((current) => {
      const exists = current[listName].some((entry) => entry.type === target.type && entry.id === target.id)
      const nextTargets = exists
        ? current[listName].filter((entry) => !(entry.type === target.type && entry.id === target.id))
        : [...current[listName], target]
      return { ...current, [listName]: nextTargets }
    })
  }

  function validateForm(): string | null {
    const numericValue = Number(formData.value)
    const startsAt = formData.startsAt ? new Date(formData.startsAt) : null
    const endsAt = formData.endsAt ? new Date(formData.endsAt) : null

    if (!formData.name.trim()) return "Nome da regra obrigatorio"
    if (!formData.ruleType) return "Tipo da regra obrigatorio"
    if (!formData.discountType) return "Tipo de desconto obrigatorio"
    if (formData.ruleType === "coupon" && !formData.code.trim()) return "Codigo do cupom obrigatorio"
    if (formData.ruleType === "payment_method" && !formData.paymentMethod.trim()) return "Metodo de pagamento obrigatorio"
    if (formData.discountType !== "free_shipping" && (!formData.value || Number.isNaN(numericValue) || numericValue <= 0)) {
      return "Valor do desconto obrigatorio"
    }
    if (formData.discountType === "percentage" && numericValue > 100) return "Valor percentual nao pode ser maior que 100%"
    if (startsAt && endsAt && endsAt < startsAt) return "Data final nao pode ser anterior a data inicial"

    const numericFields: Array<[string, string]> = [
      ["Pedido minimo", formData.minOrderValue],
      ["Quantidade minima", formData.minItemsQuantity],
      ["Pedido minimo da primeira compra", formData.firstPurchaseMinOrderValue],
      ["Quantidade minima da primeira compra", formData.firstPurchaseMinItemsQuantity],
      ["Limite total de usos", formData.maxUses],
      ["Limite por cliente", formData.maxUsesPerCustomer],
    ]
    const invalidField = numericFields.find(([, value]) => value !== "" && Number(value) < 0)
    if (invalidField) return `${invalidField[0]} nao pode ser negativo`

    return null
  }

  function buildRuleSummary(data: FormState) {
    const identifier = data.ruleType === "coupon" ? `O cupom ${data.code || "(sem codigo)"}` : `A regra ${data.name || "(sem nome)"}`
    const discount =
      data.discountType === "free_shipping"
        ? "concede frete gratis"
        : data.discountType === "percentage"
          ? `concede ${data.value || "0"}% de desconto`
          : `concede R$ ${Number(data.value || 0).toFixed(2)} de desconto`
    const application = data.applyToAllProducts
      ? "em todos os produtos"
      : `em ${data.includeTargets.length || 0} alvo(s) selecionado(s)`
    const exclusions = [
      data.excludeTargets.length > 0 ? `${data.excludeTargets.length} alvo(s) excluido(s)` : null,
      data.excludePromotionalProducts ? "produtos ja em promocao" : null,
      data.excludeDiscountedProducts ? "produtos com desconto ativo" : null,
    ].filter(Boolean)
    const stacking = data.canStack ? "Pode acumular com outros descontos." : "Nao acumula com outros descontos."
    const firstPurchase = data.firstPurchaseOnly
      ? `Valida apenas para primeira compra${data.firstPurchaseMinOrderValue ? ` com minimo de R$ ${Number(data.firstPurchaseMinOrderValue).toFixed(2)}` : ""}${data.firstPurchaseMinItemsQuantity ? ` e ${data.firstPurchaseMinItemsQuantity} item(ns)` : ""}.`
      : "Nao restrita a primeira compra."
    const eligibleItems = "Em carrinhos mistos, o desconto deve ser calculado apenas sobre os itens elegiveis."

    return `${identifier} ${discount} ${application}${exclusions.length ? `, exceto ${exclusions.join(", ")}` : ""}. ${firstPurchase} ${stacking} Prioridade ${priorityLabels[data.priority].toLowerCase()}. ${eligibleItems}`
  }

  function createEnrichedCoupon(baseCoupon: Coupon, data: FormState): Coupon {
    const selectedCode = data.ruleType === "coupon" ? data.code.toUpperCase() : createGeneratedCode(data)
    return {
      ...baseCoupon,
      name: data.name.trim(),
      code: selectedCode,
      ruleType: data.ruleType,
      discountType: data.discountType,
      type: getCouponType(data.discountType),
      minItemsQuantity: data.minItemsQuantity ? Number(data.minItemsQuantity) : null,
      firstPurchaseOnly: data.firstPurchaseOnly,
      firstPurchaseMinOrderValueCents: data.firstPurchaseOnly && data.firstPurchaseMinOrderValue
        ? Math.round(Number(data.firstPurchaseMinOrderValue) * 100)
        : null,
      firstPurchaseMinItemsQuantity: data.firstPurchaseOnly && data.firstPurchaseMinItemsQuantity
        ? Number(data.firstPurchaseMinItemsQuantity)
        : null,
      maxUsesPerCustomer: data.maxUsesPerCustomer ? Number(data.maxUsesPerCustomer) : null,
      canStack: data.canStack,
      priority: data.priority,
      paymentMethod: data.ruleType === "payment_method" ? data.paymentMethod : null,
      applyToAllProducts: data.applyToAllProducts,
      includeTargets: data.includeTargets,
      excludeTargets: data.excludeTargets,
      excludePromotionalProducts: data.excludePromotionalProducts,
      excludeDiscountedProducts: data.excludeDiscountedProducts,
      updatedAt: new Date(),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      toast({ description: validationError, variant: "destructive" })
      return
    }

    setIsSaving(true)

    try {
      const fd = new FormData()
      const codeForBackend = formData.ruleType === "coupon" ? formData.code.toUpperCase() : createGeneratedCode(formData)
      const backendType = getCouponType(formData.discountType)
      fd.append("code", codeForBackend)
      fd.append("type", backendType)

      if (formData.discountType === "percentage") {
        fd.append("value", formData.value)
      } else if (formData.discountType === "fixed_amount") {
        fd.append("value", String(Math.round(Number(formData.value) * 100)))
      } else {
        fd.append("value", "0")
      }

      if (formData.startsAt) fd.append("startsAt", formData.startsAt)
      if (formData.endsAt) fd.append("endsAt", formData.endsAt)
      fd.append("maxUses", formData.maxUses)
      fd.append("minOrderValue", formData.minOrderValue ? String(Math.round(Number(formData.minOrderValue) * 100)) : "")
      fd.append("isActive", String(formData.isActive))
      if (storeId) fd.append("storeId", String(storeId))

      if (editingCoupon) {
        const result = await updateCouponAction(editingCoupon.id, fd)
        if (!result.success) {
          toast({
            description: result.error || tr("admin.coupons.error.update", "Failed to update coupon"),
            variant: "destructive",
          })
          return
        }
        toast({ description: tr("admin.coupons.success.updated", "Coupon updated successfully") })
        if (result.data) {
          const enriched = createEnrichedCoupon(result.data, formData)
          persistAdvancedCouponConfig(enriched)
          setCoupons((prev) => prev.map((coupon) => (coupon.id === editingCoupon.id ? enriched : coupon)))
        }
      } else {
        const result = await createCouponAction(fd)
        if (!result.success) {
          toast({
            description: result.error || tr("admin.coupons.error.create", "Failed to create coupon"),
            variant: "destructive",
          })
          return
        }
        toast({ description: tr("admin.coupons.success.created", "Coupon created successfully") })
        if (result.data) {
          const enriched = createEnrichedCoupon(result.data, formData)
          persistAdvancedCouponConfig(enriched)
          setCoupons((prev) => [enriched, ...prev])
        }
      }

      setIsDialogOpen(false)
    } catch {
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
        return
      }

      toast({ description: tr("admin.coupons.success.deleted", "Coupon deleted successfully") })
      removeAdvancedCouponConfig(couponToDelete)
      setCoupons((prev) => prev.filter((coupon) => coupon.id !== couponToDelete))
    } catch {
      toast({
        description: tr("admin.coupons.error.delete", "Failed to delete coupon"),
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setCouponToDelete(null)
    }
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString(normalizedLocale)
  }

  const formatCouponValue = (coupon: Coupon) => {
    const discountType = coupon.discountType ?? (coupon.type === "fixed" ? "fixed_amount" : "percentage")
    if (discountType === "free_shipping") return "Frete gratis"
    if (discountType === "percentage") return `${coupon.valueCents}%`
    return `R$ ${(coupon.valueCents / 100).toFixed(2)}`
  }

  const renderTargetPicker = (title: string, listName: "includeTargets" | "excludeTargets") => {
    const selected = formData[listName]
    return (
      <div className="space-y-3 rounded-lg border border-border/70 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">Produtos, categorias e tags ja existentes no catalogo.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(["product", "category", "tag"] as const).map((targetType) => (
            <div key={targetType} className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {targetType === "product" ? "Produtos" : targetType === "category" ? "Categorias" : "Tags"}
              </p>
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-2">
                {targetOptions[targetType].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum item disponivel</p>
                ) : (
                  targetOptions[targetType].map((target) => {
                    const checked = selected.some((entry) => entry.type === target.type && entry.id === target.id)
                    return (
                      <label key={`${target.type}-${target.id}`} className="flex cursor-pointer items-start gap-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggleTarget(listName, target)} />
                        <span className="leading-4">{target.name}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AdminPage>
      <AdminHero
        icon={Ticket}
        eyebrow="Promocoes"
        title="Cupons e Regras de Desconto"
        description="Gerencie cupons manuais, regras automaticas e descontos por metodo de pagamento."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="min-h-12 rounded-2xl cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Criar nova regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>{editingCoupon ? "Editar regra de desconto" : "Criar nova regra de desconto"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome interno da promocao</Label>
                    <Input id="name" value={formData.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="Ex: Primeira compra 10%" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleType">Tipo da regra</Label>
                    <Select value={formData.ruleType} onValueChange={(value: DiscountRuleType) => updateForm({ ruleType: value })}>
                      <SelectTrigger id="ruleType" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coupon">coupon - Cupom manual</SelectItem>
                        <SelectItem value="automatic">automatic - Desconto automatico</SelectItem>
                        <SelectItem value="payment_method">payment_method - Metodo de pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.ruleType === "coupon" && (
                    <div className="space-y-2">
                      <Label htmlFor="code">Codigo do cupom</Label>
                      <Input id="code" value={formData.code} onChange={(e) => updateForm({ code: e.target.value })} placeholder="PRIMEIRA10" />
                    </div>
                  )}
                  {formData.ruleType === "payment_method" && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod">Metodo de pagamento</Label>
                      <Select value={formData.paymentMethod} onValueChange={(value) => updateForm({ paymentMethod: value })}>
                        <SelectTrigger id="paymentMethod" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">Pix</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="discountType">Tipo de desconto</Label>
                    <Select value={formData.discountType} onValueChange={(value: DiscountType) => updateForm({ discountType: value, value: value === "free_shipping" ? "" : formData.value })}>
                      <SelectTrigger id="discountType" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">percentage - Percentual</SelectItem>
                        <SelectItem value="fixed_amount">fixed_amount - Valor fixo</SelectItem>
                        <SelectItem value="free_shipping">free_shipping - Frete gratis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.discountType !== "free_shipping" && (
                    <div className="space-y-2">
                      <Label htmlFor="value">Valor do desconto</Label>
                      {formData.discountType === "percentage" ? (
                        <PercentageInput
                          value={formData.value === "" ? null : Number(formData.value) / 100}
                          onChange={(value) => updateForm({ value: value == null ? "" : String(Number((value * 100).toFixed(2))) })}
                          placeholder="10"
                          min={0}
                          max={100}
                        />
                      ) : (
                        <CurrencyInput value={formData.value === "" ? null : Number(formData.value)} onChange={(value) => updateForm({ value: value == null ? "" : String(value) })} placeholder="50,00" min={0} />
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="startsAt">Data de inicio</Label>
                    <Input id="startsAt" type="date" value={formData.startsAt} onChange={(e) => updateForm({ startsAt: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endsAt">Data de termino</Label>
                    <Input id="endsAt" type="date" value={formData.endsAt} onChange={(e) => updateForm({ endsAt: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minOrderValue">Pedido minimo</Label>
                    <CurrencyInput value={formData.minOrderValue ? Number(formData.minOrderValue) : null} onChange={(value) => updateForm({ minOrderValue: value == null ? "" : String(value) })} min={0} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minItemsQuantity">Quantidade minima</Label>
                    <IntegerInput value={formData.minItemsQuantity === "" ? null : Number(formData.minItemsQuantity)} onChange={(value) => updateForm({ minItemsQuantity: value == null ? "" : String(value) })} min={0} placeholder="0" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxUses">Limite total de usos</Label>
                    <IntegerInput value={formData.maxUses === "" ? null : Number(formData.maxUses)} onChange={(value) => updateForm({ maxUses: value == null ? "" : String(value) })} min={0} placeholder="Ilimitado" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUsesPerCustomer">Limite por cliente</Label>
                    <IntegerInput value={formData.maxUsesPerCustomer === "" ? null : Number(formData.maxUsesPerCustomer)} onChange={(value) => updateForm({ maxUsesPerCustomer: value == null ? "" : String(value) })} min={0} placeholder="Ilimitado" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select value={formData.priority} onValueChange={(value: DiscountPriority) => updateForm({ priority: value })}>
                      <SelectTrigger id="priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 rounded-lg border border-border/70 p-3">
                    <Label htmlFor="isActive">Status ativo/inativo</Label>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{formData.isActive ? "Ativo" : "Inativo"}</span>
                      <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => updateForm({ isActive: checked })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="firstPurchaseOnly">Aplicar apenas na primeira compra</Label>
                      <p className="text-xs text-muted-foreground">
                        Use esta condicao para criar uma acao exclusiva para clientes sem compra anterior.
                      </p>
                    </div>
                    <Switch
                      id="firstPurchaseOnly"
                      checked={formData.firstPurchaseOnly}
                      onCheckedChange={(checked) => updateForm({ firstPurchaseOnly: checked })}
                    />
                  </div>
                  {formData.firstPurchaseOnly ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstPurchaseMinOrderValue">Pedido minimo para primeira compra</Label>
                        <CurrencyInput
                          value={formData.firstPurchaseMinOrderValue ? Number(formData.firstPurchaseMinOrderValue) : null}
                          onChange={(value) => updateForm({ firstPurchaseMinOrderValue: value == null ? "" : String(value) })}
                          min={0}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstPurchaseMinItemsQuantity">Quantidade minima para primeira compra</Label>
                        <IntegerInput
                          value={formData.firstPurchaseMinItemsQuantity === "" ? null : Number(formData.firstPurchaseMinItemsQuantity)}
                          onChange={(value) => updateForm({ firstPurchaseMinItemsQuantity: value == null ? "" : String(value) })}
                          min={0}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <div>
                    <Label htmlFor="canStack">Permitir acumular com outros descontos</Label>
                    <p className="text-xs text-muted-foreground">Use esta opcao para permitir combinacao com Pix, cupons ou outras regras.</p>
                  </div>
                  <Switch id="canStack" checked={formData.canStack} onCheckedChange={(checked) => updateForm({ canStack: checked })} />
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Onde o desconto se aplica</h3>
                    <p className="text-sm text-muted-foreground">Escolha todos os produtos ou limite a regra a itens especificos.</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                    <Label htmlFor="applyToAllProducts">Todos os produtos</Label>
                    <Switch id="applyToAllProducts" checked={formData.applyToAllProducts} onCheckedChange={(checked) => updateForm({ applyToAllProducts: checked })} />
                  </div>
                  {!formData.applyToAllProducts && renderTargetPicker("Aplicar somente em", "includeTargets")}
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Nao aplicar desconto em</h3>
                    <p className="text-sm text-muted-foreground">Exclusoes sempre prevalecem, mesmo quando a regra vale para todos os produtos.</p>
                  </div>
                  {renderTargetPicker("Excluir alvos especificos", "excludeTargets")}
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3">
                      <Checkbox checked={formData.excludePromotionalProducts} onCheckedChange={(checked) => updateForm({ excludePromotionalProducts: checked === true })} />
                      <span>
                        <span className="block text-sm font-medium">Produtos ja em promocao</span>
                        <span className="block text-xs text-muted-foreground">{promotionalProducts} produto(s) detectado(s) com preco promocional.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3">
                      <Checkbox checked={formData.excludeDiscountedProducts} onCheckedChange={(checked) => updateForm({ excludeDiscountedProducts: checked === true })} />
                      <span>
                        <span className="block text-sm font-medium">Produtos com desconto ativo</span>
                        <span className="block text-xs text-muted-foreground">Preparado para calculo por item elegivel no checkout/API.</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">Resumo antes de salvar</p>
                  <p className="mt-1">{buildRuleSummary(formData)}</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving} className="cursor-pointer">
                    {tr("admin.common.cancel", "Cancel")}
                  </Button>
                  <Button type="submit" disabled={isSaving} className="cursor-pointer">
                    {isSaving ? tr("admin.common.saving", "Saving...") : editingCoupon ? "Salvar regra" : "Criar regra"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminStatGrid>
        <AdminStatCard icon={Ticket} label="Cupons ativos" value={activeCoupons} />
        <AdminStatCard icon={Zap} label="Regras automaticas ativas" value={activeAutomaticRules} />
        <AdminStatCard icon={Tag} label="Total de usos" value={totalUses} />
        <AdminStatCard icon={CreditCard} label="Metodos com regra" value={coupons.filter((coupon) => coupon.ruleType === "payment_method").length} />
      </AdminStatGrid>

      <AdminToolbar>
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, codigo ou tipo..."
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
                {coupons.length === 0 ? tr("admin.coupons.empty", "No coupons found") : tr("admin.coupons.emptySearch", "No coupons match the search")}
              </p>
            </div>
          </AdminPanel>
        ) : (
          paginatedCoupons.map((coupon) => (
            <AdminPanel key={coupon.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{coupon.name || coupon.code}</p>
                    <p className="font-mono text-sm text-muted-foreground">{(coupon.ruleType ?? "coupon") === "coupon" ? coupon.code : "Sem cupom"}</p>
                    {coupon.firstPurchaseOnly ? (
                      <Badge variant="amber" className="mt-2">Primeira compra</Badge>
                    ) : null}
                  </div>
                  <Badge variant={coupon.isActive ? "default" : "secondary"}>{coupon.isActive ? "Ativo" : "Inativo"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Tipo</p>
                    <p className="font-medium text-foreground">{ruleTypeLabels[coupon.ruleType ?? "coupon"]}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Desconto</p>
                    <p className="font-medium text-foreground">{formatCouponValue(coupon)}</p>
                  </div>
                </div>
              </div>
            </AdminPanel>
          ))
        )}
      </MobileCardList>

      <DesktopOnly>
        <div className="overflow-x-auto rounded-[24px] border border-border/60 bg-card/95 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center">
                    <Ticket className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {coupons.length === 0 ? tr("admin.coupons.empty", "No coupons found") : tr("admin.coupons.emptySearch", "No coupons match the search")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCoupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{coupon.name || coupon.code}</span>
                        {coupon.firstPurchaseOnly ? (
                          <Badge variant="amber">Primeira compra</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{(coupon.ruleType ?? "coupon") === "coupon" ? coupon.code : "-"}</TableCell>
                    <TableCell>{ruleTypeLabels[coupon.ruleType ?? "coupon"]}</TableCell>
                    <TableCell>{formatCouponValue(coupon)}</TableCell>
                    <TableCell>
                      <Badge variant={coupon.isActive ? "default" : "secondary"}>{coupon.isActive ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(coupon.startsAt)} ate {formatDate(coupon.endsAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {coupon.currentUses || 0}
                      {coupon.maxUses ? ` / ${coupon.maxUses}` : ""}
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
                          <DropdownMenuItem onClick={() => handleDelete(coupon.id)} className="cursor-pointer text-destructive">
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
          showing={{ start: pageStart, end: pageEnd, total: filteredCoupons.length }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("admin.coupons.deleteTitle", "Confirm deletion")}</AlertDialogTitle>
            <AlertDialogDescription>{tr("admin.coupons.deleteConfirm", "Are you sure you want to delete this coupon? This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" onClick={() => setCouponToDelete(null)}>
              {tr("admin.common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="cursor-pointer bg-destructive text-white hover:bg-destructive/90">
              {tr("admin.coupons.deleteAction", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}
