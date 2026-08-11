"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  ArrowLeft,
  Check,
  X,
  Search,
  ChevronsUpDown,
  Plus,
  Minus,
  Trash2,
  User,
  Building2,
  Package,
  ShoppingCart,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomerDetailAction, getCustomersAction } from "@/lib/actions/customers";
import {
  getStoreProductWithVariantsAction,
} from "@/lib/actions/products";
import { createAssistedOrderAction } from "@/lib/actions/orders";
import { getCorePaymentMethodsAction } from "@/lib/actions/settings";
import {
  getCartAction,
  addToCartBatchAction,
  addCompositionToCartAction,
  updateCompositionInstanceQuantityAction,
  selectCompositionItemsBatchAction,
  removeCompositionInstanceAction,
  type AddCompositionToCartBackendResponse,
  updateCartItemQuantityAction,
  removeCartItemByIdAction,
  updateCartShippingAction,
  updateCartPaymentAction,
  updateCartNotesAction,
  updateCartManualDiscountAction,
  clearCartAction,
  type CartWithCalculation,
} from "@/lib/actions/cart";
import { getCompositionsAction, type Composition } from "@/lib/actions/compositions";
import { NewCustomerDialog } from "@/components/admin/new-customer-dialog";
import IntegerInput from "@/components/form/IntegerInput";
import CurrencyInput from "@/components/form/CurrencyInput";
import PercentageInput from "@/components/form/PercentageInput";
import { useCommercialData } from "@/hooks/use-commercial-data";
import { formatCurrency } from "@/lib/pricing";
import type { Customer, Product, ProductVariant } from "@/lib/types";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import {
  AssistedOrderProductCatalog,
  type AssistedOrderVariantSelection,
} from "@/components/admin/assisted-order-product-catalog";

interface CartItem {
  cartItemId: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  stock: number;
  image?: string;
  compositionInstanceId?: number | null;
  compositionInstanceQuantity?: number | null;
  compositionItemId?: number | null;
  compositionGroupUuid?: string | null;
  compositionNameSnapshot?: string | null;
  compositionPricingModeSnapshot?: string | null;
  compositionDisplayModeSnapshot?: string | null;
  compositionDiscountAllocatedCents?: number;
}

const MAX_MANUAL_DISCOUNT_BPS = 10_000
type ManualDiscountInputMode = "amount" | "percent"
const MANUAL_DISCOUNT_TYPE_STORAGE_KEY = "orders.new.manualDiscountType"
const STANDARD_CARD_HEADER_CLASS = "pb-4"
const STANDARD_CARD_TITLE_CLASS = "text-base font-semibold"
const INITIAL_BOOTSTRAP_DEDUPE_WINDOW_MS = 4000

let lastNewOrderBootstrapAt = 0
let lastNewOrderCustomerBootstrapAt = 0

interface CompositionWizardState {
  instanceId: number
  compositionName: string
  templates: AddCompositionToCartBackendResponse['item_templates']
}

interface CompositionWizardSelection {
  productVariantId: number
  quantity: number
  assetId?: number | null
}

interface CompositionCartGroup {
  key: string
  instanceId: number | null
  name: string
  compositionQuantity: number
  items: CartItem[]
}

function parseCsvUrls(csv: string | null | undefined): string[] {
  if (!csv) return []
  return csv
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0)
}

function applyCompositionItemDiscountToUnitPrice(
  baseUnitPrice: number,
  itemDiscountMode: string | null | undefined,
  itemDiscountValue: number | null | undefined,
): number {
  const presentation = getCompositionItemDiscountPresentation(
    baseUnitPrice,
    itemDiscountMode,
    itemDiscountValue,
  )

  return presentation.finalPrice
}

function getCompositionItemDiscountPresentation(
  baseUnitPrice: number,
  itemDiscountMode: string | null | undefined,
  itemDiscountValue: number | null | undefined,
): {
  originalPrice: number
  finalPrice: number
  discountAmount: number
  discountLabel: string | null
} {
  const baseCents = Math.max(0, Math.round(Number(baseUnitPrice || 0) * 100))
  const normalizedMode = String(itemDiscountMode || 'NONE').toUpperCase()
  const normalizedValue = Math.max(0, Number(itemDiscountValue || 0))

  if (normalizedMode === 'PERCENT_BPS') {
    const discountCents = Math.round(baseCents * (normalizedValue / 10000))
    const percentValue = normalizedValue / 100
    const formattedPercent = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: Number.isInteger(percentValue) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(percentValue)

    return {
      originalPrice: baseCents / 100,
      finalPrice: Math.max(0, baseCents - discountCents) / 100,
      discountAmount: discountCents / 100,
      discountLabel: `-${formattedPercent}%`,
    }
  }

  if (normalizedMode === 'FIXED_CENTS') {
    const discountCents = Math.round(normalizedValue)
    return {
      originalPrice: baseCents / 100,
      finalPrice: Math.max(0, baseCents - discountCents) / 100,
      discountAmount: Math.max(0, discountCents) / 100,
      discountLabel: `-${formatCurrency(Math.max(0, discountCents) / 100)}`,
    }
  }

  return {
    originalPrice: baseCents / 100,
    finalPrice: baseCents / 100,
    discountAmount: 0,
    discountLabel: null,
  }
}

function clampManualDiscountBps(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_MANUAL_DISCOUNT_BPS, Math.round(value)))
}

function getManualDiscountBase(subtotal: number, automaticDiscountAmount = 0): number {
  const normalizedSubtotal = Math.max(0, Number(subtotal || 0))
  const normalizedAutomaticDiscount = Math.max(0, Number(automaticDiscountAmount || 0))
  return Math.max(0, normalizedSubtotal - normalizedAutomaticDiscount)
}

function deriveManualDiscountBpsFromAmount(amount: number, baseAmount: number): number {
  const normalizedBase = Math.max(0, Number(baseAmount) || 0)
  if (normalizedBase <= 0) return 0
  const normalizedAmount = Math.max(0, Number(amount) || 0)
  const calculated = (normalizedAmount / normalizedBase) * MAX_MANUAL_DISCOUNT_BPS
  return clampManualDiscountBps(calculated)
}

function deriveManualDiscountAmountFromBps(bps: number, baseAmount: number): number {
  const normalizedBase = Math.max(0, Number(baseAmount) || 0)
  if (normalizedBase <= 0) return 0
  const normalizedBps = clampManualDiscountBps(bps)
  return (normalizedBase * normalizedBps) / MAX_MANUAL_DISCOUNT_BPS
}

export default function NewOrderPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMobileOrderPanelOpen, setIsMobileOrderPanelOpen] = useState(false)

  function showError(message: string) {
    toast.error(message)
  }

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false)
  const [isPersistingAssistedCustomer, setIsPersistingAssistedCustomer] = useState(false)
  const customerSearchSeqRef = useRef(0);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingSelectedCustomerCart, setIsLoadingSelectedCustomerCart] = useState(false);
  const { priceTables, sellers } = useCommercialData();

  const [compositions, setCompositions] = useState<Composition[]>([])
  const [catalogTab, setCatalogTab] = useState<"products" | "compositions">("products")
  const [compositionSearch, setCompositionSearch] = useState("");
  const [compositionSearchTerm, setCompositionSearchTerm] = useState("")
  const [isLoadingCompositions, setIsLoadingCompositions] = useState(false)
  const [isLoadingMoreCompositions, setIsLoadingMoreCompositions] = useState(false)
  const [compositionsPage, setCompositionsPage] = useState(1)
  const [hasMoreCompositions, setHasMoreCompositions] = useState(true)
  const compositionsScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const compositionsLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [compositionWizard, setCompositionWizard] = useState<CompositionWizardState | null>(null)
  const [compositionWizardMode, setCompositionWizardMode] = useState<'create' | 'edit'>('create')
  const [compositionWizardStep, setCompositionWizardStep] = useState(0)
  const [compositionWizardProduct, setCompositionWizardProduct] = useState<Product | null>(null)
  const [compositionWizardVariants, setCompositionWizardVariants] = useState<ProductVariant[]>([])
  const [isLoadingCompositionWizardVariants, setIsLoadingCompositionWizardVariants] = useState(false)
  const [compositionCollapsedVariantColors, setCompositionCollapsedVariantColors] = useState<Record<string, boolean>>({})
  const [compositionWizardSelections, setCompositionWizardSelections] = useState<Record<number, CompositionWizardSelection>>({})
  const [selectedCompositionVariantId, setSelectedCompositionVariantId] = useState("")
  const [selectedCompositionVariantQuantity, setSelectedCompositionVariantQuantity] = useState(1)

  const [shippingPrice, setShippingPrice] = useState<number>(0);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [manualDiscountBps, setManualDiscountBps] = useState<number>(0);
  const [manualDiscountMode, setManualDiscountMode] = useState<ManualDiscountInputMode>("percent");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [backendCartSnapshot, setBackendCartSnapshot] = useState<CartWithCalculation | null>(null);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<Array<{ id?: number; value: string; label: string }>>([]);
  const [notes, setNotes] = useState("");
  const hydratedShippingRef = useRef<number | null>(null)
  const hydratedManualDiscountRef = useRef<number | null>(null)
  const hydratedManualDiscountBpsRef = useRef<number | null>(null)
  const hydratedNotesRef = useRef<string | null>(null)
  const hydratedPaymentMethodRef = useRef<string | null>(null)
  const shippingDirtyRef = useRef(false)
  const manualDiscountDirtyRef = useRef(false)
  const notesDirtyRef = useRef(false)
  const paymentMethodDirtyRef = useRef(false)

  useEffect(() => {
    if (!customerSearch.trim()) {
      const now = Date.now()
      if (now - lastNewOrderCustomerBootstrapAt < INITIAL_BOOTSTRAP_DEDUPE_WINDOW_MS) {
        return
      }
      lastNewOrderCustomerBootstrapAt = now
    }

    const timeout = setTimeout(() => {
      void loadCustomers(customerSearch)
    }, 300)

    return () => clearTimeout(timeout)
  }, [customerSearch])

  useEffect(() => {
    if (!customerOpen) return
    if (selectedCustomer) return
    if (customers.length > 0) return

    void loadCustomers("")
  }, [customerOpen, selectedCustomer, customers.length])

  useEffect(() => {
    const now = Date.now()
    if (now - lastNewOrderBootstrapAt < INITIAL_BOOTSTRAP_DEDUPE_WINDOW_MS) {
      return
    }

    lastNewOrderBootstrapAt = now

    void loadPaymentMethodsFromSettings()
    void loadLoggedUserCart()
  }, [])

  useEffect(() => {
    if (catalogTab !== 'compositions') return

    const timeout = setTimeout(() => {
      setCompositionSearchTerm(compositionSearch.trim())
    }, 300)

    return () => clearTimeout(timeout)
  }, [catalogTab, compositionSearch])

  useEffect(() => {
    if (catalogTab !== 'compositions') return
    void loadCompositionsPage(1, { replace: true, search: compositionSearchTerm })
  }, [catalogTab, compositionSearchTerm])

  const currentCompositionWizardTemplate = useMemo(() => {
    if (!compositionWizard) return null
    return compositionWizard.templates[compositionWizardStep] || null
  }, [compositionWizard, compositionWizardStep])

  const compositionWizardVariantsByColor = useMemo(() => {
    const grouped: Record<string, ProductVariant[]> = {}
    compositionWizardVariants.forEach((variant) => {
      const color = variant.color || 'Sem cor'
      if (!grouped[color]) grouped[color] = []
      grouped[color].push(variant)
    })
    return grouped
  }, [compositionWizardVariants])

  const compositionWizardVariantColorEntries = useMemo(() => {
    return Object.entries(compositionWizardVariantsByColor)
      .sort(([colorA], [colorB]) => colorA.localeCompare(colorB))
      .map(([color, variants]) => [
        color,
        [...variants].sort((a, b) => String(a.size || '').localeCompare(String(b.size || ''))),
      ] as const)
  }, [compositionWizardVariantsByColor])

  const allCompositionVariantColorGroupKeys = useMemo(() => {
    if (!compositionWizardProduct) return []
    return compositionWizardVariantColorEntries.map(([color]) => `${compositionWizardProduct.id}:${color}`)
  }, [compositionWizardVariantColorEntries, compositionWizardProduct])

  const areAllCompositionVariantColorsCollapsed = useMemo(() => {
    return (
      allCompositionVariantColorGroupKeys.length > 0 &&
      allCompositionVariantColorGroupKeys.every((key) => Boolean(compositionCollapsedVariantColors[key]))
    )
  }, [allCompositionVariantColorGroupKeys, compositionCollapsedVariantColors])

  function toggleAllCompositionVariantColorGroups() {
    if (!compositionWizardProduct || allCompositionVariantColorGroupKeys.length === 0) return

    const shouldCollapseAll = !areAllCompositionVariantColorsCollapsed
    setCompositionCollapsedVariantColors((prev) => {
      const next = { ...prev }
      for (const key of allCompositionVariantColorGroupKeys) {
        next[key] = shouldCollapseAll
      }
      return next
    })
  }

  useEffect(() => {
    if (!compositionWizard || !currentCompositionWizardTemplate) {
      setCompositionWizardProduct(null)
      setCompositionWizardVariants([])
      setCompositionCollapsedVariantColors({})
      setSelectedCompositionVariantId("")
      return
    }

    setIsLoadingCompositionWizardVariants(true)
    setSelectedCompositionVariantQuantity(Math.max(1, Number(currentCompositionWizardTemplate.quantity || 1)))

    getStoreProductWithVariantsAction(String(currentCompositionWizardTemplate.product_id)).then((result) => {
      if (!result.success) {
        showError(result.error || 'Erro ao carregar variações do item da composição')
        setCompositionWizardProduct(null)
        setCompositionWizardVariants([])
        setSelectedCompositionVariantId("")
        setIsLoadingCompositionWizardVariants(false)
        return
      }

      setCompositionWizardProduct(result.data)
      const variants = Array.isArray(result.data.variants) ? result.data.variants : []
      setCompositionWizardVariants(variants)
      setCompositionCollapsedVariantColors({})

      const savedSelection = compositionWizardSelections[currentCompositionWizardTemplate.id]
      if (savedSelection) {
        setSelectedCompositionVariantId(String(savedSelection.productVariantId))
        setSelectedCompositionVariantQuantity(Math.max(1, Number(savedSelection.quantity || 1)))
      } else if (variants.length === 1) {
        setSelectedCompositionVariantId(String(variants[0].id))
      } else {
        setSelectedCompositionVariantId("")
      }

      setIsLoadingCompositionWizardVariants(false)
    })
  }, [compositionWizard, currentCompositionWizardTemplate, compositionWizardSelections])

  useEffect(() => {
    const root = compositionsScrollContainerRef.current
    const sentinel = compositionsLoadMoreRef.current

    if (!root || !sentinel || catalogTab !== 'compositions') {
      return
    }

    if (!hasMoreCompositions || isLoadingCompositions || isLoadingMoreCompositions) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return

        if (!isLoadingMoreCompositions) {
          void loadCompositionsPage(compositionsPage + 1, { search: compositionSearchTerm })
        }
      },
      { root, rootMargin: "240px 0px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    catalogTab,
    hasMoreCompositions,
    isLoadingCompositions,
    isLoadingMoreCompositions,
    compositionsPage,
    compositionSearchTerm,
  ])

  useEffect(() => {
    const savedMode = typeof window !== "undefined"
      ? window.localStorage.getItem(MANUAL_DISCOUNT_TYPE_STORAGE_KEY)
      : null

    if (savedMode === "amount" || savedMode === "percent") {
      setManualDiscountMode(savedMode)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(MANUAL_DISCOUNT_TYPE_STORAGE_KEY, manualDiscountMode)
  }, [manualDiscountMode])

  const paymentMethodsForSelectedCustomer = useMemo(() => {
    return availablePaymentMethods
  }, [availablePaymentMethods])

  const resolvedPaymentMethod = useMemo(() => {
    const allowedValues = new Set(paymentMethodsForSelectedCustomer.map((method) => method.value))
    if (allowedValues.has(paymentMethod)) return paymentMethod
    return ""
  }, [paymentMethodsForSelectedCustomer, paymentMethod])

  const resolvedPaymentMethodOption = useMemo(() => {
    return paymentMethodsForSelectedCustomer.find((method) => method.value === resolvedPaymentMethod) || null
  }, [paymentMethodsForSelectedCustomer, resolvedPaymentMethod])

  const customerComboboxItems = useMemo(() => {
    const sourceCustomers = [...customers]
    const selectedId = String(selectedCustomer?.id || "").trim()

    // Keep the currently selected customer available in options even if not present in current search page.
    if (selectedCustomer && selectedId && !sourceCustomers.some((customer) => String(customer.id) === selectedId)) {
      sourceCustomers.unshift(selectedCustomer)
    }

    const seenCustomerIds = new Set<string>()
    return sourceCustomers.flatMap((customer, index) => {
      const id = String(customer.id || "").trim()
      if (!id || seenCustomerIds.has(id)) return []
      seenCustomerIds.add(id)

      const name = customer.tradeName || customer.companyName || "Sem nome"
      const secondary = customer.cnpj || customer.contactName || "Sem documento"
      const label = `${name} - ${secondary}`

      return {
        id,
        rowKey: `${id}-${index}`,
        label,
        value: label,
        customer,
      }
    })
  }, [customers, selectedCustomer])

  const selectedCustomerComboboxValue = useMemo(() => {
    if (!selectedCustomer) return null
    const selectedId = String(selectedCustomer.id || "").trim()
    const knownCustomerOption = customerComboboxItems.find((item) => item.id === selectedId)
    if (knownCustomerOption) {
      return knownCustomerOption.value
    }

    const name = selectedCustomer.tradeName || selectedCustomer.companyName || "Sem nome"
    const secondary = selectedCustomer.cnpj || selectedCustomer.contactName || "Sem documento"
    return `${name} - ${secondary}`
  }, [selectedCustomer, customerComboboxItems])

  useEffect(() => {
    if (selectedCustomer || !backendCartSnapshot) return

    const assistedCustomerId = String(backendCartSnapshot.assistedCustomerId || "").trim()
    const assistedCustomerName = String(backendCartSnapshot.assistedCustomerName || "").trim().toLowerCase()

    if (assistedCustomerId) {
      const knownCustomer = customers.find(
        (customer) => String(customer.id) === assistedCustomerId,
      )
      if (knownCustomer) {
        setSelectedCustomer(knownCustomer)
        return
      }

      void (async () => {
        const detail = await getCustomerDetailAction(assistedCustomerId)
        if (detail.success && detail.data) {
          setSelectedCustomer(detail.data)
        }
      })()
      return
    }

    if (assistedCustomerName) {
      const byName = customers.find((customer) => {
        const customerName = (customer.tradeName || customer.companyName || "").trim().toLowerCase()
        return customerName.length > 0 && customerName === assistedCustomerName
      })

      if (byName) {
        setSelectedCustomer(byName)
      }
    }
  }, [selectedCustomer, backendCartSnapshot, customers])

  useEffect(() => {
    if (!shippingDirtyRef.current) return

    const timeout = setTimeout(() => {
      shippingDirtyRef.current = false
      startTransition(async () => {
        await persistShippingInCustomerCart(shippingPrice)
      })
    }, 500)

    return () => clearTimeout(timeout)
  }, [shippingPrice])

  useEffect(() => {
    if (!manualDiscountDirtyRef.current) return

    const timeout = setTimeout(() => {
      manualDiscountDirtyRef.current = false
      startTransition(async () => {
        await persistManualDiscountInCustomerCart(
          manualDiscount,
          manualDiscountBps,
          manualDiscountMode,
        )
      })
    }, 500)

    return () => clearTimeout(timeout)
  }, [manualDiscount, manualDiscountBps, manualDiscountMode])

  async function loadCustomers(searchTerm = ""): Promise<Customer[]> {
    const requestSeq = ++customerSearchSeqRef.current
    setIsLoadingCustomers(true);
    const query = searchTerm.trim()
    const result = await getCustomersAction({ status: "APPROVED", q: query || undefined });
    if (requestSeq !== customerSearchSeqRef.current) {
      return []
    }

    if (result.success && result.data) {
      setCustomers(result.data);
      setIsLoadingCustomers(false);
      return result.data;
    }

    setCustomers([])
    setIsLoadingCustomers(false);
    return [];
  }

  async function loadCompositionsPage(page: number, options?: { replace?: boolean; search?: string }) {
    const replace = Boolean(options?.replace)
    const search = (options?.search ?? compositionSearchTerm).trim()

    if (replace) {
      setIsLoadingCompositions(true)
      setCompositionsPage(1)
      setHasMoreCompositions(true)
      setCompositions([])
    } else {
      setIsLoadingMoreCompositions(true)
    }

    const result = await getCompositionsAction({ active: 'active', search: search || undefined, page, page_size: 30 })
    if (!result.success) {
      showError(result.error || 'Erro ao carregar composições')
      if (replace) {
        setCompositions([])
        setHasMoreCompositions(false)
      }
      setIsLoadingCompositions(false)
      setIsLoadingMoreCompositions(false)
      return
    }

    const nextItems = result.data.items || []
    const totalPages = Math.max(1, Number(result.data.total_pages || 1))

    setCompositions((prev) => {
      if (replace) return nextItems

      const seen = new Set(prev.map((item) => Number(item.id)))
      const merged = [...prev]
      for (const item of nextItems) {
        const key = Number(item.id)
        if (!seen.has(key)) {
          merged.push(item)
          seen.add(key)
        }
      }
      return merged
    })

    setCompositionsPage(page)
    setHasMoreCompositions(page < totalPages && nextItems.length > 0)

    if (replace) {
      setIsLoadingCompositions(false)
    } else {
      setIsLoadingMoreCompositions(false)
    }
  }

  async function loadPaymentMethodsFromSettings() {
    const result = await getCorePaymentMethodsAction()
    if (result.success && result.data) {
      setAvailablePaymentMethods(
        result.data.map((method) => {
          if (method.value === 'CARTAO_EXTERNO') {
            return { ...method, label: 'Cartão' }
          }
          return method
        }),
      )
      return
    }

    setAvailablePaymentMethods([])
  }

  function mapBackendCartToOrderCart(cartData: { items?: unknown[] }): CartItem[] {
    return (cartData.items || []).map((item) => {
      const rawItem = item as unknown as {
        id?: string
        productId?: string
        variantId?: string
        quantity?: number
        unitPrice?: number
        compositionInstanceId?: number | null
        compositionInstanceQuantity?: number | null
        compositionItemId?: number | null
        compositionGroupUuid?: string | null
        compositionNameSnapshot?: string | null
        compositionPricingModeSnapshot?: string | null
        compositionDisplayModeSnapshot?: string | null
        compositionDiscountAllocatedCents?: number
        variant?: {
          id?: string
          productId?: string
          color?: string
          size?: string
          variantSku?: string
          stock?: number
          priceOverride?: number | null
          product?: {
            id?: string
            name?: string
            basePrice?: number
            images?: string[]
          }
        }
      }

      const variant = rawItem.variant
      const product = variant?.product
      const unitPrice =
        typeof rawItem.unitPrice === "number"
          ? rawItem.unitPrice
          : typeof variant?.priceOverride === "number"
            ? variant.priceOverride
            : product?.basePrice || 0

      return {
        cartItemId: String(rawItem.id || ""),
        productId: String(rawItem.productId || product?.id || ""),
        variantId: String(rawItem.variantId || variant?.id || ""),
        productName: String(product?.name || "Produto"),
        sku: String(variant?.variantSku || ""),
        color: String(variant?.color || ""),
        size: String(variant?.size || ""),
        quantity: Number(rawItem.quantity || 0),
        unitPrice,
        stock: Number(variant?.stock || 999999),
        image: product?.images?.[0],
        compositionInstanceId:
          typeof rawItem.compositionInstanceId === "number" ? rawItem.compositionInstanceId : null,
        compositionInstanceQuantity:
          typeof rawItem.compositionInstanceQuantity === "number" ? rawItem.compositionInstanceQuantity : null,
        compositionItemId:
          typeof rawItem.compositionItemId === "number" ? rawItem.compositionItemId : null,
        compositionGroupUuid: rawItem.compositionGroupUuid || null,
        compositionNameSnapshot: rawItem.compositionNameSnapshot || null,
        compositionPricingModeSnapshot: rawItem.compositionPricingModeSnapshot || null,
        compositionDisplayModeSnapshot: rawItem.compositionDisplayModeSnapshot || null,
        compositionDiscountAllocatedCents: Number(rawItem.compositionDiscountAllocatedCents || 0),
      }
    })
  }

  function applyBackendCartState(cartData: CartWithCalculation) {
    setBackendCartSnapshot(cartData)
    setCart(mapBackendCartToOrderCart(cartData))
  }

  async function loadLoggedUserCart() {
    setIsLoadingSelectedCustomerCart(true)
    const result = await getCartAction()

    if (!result.success || !result.data) {
      setBackendCartSnapshot(null)
      setCart([])
      showError(result.error || "Erro ao carregar carrinho")
      setIsLoadingSelectedCustomerCart(false)
      return
    }

    const loadedCart = mapBackendCartToOrderCart(result.data)
    applyBackendCartState(result.data)
    const loadedShipping = Number(result.data.shippingAmount || 0)
    const loadedSubtotal = getCartSubtotal(loadedCart)
    const loadedBaseAmount = getManualDiscountBase(loadedSubtotal, Number(result.data.discountAmount || 0))
    const loadedManualDiscount = Number(result.data.manualDiscountAmount || 0)
    const loadedManualDiscountBpsRaw = Number(result.data.manualDiscountBps)
    const hasManualDiscountBps = Number.isFinite(loadedManualDiscountBpsRaw) && loadedManualDiscountBpsRaw > 0
    const loadedManualDiscountBps = hasManualDiscountBps
      ? clampManualDiscountBps(loadedManualDiscountBpsRaw)
      : deriveManualDiscountBpsFromAmount(loadedManualDiscount, loadedBaseAmount)
    const loadedNotes = String(result.data.checkoutNotes || "")
    const loadedAssistedCustomerId = String(result.data.assistedCustomerId || "").trim()
    const loadedAssistedCustomerName = String(result.data.assistedCustomerName || "").trim()
    hydratedShippingRef.current = loadedShipping
    hydratedManualDiscountRef.current = loadedManualDiscount
    hydratedManualDiscountBpsRef.current = loadedManualDiscountBps
    hydratedNotesRef.current = loadedNotes
    shippingDirtyRef.current = false
    manualDiscountDirtyRef.current = false
    if (hasManualDiscountBps) {
      setManualDiscountMode("percent")
    }
    notesDirtyRef.current = false
    setShippingPrice(loadedShipping)
    setManualDiscount(loadedManualDiscount)
    setManualDiscountBps(loadedManualDiscountBps)
    setNotes(loadedNotes)

    if (loadedAssistedCustomerId) {
      const knownCustomer = customers.find(
        (customer) => String(customer.id) === loadedAssistedCustomerId,
      )

      if (knownCustomer) {
        setSelectedCustomer(knownCustomer)
      } else {
        const customerResult = await getCustomerDetailAction(loadedAssistedCustomerId)
        if (customerResult.success && customerResult.data) {
          setSelectedCustomer(customerResult.data)
        } else {
          setSelectedCustomer(null)
        }
      }
    } else if (loadedAssistedCustomerName) {
      const normalizedLoadedName = loadedAssistedCustomerName.toLowerCase()
      const knownCustomerByName = customers.find((customer) => {
        const customerName = (customer.tradeName || customer.companyName || "").trim().toLowerCase()
        return customerName.length > 0 && customerName === normalizedLoadedName
      })
      if (knownCustomerByName) {
        setSelectedCustomer(knownCustomerByName)
      } else {
        setSelectedCustomer((current) => current)
      }
    } else {
      setSelectedCustomer(null)
    }

    const loadedPaymentMethod = String(result.data.paymentOptionCode || "").trim()
    if (loadedPaymentMethod) {
      hydratedPaymentMethodRef.current = loadedPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(loadedPaymentMethod)
    } else {
      hydratedPaymentMethodRef.current = ""
      paymentMethodDirtyRef.current = false
      setPaymentMethod("")
    }
    setIsLoadingSelectedCustomerCart(false)
  }

  async function persistAssistedCustomerInLoggedCart(nextCustomer: Customer | null): Promise<CartWithCalculation | null> {
    const assistedCustomerId = nextCustomer
      ? (() => {
          const raw = String(nextCustomer.id || "").trim()
          if (!/^\d+$/.test(raw)) return null
          const parsed = Number(raw)
          return Number.isFinite(parsed) && parsed > 0 ? String(Math.trunc(parsed)) : null
        })()
      : null

    if (nextCustomer && !assistedCustomerId) {
      showError("Cliente selecionado sem ID numérico válido para persistir no carrinho")
      return null
    }

    const result = await updateCartNotesAction({
      notes,
      assistedCustomerId,
      assistedCustomerName: nextCustomer
        ? (nextCustomer.tradeName || nextCustomer.companyName || null)
        : null,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir cliente assistido no carrinho")
      return null
    }

    applyBackendCartState(result.data)
    const persistedNotes = String(result.data.checkoutNotes || "")
    hydratedNotesRef.current = persistedNotes
    notesDirtyRef.current = false
    setNotes(persistedNotes)
    return result.data
  }

  async function persistAndReloadAssistedCustomer(nextCustomer: Customer | null): Promise<boolean> {
    const persistedCart = await persistAssistedCustomerInLoggedCart(nextCustomer)
    if (!persistedCart) return false

    setSelectedCustomer(nextCustomer)
    return true
  }

  async function handleAssistedCustomerSelection(value: string | null) {
    if (isPersistingAssistedCustomer) return

    if (!value) {
      setCustomerSearch("")
      setCustomerOpen(false)

      setIsPersistingAssistedCustomer(true)
      try {
        const ok = await persistAndReloadAssistedCustomer(null)
        if (!ok) {
          showError("Não foi possível limpar o cliente no backend")
        }
      } finally {
        setIsPersistingAssistedCustomer(false)
      }
      return
    }

    const selected = customerComboboxItems.find(
      (item) => item.value === value || item.label === value,
    )
    if (!selected) return

    setIsPersistingAssistedCustomer(true)
    try {
      const ok = await persistAndReloadAssistedCustomer(selected.customer)
      if (ok) {
        setCustomerOpen(false)
      }
    } finally {
      setIsPersistingAssistedCustomer(false)
    }
  }

  function handleCustomerComboboxInputValueChange(nextValue: string) {
    setCustomerSearch(nextValue)
  }

  async function persistShippingInCustomerCart(nextShippingPrice: number): Promise<boolean> {
    console.log('[NEW_ORDER] Persistindo frete:', nextShippingPrice)
    const result = await updateCartShippingAction({
      code: "manual",
      name: "Frete Manual",
      priceCents: Math.max(0, Math.round(nextShippingPrice * 100)),
      deliveryDays: 0,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir frete no carrinho")
      return false
    }

    applyBackendCartState(result.data)
    const persistedShipping = Number(result.data.shippingAmount || 0)
    hydratedShippingRef.current = persistedShipping
    shippingDirtyRef.current = false
    setShippingPrice(persistedShipping)
    return true
  }

  async function persistPaymentInCustomerCart(nextPaymentMethod: string): Promise<boolean> {
    const selectedMethod = paymentMethodsForSelectedCustomer.find((method) => method.value === nextPaymentMethod)
    const paymentLabel = selectedMethod?.label || nextPaymentMethod

    if (!selectedMethod?.id || !Number.isFinite(selectedMethod.id) || selectedMethod.id <= 0) {
      showError("Metodo de pagamento aceito na configuracao nao esta cadastrado no backend.")
      return false
    }

    const result = await updateCartPaymentAction({
      methodId: selectedMethod.id,
      code: nextPaymentMethod,
      name: paymentLabel,
      paymentType: nextPaymentMethod,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir forma de pagamento no carrinho")
      return false
    }

    applyBackendCartState(result.data)
    const persistedPaymentMethod = String(result.data.paymentOptionCode || "").trim()
    if (persistedPaymentMethod) {
      hydratedPaymentMethodRef.current = persistedPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(persistedPaymentMethod)
    } else {
      hydratedPaymentMethodRef.current = nextPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(nextPaymentMethod)
    }
    return true
  }

  async function persistNotesInCustomerCart(nextNotes: string): Promise<boolean> {
    const normalizedNotes = nextNotes.trim()

    const result = await updateCartNotesAction({
      notes: normalizedNotes,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir observações no carrinho")
      return false
    }

    applyBackendCartState(result.data)
    const persistedNotes = String(result.data.checkoutNotes || "")
    hydratedNotesRef.current = persistedNotes
    notesDirtyRef.current = false
    setNotes(persistedNotes)
    return true
  }

  async function persistManualDiscountInCustomerCart(
    nextManualDiscount: number,
    nextManualDiscountBps: number,
    mode: ManualDiscountInputMode,
  ): Promise<boolean> {
    const normalizedManualDiscount = Math.min(
      maxManualDiscount,
      Math.max(0, Number(nextManualDiscount) || 0)
    )
    const normalizedManualDiscountBps = clampManualDiscountBps(nextManualDiscountBps)

    if (Math.abs(normalizedManualDiscount - nextManualDiscount) > 0.0001) {
      setManualDiscount(normalizedManualDiscount)
    }

    const result = await updateCartManualDiscountAction({
      manualDiscount: normalizedManualDiscount,
      manualDiscountBps: mode === "percent" ? normalizedManualDiscountBps : null,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir desconto manual no carrinho")
      return false
    }

    const persistedCart = mapBackendCartToOrderCart(result.data)
    applyBackendCartState(result.data)
    const persistedSubtotal = getCartSubtotal(persistedCart)
    const persistedBaseAmount = getManualDiscountBase(persistedSubtotal, Number(result.data.discountAmount || 0))
    const persistedManualDiscount = Number(result.data.manualDiscountAmount || 0)
    const persistedManualDiscountBpsRaw = Number(result.data.manualDiscountBps)
    const persistedManualDiscountBps = mode === "percent"
      ? clampManualDiscountBps(
          Number.isFinite(persistedManualDiscountBpsRaw)
            ? persistedManualDiscountBpsRaw
            : deriveManualDiscountBpsFromAmount(persistedManualDiscount, persistedBaseAmount)
        )
      : deriveManualDiscountBpsFromAmount(persistedManualDiscount, persistedBaseAmount)

    hydratedManualDiscountRef.current = persistedManualDiscount
    hydratedManualDiscountBpsRef.current = mode === "percent" ? persistedManualDiscountBps : null
    manualDiscountDirtyRef.current = false
    setManualDiscount(persistedManualDiscount)
    setManualDiscountBps(persistedManualDiscountBps)
    return true
  }

  async function flushPendingCartDrafts(): Promise<boolean> {
    if (shippingDirtyRef.current) {
      shippingDirtyRef.current = false
      const persisted = await persistShippingInCustomerCart(shippingPrice)
      if (!persisted) return false
    }

    if (manualDiscountDirtyRef.current) {
      manualDiscountDirtyRef.current = false
      const persisted = await persistManualDiscountInCustomerCart(
        manualDiscount,
        manualDiscountBps,
        manualDiscountMode,
      )
      if (!persisted) return false
    }

    if (notesDirtyRef.current) {
      notesDirtyRef.current = false
      const persisted = await persistNotesInCustomerCart(notes)
      if (!persisted) return false
    }

    if (paymentMethodDirtyRef.current) {
      paymentMethodDirtyRef.current = false
      const persisted = await persistPaymentInCustomerCart(paymentMethod)
      if (!persisted) return false
    }

    return true
  }

  const handleManualDiscountAmountChange = (value: number | null) => {
    const normalizedAmount = Math.min(maxManualDiscount, Math.max(0, Number(value || 0)))
    const baseAmount = getManualDiscountBase(
      Number(backendCartSnapshot?.subtotal || 0),
      Number(backendCartSnapshot?.discountAmount || 0),
    )
    const normalizedBps = deriveManualDiscountBpsFromAmount(normalizedAmount, baseAmount)
    manualDiscountDirtyRef.current = true
    setManualDiscountMode("amount")
    setManualDiscount(normalizedAmount)
    setManualDiscountBps(normalizedBps)
  }

  const handleManualDiscountPercentChange = (value: number | null) => {
    const percentDecimal = Math.max(0, Math.min(1, Number(value || 0)))
    const nextBps = clampManualDiscountBps(percentDecimal * MAX_MANUAL_DISCOUNT_BPS)
    const baseAmount = getManualDiscountBase(
      Number(backendCartSnapshot?.subtotal || 0),
      Number(backendCartSnapshot?.discountAmount || 0),
    )
    const calculatedAmount = deriveManualDiscountAmountFromBps(nextBps, baseAmount)
    const normalizedAmount = Math.min(maxManualDiscount, Math.max(0, calculatedAmount))
    manualDiscountDirtyRef.current = true
    setManualDiscountMode("percent")
    setManualDiscountBps(nextBps)
    setManualDiscount(normalizedAmount)
  }

  const filteredCompositions = useMemo(() => compositions, [compositions])

  async function handleCatalogAddVariants(payload: {
    product: Product
    items: AssistedOrderVariantSelection[]
  }): Promise<boolean> {
    const cartItems = payload.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    }))

    const result = await addToCartBatchAction(payload.product.id, cartItems)
    if (!result.success) {
      showError(result.error || "Erro ao adicionar itens no carrinho")
      return false
    }

    if (result.data) {
      applyBackendCartState(result.data)
    }

    return true
  }

  async function handleCatalogBarcodeScan(payload: {
    product: Product
    variant: ProductVariant
  }): Promise<boolean> {
    const result = await addToCartBatchAction(String(payload.product.id), [
      { variantId: String(payload.variant.id), quantity: 1 },
    ])

    if (!result.success) {
      showError(result.error || "Erro ao adicionar item no carrinho")
      return false
    }

    if (result.data) {
      applyBackendCartState(result.data)
    }

    return true
  }

  const groupedCartItems = useMemo<CompositionCartGroup[]>(() => {
    const groups = new Map<string, CompositionCartGroup>()

    cart.forEach((item) => {
      const instanceId = item.compositionInstanceId ?? null
      if (instanceId) {
        const key = `composition:${instanceId}`
        const existing = groups.get(key)
        if (existing) {
          existing.items.push(item)
          return
        }

        groups.set(key, {
          key,
          instanceId,
          name: item.compositionNameSnapshot || item.productName,
          compositionQuantity: Number(item.compositionInstanceQuantity || 1),
          items: [item],
        })
        return
      }

      const key = `item:${item.cartItemId}`
      groups.set(key, {
        key,
        instanceId: null,
        name: item.productName,
        compositionQuantity: item.quantity,
        items: [item],
      })
    })

    return Array.from(groups.values())
  }, [cart])

  const handleAddCompositionToCart = (composition: Composition) => {
    startTransition(async () => {
      const result = await addCompositionToCartAction(composition.id)
      if (!result.success) {
        showError(result.error || 'Erro ao adicionar composição ao carrinho')
        return
      }

      const templates = Array.isArray(result.data.item_templates) ? result.data.item_templates : []
      if (templates.length === 0) {
        await loadLoggedUserCart()
        toast.success('Composição adicionada ao carrinho')
        return
      }

      setCompositionWizardMode('create')
      setCompositionWizardSelections({})

      setCompositionWizard({
        instanceId: result.data.instance_id,
        compositionName: result.data.name_snapshot || composition.name,
        templates,
      })
      setCompositionWizardStep(0)
    })
  }

  const handleRemoveCompositionGroup = (group: CompositionCartGroup) => {
    if (!group.instanceId) return

    startTransition(async () => {
      const result = await removeCompositionInstanceAction(group.instanceId)
      if (!result.success) {
        showError(result.error || 'Erro ao remover composição do carrinho')
        return
      }

      if (result.data) {
        applyBackendCartState(result.data)
      }

      toast.success('Composição removida do carrinho')
    })
  }

  const handleUpdateCompositionGroupQuantity = (group: CompositionCartGroup, delta: number) => {
    if (!group.instanceId) return

    const currentQuantity = group.compositionQuantity || 1
    const nextQuantity = Math.max(1, currentQuantity + delta)

    if (nextQuantity === currentQuantity) return

    startTransition(async () => {
      const result = await updateCompositionInstanceQuantityAction(group.instanceId!, nextQuantity)
      if (!result.success) {
        showError(result.error || 'Erro ao atualizar quantidade da composição')
        return
      }

      if (result.data) {
        applyBackendCartState(result.data)
      }
    })
  }

  const closeCompositionWizard = () => {
    setCompositionWizard(null)
    setCompositionWizardMode('create')
    setCompositionWizardStep(0)
    setCompositionWizardProduct(null)
    setCompositionWizardVariants([])
    setCompositionCollapsedVariantColors({})
    setCompositionWizardSelections({})
    setSelectedCompositionVariantId("")
    setSelectedCompositionVariantQuantity(1)
  }

  function getCompositionVariantQuantity(variant: ProductVariant): number {
    return selectedCompositionVariantId === String(variant.id) ? selectedCompositionVariantQuantity : 0
  }

  function setCompositionVariantQuantity(variant: ProductVariant, value: number) {
    const stock = Number(variant.stock || 0)
    const normalized = Math.max(0, Math.min(stock, Number(value || 0)))

    if (normalized <= 0) {
      if (selectedCompositionVariantId === String(variant.id)) {
        setSelectedCompositionVariantId('')
        setSelectedCompositionVariantQuantity(1)
      }
      return
    }

    setSelectedCompositionVariantId(String(variant.id))
    setSelectedCompositionVariantQuantity(Math.max(1, normalized))
  }

  function incrementCompositionVariantQuantity(variant: ProductVariant) {
    const current = getCompositionVariantQuantity(variant)
    setCompositionVariantQuantity(variant, current + 1)
  }

  function decrementCompositionVariantQuantity(variant: ProductVariant) {
    const current = getCompositionVariantQuantity(variant)
    setCompositionVariantQuantity(variant, current - 1)
  }

  const handleConfirmCompositionWizardStep = () => {
    if (!compositionWizard || !currentCompositionWizardTemplate) return

    const selectedVariantId = Number(selectedCompositionVariantId)
    if (!Number.isFinite(selectedVariantId) || selectedVariantId <= 0) {
      showError('Selecione uma variante para continuar')
      return
    }

    const selectedVariant = compositionWizardVariants.find((variant) => Number(variant.id) === selectedVariantId)
    const stock = Number(selectedVariant?.stock || 0)
    if (stock <= 0) {
      showError('A variante selecionada está sem estoque')
      return
    }

    if (selectedCompositionVariantQuantity <= 0 || selectedCompositionVariantQuantity > stock) {
      showError('Quantidade inválida para a variante selecionada')
      return
    }

    const nextSelections = {
      ...compositionWizardSelections,
      [currentCompositionWizardTemplate.id]: {
        productVariantId: selectedVariantId,
        quantity: selectedCompositionVariantQuantity,
        assetId: currentCompositionWizardTemplate.asset_id ?? null,
      },
    }

    const nextStep = compositionWizardStep + 1
    if (nextStep < compositionWizard.templates.length) {
      setCompositionWizardSelections(nextSelections)
      setCompositionWizardStep(nextStep)
      return
    }

    const payloadItems = compositionWizard.templates.map((template) => {
      const selection = nextSelections[template.id]
      if (!selection) {
        return null
      }

      return {
        compositionItemId: template.id,
        productVariantId: selection.productVariantId,
        quantity: selection.quantity,
        assetId: selection.assetId ?? template.asset_id ?? null,
      }
    })

    if (payloadItems.some((item) => item === null)) {
      showError('Finalize a seleção de todos os itens da composição para concluir')
      return
    }

    const normalizedPayloadItems = payloadItems.filter((item): item is NonNullable<typeof item> => item !== null)

    startTransition(async () => {
      const result = await selectCompositionItemsBatchAction(compositionWizard.instanceId, {
        items: normalizedPayloadItems,
      })

      if (!result.success || !result.data) {
        showError(result.error || 'Erro ao salvar composição')
        return
      }

      applyBackendCartState(result.data)
      toast.success(compositionWizardMode === 'edit' ? 'Composição atualizada no carrinho' : 'Composição configurada e adicionada ao pedido')
      closeCompositionWizard()
    })
  }

  const handleRemoveFromCart = (variantId: string) => {
    const target = cart.find((item) => item.variantId === variantId)
    if (!target?.cartItemId) return

    startTransition(async () => {
      const result = await removeCartItemByIdAction(target.cartItemId, target.variantId)
      if (!result.success || !result.data) {
        showError(result.error || "Erro ao remover item do carrinho")
        return
      }

      applyBackendCartState(result.data)
    })
  };

  const handleUpdateCartQuantity = (variantId: string, delta: number) => {
    const target = cart.find((item) => item.variantId === variantId)
    if (!target?.cartItemId) return

    const newQty = Math.max(1, Math.min(target.stock, target.quantity + delta))

    startTransition(async () => {
      const result = await updateCartItemQuantityAction(target.cartItemId, newQty)
      if (!result.success || !result.data) {
        showError(result.error || "Erro ao atualizar item do carrinho")
        return
      }

      applyBackendCartState(result.data)
    })
  };

  const handleClearCart = () => {
    if (cart.length === 0) return

    startTransition(async () => {
      const result = await clearCartAction()
      if (!result.success) {
        showError(result.error || "Erro ao limpar carrinho")
        return
      }

      await loadLoggedUserCart()
    })
  }

  const cartTotals = useMemo(() => {
    const totalPieces = cart.reduce((acc, item) => acc + item.quantity, 0);
    const compositionDiscountApplied = cart.reduce(
      (acc, item) => acc + Math.max(0, Number(item.compositionDiscountAllocatedCents || 0)) / 100,
      0
    )
    const subtotal = Math.max(0, Number(backendCartSnapshot?.subtotal || 0))
    const paymentMethodDiscountApplied = Math.max(0, Number(backendCartSnapshot?.paymentMethodDiscountAmount || 0))
    const manualDiscountApplied = Math.max(0, Number(backendCartSnapshot?.manualDiscountAmount || 0))
    const shippingAmount = Math.max(0, Number(backendCartSnapshot?.shippingAmount || 0))
    const total = Math.max(0, Number(backendCartSnapshot?.total || 0))
    return { subtotal, totalPieces, total, manualDiscountApplied, compositionDiscountApplied, paymentMethodDiscountApplied, shippingAmount }
  }, [backendCartSnapshot, cart]);

  const maxManualDiscount = useMemo(() => {
    return getManualDiscountBase(
      Number(backendCartSnapshot?.subtotal || 0),
      Number(backendCartSnapshot?.discountAmount || 0),
    )
  }, [backendCartSnapshot])

  const submitOrder = () => {
    startTransition(async () => {
      const flushed = await flushPendingCartDrafts()
      if (!flushed) return
      if (!selectedCustomer) {
        showError("Selecione um cliente")
        return
      }

      const formData = new FormData();
      formData.set("customerId", selectedCustomer.id);
      formData.set("items", JSON.stringify(cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        sourceCartCompositionInstanceId: item.compositionInstanceId,
        compositionItemId: item.compositionItemId,
        compositionGroupUuid: item.compositionGroupUuid,
        compositionNameSnapshot: item.compositionNameSnapshot,
        compositionPricingModeSnapshot: item.compositionPricingModeSnapshot,
        compositionDisplayModeSnapshot: item.compositionDisplayModeSnapshot,
        compositionDiscountAllocatedCents: item.compositionDiscountAllocatedCents,
      }))));
      formData.set("shippingOptionId", "manual");
      formData.set("shippingPrice", shippingPrice.toString());
      formData.set("manualDiscount", manualDiscount.toString());
      if (manualDiscountMode === "percent") {
        formData.set("manualDiscountBps", String(manualDiscountBps));
      }
      if (resolvedPaymentMethod) {
        formData.set("paymentMethod", resolvedPaymentMethod);
        if (resolvedPaymentMethodOption?.id && Number.isFinite(resolvedPaymentMethodOption.id)) {
          formData.set("paymentMethodId", String(resolvedPaymentMethodOption.id));
        }
        formData.set(
          "paymentMethodLabel",
          resolvedPaymentMethodOption?.label || resolvedPaymentMethod,
        );
      }
      formData.set("notes", notes);

      const result = await createAssistedOrderAction(formData);
      if (result.success && result.data) {
        router.push(`/orders/${result.data.id}`);
        return;
      }

      showError(result.error || "Erro ao criar pedido");
    });
  }

  const handleSubmitOrder = () => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
      showError("Voce pode montar o pedido sem cliente, mas para finalizar ainda e necessario selecionar um cliente.")
      return
    }
    if (paymentMethodsForSelectedCustomer.length === 0) {
      showError("Nenhuma forma de pagamento ativa em Configuracoes > Metodos de Pagamento")
      return
    }
    if (!resolvedPaymentMethod) {
      showError("Selecione uma forma de pagamento para continuar")
      return
    }

    submitOrder()
  };

  const orderDetailsContent = (
    <>
      <Card>
        <CardHeader className={STANDARD_CARD_HEADER_CLASS}>
          <CardTitle className={`flex items-center gap-2 ${STANDARD_CARD_TITLE_CLASS}`}>
            <User className="h-4 w-4" />
            Cliente
          </CardTitle>
          <CardAction>
            <Button onClick={() => setShowNewCustomerDialog(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </CardAction>
          <CardDescription>Selecione um cliente com busca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Combobox
            items={customerComboboxItems.map((item) => item.value)}
            open={customerOpen}
            onOpenChange={setCustomerOpen}
            value={selectedCustomerComboboxValue}
            onInputValueChange={handleCustomerComboboxInputValueChange}
            disabled={isPersistingAssistedCustomer}
            onValueChange={(value) => {
              void handleAssistedCustomerSelection(value)
            }}
          >
            <ComboboxInput
              placeholder="Buscar por nome, CNPJ, contato..."
              className="w-full"
              showClear
              disabled={isPersistingAssistedCustomer}
            />
            <ComboboxContent
              align="start"
              className="z-100"
              onWheel={(e) => e.stopPropagation()}
            >
              {isLoadingCustomers && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Buscando clientes...</div>
              )}
              {!isLoadingCustomers && customerComboboxItems.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
              )}
              <ComboboxList
                className="max-h-80"
                style={{
                  touchAction: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  pointerEvents: 'auto',
                } as React.CSSProperties}
                onWheel={(e) => {
                  const target = e.currentTarget
                  const atTop = target.scrollTop === 0
                  const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight

                  if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
                    return
                  }
                  e.stopPropagation()
                }}
              >
                {customerComboboxItems.map((item) => (
                  <ComboboxItem
                    key={item.rowKey}
                    value={item.value}
                    className="cursor-pointer"
                  >
                    <span className="truncate text-sm">
                      {item.label}
                    </span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={STANDARD_CARD_HEADER_CLASS}>
          <CardTitle className={`flex items-center gap-2 ${STANDARD_CARD_TITLE_CLASS}`}>
            <ShoppingCart className="h-5 w-5" />
            Carrinho (Qtd {cartTotals.totalPieces})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingSelectedCustomerCart ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`cart-skeleton-${index}`} className="flex items-center gap-3 rounded-lg border border-border/60 p-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              ))}
            </div>
          ) : cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum item adicionado
            </p>
          ) : (
            groupedCartItems.map((group) => {
              const isCompositionGroup = group.instanceId !== null
              const groupTotal = group.items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0)
              const groupPieces = group.items.reduce((acc, item) => acc + item.quantity, 0)

              if (!isCompositionGroup) {
                const item = group.items[0]
                return (
                  <div key={group.key} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.color} / {item.size}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUpdateCartQuantity(item.variantId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUpdateCartQuantity(item.variantId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-medium w-20 text-right">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveFromCart(item.variantId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              }

              return (
                <div key={group.key} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                  <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.items.length} itens · Qtd {groupPieces}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateCompositionGroupQuantity(group, -1)}
                          disabled={group.compositionQuantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-6 text-center text-sm font-medium">{group.compositionQuantity}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateCompositionGroupQuantity(group, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(groupTotal)}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveCompositionGroup(group)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 p-2 pl-4">
                    {group.items.map((item) => (
                      <div key={item.cartItemId} className="flex items-center gap-3 rounded-lg bg-background/70 px-3 py-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.color} / {item.size}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">Qtd {item.quantity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={STANDARD_CARD_HEADER_CLASS}>
          <CardTitle className={STANDARD_CARD_TITLE_CLASS}>Valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Frete (R$)</Label>
            <CurrencyInput
              value={shippingPrice}
              min={0}
              className="space-y-0"
              onChange={(value) => {
                console.log('[NEW_ORDER] Frete mudou para:', value)
                shippingDirtyRef.current = true
                setShippingPrice(Number(value || 0))
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Tipo de Desconto Manual</Label>
              <Select
                value={manualDiscountMode}
                onValueChange={(value) => {
                  const nextMode = value === "percent" ? "percent" : "amount"
                  setManualDiscountMode(nextMode)
                  manualDiscountDirtyRef.current = true

                  if (nextMode === "percent") {
                    const baseAmount = getManualDiscountBase(
                      Number(backendCartSnapshot?.subtotal || 0),
                      Number(backendCartSnapshot?.discountAmount || 0),
                    )
                    setManualDiscountBps(deriveManualDiscountBpsFromAmount(manualDiscount, baseAmount))
                    return
                  }

                  const baseAmount = getManualDiscountBase(
                    Number(backendCartSnapshot?.subtotal || 0),
                    Number(backendCartSnapshot?.discountAmount || 0),
                  )
                  setManualDiscount(deriveManualDiscountAmountFromBps(manualDiscountBps, baseAmount))
                }}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentagem (%)</SelectItem>
                  <SelectItem value="amount">Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {manualDiscountMode === "amount" ? (
                <>
                  <Label className="text-sm">Desconto Manual (R$)</Label>
                  <CurrencyInput
                    value={manualDiscount}
                    min={0}
                    max={maxManualDiscount}
                    helperText={`Máximo permitido: ${formatCurrency(maxManualDiscount)}`}
                    className="space-y-0"
                    onChange={handleManualDiscountAmountChange}
                  />
                </>
              ) : (
                <>
                  <Label className="text-sm">Desconto Manual (%)</Label>
                  <PercentageInput
                    value={manualDiscountBps / MAX_MANUAL_DISCOUNT_BPS}
                    min={0}
                    max={100}
                    className="space-y-0"
                    helperText={`Equivale a ${formatCurrency(manualDiscount)} sobre a base atual após descontos automáticos`}
                    onChange={handleManualDiscountPercentChange}
                  />
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Forma de Pagamento</Label>
            {paymentMethodsForSelectedCustomer.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma forma de pagamento ativa em Configuracoes. Ative em Configuracoes &gt; Metodos de Pagamento.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {paymentMethodsForSelectedCustomer.map((method) => {
                  const isActive = resolvedPaymentMethod === method.value
                  return (
                    <Button
                      key={method.value}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const nextValue = method.value
                        if (nextValue === resolvedPaymentMethod) return
                        paymentMethodDirtyRef.current = true
                        setPaymentMethod(nextValue)
                        startTransition(async () => {
                          await persistPaymentInCustomerCart(nextValue)
                        })
                      }}
                    >
                      {method.label}
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(cartTotals.subtotal)}</span>
            </div>
            {cartTotals.paymentMethodDiscountApplied > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto pagamento</span>
                <span>-{formatCurrency(cartTotals.paymentMethodDiscountApplied)}</span>
              </div>
            )}
            {cartTotals.manualDiscountApplied > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(cartTotals.manualDiscountApplied)}</span>
              </div>
            )}
            {cartTotals.shippingAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{formatCurrency(cartTotals.shippingAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatCurrency(cartTotals.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={STANDARD_CARD_HEADER_CLASS}>
          <CardTitle className={STANDARD_CARD_TITLE_CLASS}>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observações sobre o pedido..."
            value={notes}
            onChange={(e) => {
              notesDirtyRef.current = true
              setNotes(e.target.value)
            }}
            onBlur={(e) => {
              const nextValue = e.target.value
              startTransition(async () => {
                await persistNotesInCustomerCart(nextValue)
              })
            }}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleClearCart}
          disabled={isPending || cart.length === 0}
          className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-default disabled:opacity-40"
        >
          Limpar carrinho
        </button>
      </div>

      <div className="hidden lg:sticky lg:bottom-0 lg:z-20 lg:block lg:border-t lg:bg-background lg:pt-3">
        <Button
          onClick={handleSubmitOrder}
          disabled={isPending || cart.length === 0}
          className="w-full"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Criar Pedido
        </Button>
      </div>
    </>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-32 lg:pb-6 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:items-start">
          <div className="space-y-4 lg:col-span-2 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
            <Card className="flex min-h-[calc(100dvh-10rem)] flex-col lg:h-full">
              <CardHeader className={STANDARD_CARD_HEADER_CLASS}>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-8 w-8 shrink-0"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle className={`flex items-center gap-2 ${STANDARD_CARD_TITLE_CLASS}`}>
                    <Package className="h-5 w-5" />
                    Catálogo
                  </CardTitle>
                </div>
                <CardDescription className="pl-10">Selecione produtos ou composições para o fluxo de compra</CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
                <Tabs value={catalogTab} onValueChange={(value) => setCatalogTab(value as "products" | "compositions")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="products" className="cursor-pointer">Produtos</TabsTrigger>
                    <TabsTrigger value="compositions" className="cursor-pointer">Composições</TabsTrigger>
                  </TabsList>
                </Tabs>

                {catalogTab === "products" ? (
                  <AssistedOrderProductCatalog
                    className="min-h-0 flex-1"
                    disabled={isPending}
                    addButtonLabel="Adicionar ao Pedido"
                    matrixDialogClassName="flex h-screen max-h-screen w-screen! max-w-screen! flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:w-[70vw]! sm:max-w-[70vw]!"
                    onAddVariants={handleCatalogAddVariants}
                    onBarcodeScan={handleCatalogBarcodeScan}
                  />
                ) : (
                  <>
                    <div className="relative shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar composições"
                          value={compositionSearch}
                          onChange={(e) => setCompositionSearch(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        {compositionSearch ? (
                          <button
                            type="button"
                            onClick={() => setCompositionSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Limpar busca"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div
                      ref={compositionsScrollContainerRef}
                      className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto content-start items-start auto-rows-max sm:grid-cols-3"
                    >
                      {isLoadingCompositions ? (
                    <>
                      {Array.from({ length: 9 }).map((_, index) => (
                        <div key={`composition-skeleton-${index}`} className="rounded-lg border border-border p-3">
                          <Skeleton className="mb-2 aspect-square w-full rounded-md" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="mt-2 h-3 w-2/5" />
                          <Skeleton className="mt-2 h-4 w-1/3" />
                        </div>
                      ))}
                    </>
                  ) : filteredCompositions.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma composição encontrada</p>
                    </div>
                  ) : (
                    <>
                      {filteredCompositions.map((composition) => {
                        const compositionImage = parseCsvUrls(composition.images_url)[0]
                        return (
                          <button
                            key={composition.id}
                            type="button"
                            onClick={() => handleAddCompositionToCart(composition)}
                            disabled={isPending}
                            className="p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="aspect-square rounded-md bg-muted mb-2 overflow-hidden">
                              {compositionImage ? (
                                <CloudflareImage
                                  src={compositionImage}
                                  cloudflare={{ width: 300, height: 300, fit: "cover", dpr: 2 }}
                                  alt={composition.name}
                                  width={300}
                                  height={300}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <p className="font-medium text-sm truncate">{composition.name}</p>
                            <p className="text-xs text-muted-foreground">{composition.code}</p>
                            <p className="text-sm font-semibold mt-1">
                              {formatCurrency((composition.total_composition_cents || 0) / 100)}
                            </p>
                          </button>
                        )
                      })}

                      {isLoadingMoreCompositions && (
                        <div className="col-span-full grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <div key={`composition-more-skeleton-${index}`} className="rounded-lg border border-border p-3">
                              <Skeleton className="mb-2 aspect-square w-full rounded-md" />
                              <Skeleton className="h-4 w-5/6" />
                              <Skeleton className="mt-2 h-3 w-2/5" />
                              <Skeleton className="mt-2 h-4 w-1/3" />
                            </div>
                          ))}
                        </div>
                      )}

                      {hasMoreCompositions && (
                        <div ref={compositionsLoadMoreRef} className="col-span-full h-2" aria-hidden="true" />
                      )}
                    </>
                  )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="hidden space-y-4 lg:sticky lg:top-6 lg:flex lg:flex-col lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
            {orderDetailsContent}
          </div>
        </div>



      <Dialog
        open={Boolean(compositionWizard)}
        onOpenChange={(open) => {
          if (!open) {
            closeCompositionWizard()
          }
        }}
      >
        <DialogContent className="flex h-screen max-h-screen w-screen! max-w-screen! flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:w-[70vw]! sm:max-w-[70vw]!">
          {compositionWizard && currentCompositionWizardTemplate ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle className="text-base font-semibold">
                  {compositionWizardMode === 'edit' ? 'Editar composição' : 'Configurar composição'}
                </DialogTitle>
                <DialogDescription>
                  {compositionWizard.compositionName} · Item {compositionWizardStep + 1} de {compositionWizard.templates.length}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4 pb-32 sm:pb-4">
                {compositionWizardProduct ? (
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-md bg-muted overflow-hidden">
                      {compositionWizardProduct.images?.[0] ? (
                        <CloudflareImage
                          src={compositionWizardProduct.images[0]}
                          cloudflare={{ width: 64, height: 64, fit: "cover", dpr: 2 }}
                          alt={compositionWizardProduct.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{compositionWizardProduct.name}</p>
                      <p className="text-sm text-muted-foreground">{compositionWizardProduct.sku || '-'}</p>
                    </div>
                  </div>
                ) : null}

                {isLoadingCompositionWizardVariants ? (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                    <div className="divide-y">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`composition-variant-skeleton-${index}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.5fr)_80px_110px_112px] md:items-center sm:px-4"
                        >
                          <div className="col-span-2 min-w-0 space-y-2 md:col-span-1">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="h-3 w-36" />
                          </div>
                          <Skeleton className="hidden h-4 w-10 md:block" />
                          <Skeleton className="h-4 w-20" />
                          <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1 md:justify-center">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-14 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : compositionWizardVariants.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma variante disponível para este item da composição.
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                    <div className="sticky top-0 z-10 hidden gap-3 border-b bg-muted/95 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur md:grid md:grid-cols-[minmax(0,1.5fr)_80px_110px_112px] sm:px-4">
                      <div className="flex items-center gap-1">
                        <span>Variante</span>
                        <button
                          type="button"
                          onClick={toggleAllCompositionVariantColorGroups}
                          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                          title={areAllCompositionVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                          aria-label={areAllCompositionVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${areAllCompositionVariantColorsCollapsed ? "-rotate-90" : "rotate-0"}`}
                          />
                        </button>
                      </div>
                      <span>Estoque</span>
                      <span>Preço</span>
                      <span className="text-center">Quantidade</span>
                    </div>

                    <div>
                      {compositionWizardVariantColorEntries.map(([color, variants]) => {
                        const colorData = compositionWizardProduct?.colors?.find((c) => c.name === color)
                        const colorGroupKey = `${compositionWizardProduct?.id || ''}:${color}`
                        const isCollapsed = Boolean(compositionCollapsedVariantColors[colorGroupKey])

                        return (
                          <div key={color} className="border-b last:border-b-0">
                            <button
                              type="button"
                              className="sticky top-0 z-5 flex w-full items-center gap-2 border-b bg-muted/95 px-3 py-2 text-left text-sm font-medium backdrop-blur md:top-9 sm:px-4"
                              onClick={() =>
                                setCompositionCollapsedVariantColors((prev) => ({
                                  ...prev,
                                  [colorGroupKey]: !isCollapsed,
                                }))
                              }
                            >
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                              />
                              {colorData?.hex && (
                                <div
                                  className="h-4 w-4 shrink-0 rounded-full border"
                                  style={{ backgroundColor: colorData.hex }}
                                />
                              )}
                              <span>{color}</span>
                              <Badge variant="outline" className="ml-1">
                                {variants.length}
                              </Badge>
                            </button>

                            {!isCollapsed && (
                              <div className="divide-y">
                                {variants.map((variant) => {
                                  const baseVariantPrice =
                                    typeof variant.priceOverride === 'number'
                                      ? variant.priceOverride
                                      : compositionWizardProduct?.basePrice || 0
                                  const variantPrice = applyCompositionItemDiscountToUnitPrice(
                                    baseVariantPrice,
                                    currentCompositionWizardTemplate.item_discount_mode,
                                    currentCompositionWizardTemplate.item_discount_value,
                                  )
                                  const variantPricePresentation = getCompositionItemDiscountPresentation(
                                    baseVariantPrice,
                                    currentCompositionWizardTemplate.item_discount_mode,
                                    currentCompositionWizardTemplate.item_discount_value,
                                  )

                                  const variantQuantity = getCompositionVariantQuantity(variant)

                                  return (
                                    <div
                                      key={variant.id}
                                      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.5fr)_80px_110px_112px] md:items-center sm:px-4 ${
                                        selectedCompositionVariantId === String(variant.id) ? 'bg-primary/5' : ''
                                      }`}
                                    >
                                      <div className="col-span-2 min-w-0 md:col-span-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="shrink-0">
                                            {variant.size || 'Único'}
                                          </Badge>
                                          <span className="truncate text-xs text-muted-foreground">
                                            {compositionWizardProduct?.name}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          SKU: {variant.variantSku || '-'}
                                        </div>
                                      </div>

                                      <div className="hidden text-sm text-muted-foreground md:flex md:items-center md:gap-1 md:order-0">
                                        {variant.stock}
                                      </div>

                                      <div className="order-4 flex items-center justify-between gap-3 text-sm font-medium md:block md:order-0">
                                        <div className="flex flex-col md:items-end">
                                          <span className="md:hidden">{formatCurrency(variantPrice)}</span>
                                          <span className="hidden md:inline">{formatCurrency(variantPrice)}</span>
                                          {variantPricePresentation.discountAmount > 0 && variantPricePresentation.discountLabel ? (
                                            <span className="text-[11px] text-muted-foreground">
                                              <span className="line-through">
                                                {formatCurrency(variantPricePresentation.originalPrice)}
                                              </span>{' '}
                                              <span className="font-medium text-emerald-700">
                                                {variantPricePresentation.discountLabel}
                                              </span>
                                            </span>
                                          ) : null}
                                        </div>
                                        <span className="text-sm text-muted-foreground md:hidden">
                                          Estoque: {variant.stock}
                                        </span>
                                      </div>

                                      <div className="order-5 col-span-2 md:order-0 md:col-span-1 md:shrink-0 md:justify-self-center md:self-auto">
                                        <div className="flex items-center justify-end gap-1 md:justify-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => decrementCompositionVariantQuantity(variant)}
                                            disabled={variant.stock === 0 || variantQuantity <= 0}
                                          >
                                            <Minus className="h-3.5 w-3.5" />
                                          </Button>

                                          <IntegerInput
                                            value={variantQuantity}
                                            onChange={(value) => setCompositionVariantQuantity(variant, Number(value || 0))}
                                            min={0}
                                            max={variant.stock}
                                            disabled={variant.stock === 0}
                                            className="w-14 space-y-0"
                                            inputClassName="h-8 text-center text-sm"
                                          />

                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => incrementCompositionVariantQuantity(variant)}
                                            disabled={variant.stock === 0 || variantQuantity >= variant.stock}
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:static sm:shrink-0 sm:px-6 sm:py-4 sm:pb-4">
                <Button
                  type="button"
                  onClick={handleConfirmCompositionWizardStep}
                  className="w-full"
                  disabled={isPending || isLoadingCompositionWizardVariants || compositionWizardVariants.length === 0}
                >
                  {compositionWizardStep + 1 < compositionWizard.templates.length
                    ? 'Próximo item'
                    : compositionWizardMode === 'edit'
                      ? 'Salvar alterações'
                      : 'Concluir composição'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {isMobileOrderPanelOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel do pedido"
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setIsMobileOrderPanelOpen(false)}
          />
          <div className="fixed inset-0 z-40 overflow-y-auto bg-background pb-28 lg:hidden">
            <div className="min-h-full w-full space-y-4 bg-background p-4 pb-28">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Detalhes do pedido</p>
                  <p className="text-xs text-muted-foreground">Cliente, carrinho, valores e observações</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileOrderPanelOpen(false)}
                >
                  Fechar
                </Button>
              </div>
              {orderDetailsContent}
            </div>
            <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 backdrop-blur">
              <Button
                onClick={handleSubmitOrder}
                disabled={isPending || cart.length === 0}
                className="h-14 w-full"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Criar Pedido
              </Button>
            </div>
          </div>
        </>
      )}

      <div className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 backdrop-blur lg:hidden ${isMobileOrderPanelOpen ? "hidden" : "block"}`}>
        <Button
          type="button"
          variant="default"
          className="h-14 w-full justify-between px-4"
          onClick={() => setIsMobileOrderPanelOpen((prev) => !prev)}
        >
          <span className="text-left">
            <span className="block text-xs font-medium opacity-80">Ver pedido</span>
            <span className="block text-sm font-semibold">{cartTotals.totalPieces} {cartTotals.totalPieces === 1 ? "item" : "itens"}</span>
          </span>
          <span className="flex items-center gap-2 text-base font-semibold">
            {formatCurrency(cartTotals.total)}
            <ChevronUp className="h-4 w-4 opacity-80" />
          </span>
        </Button>
      </div>

      {showNewCustomerDialog && (
        <NewCustomerDialog
          open={showNewCustomerDialog}
          onOpenChange={setShowNewCustomerDialog}
          priceTables={priceTables}
          sellers={sellers}
          onCreated={async (id) => {
            const updatedCustomers = await loadCustomers();
            const created = updatedCustomers.find((customer) => customer.id === id) || null;
            if (created) {
              setCustomerSearch(created.tradeName || created.companyName || "");
              setCustomerOpen(false)
              void handleAssistedCustomerSelection(String(created.id))
            }
          }}
        />
      )}

    </div>
  );
}
