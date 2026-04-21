"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Building2,
  Package,
  ShoppingCart,
  Loader2,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomersAction } from "@/lib/actions/customers";
import { getStoreProductsAction, getStoreProductWithVariantsAction } from "@/lib/actions/products";
import { createAssistedOrderAction } from "@/lib/actions/orders";
import { getCorePaymentMethodsAction } from "@/lib/actions/settings";
import {
  getAdminCustomerCartAction,
  addToAdminCustomerCartBatchAction,
  updateAdminCustomerCartItemAction,
  removeAdminCustomerCartItemAction,
  updateAdminCustomerCartShippingAction,
  updateAdminCustomerCartPaymentAction,
  updateAdminCustomerCartNotesAction,
  updateAdminCustomerCartManualDiscountAction,
  type CartWithCalculation,
} from "@/lib/actions/cart";
import { NewCustomerDialog } from "@/components/admin/new-customer-dialog";
import IntegerInput from "@/components/form/IntegerInput";
import CurrencyInput from "@/components/form/CurrencyInput";
import { useCommercialData } from "@/hooks/use-commercial-data";
import { formatCurrency } from "@/lib/pricing";
import type { Customer, Product, ProductVariant, PaymentMethod } from "@/lib/types";

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
}

type Step = 1 | 2 | 3;

const STEPS = [
  { step: 1, title: "Cliente", description: "Selecione ou cadastre" },
  { step: 2, title: "Produtos", description: "Adicione itens ao pedido" },
  { step: 3, title: "Resumo", description: "Revise e confirme" },
] as const;

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "FATURADO", label: "Faturado" },
  { value: "CARTAO_EXTERNO", label: "Cartao (externo)" },
];

function isPaymentMethodValue(value: string): value is PaymentMethod {
  return ["PIX", "BOLETO", "FATURADO", "CARTAO_EXTERNO"].includes(value)
}

export default function NewOrderPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  function showError(message: string) {
    setError(message)
    toast.error(message)
  }

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingSelectedCustomerCart, setIsLoadingSelectedCustomerCart] = useState(false);
  const { priceTables, sellers } = useCommercialData();

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const [collapsedVariantColors, setCollapsedVariantColors] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<CartItem[]>([]);

  const [shippingPrice, setShippingPrice] = useState<number>(0);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState(PAYMENT_METHODS);
  const [notes, setNotes] = useState("");
  const hydratedShippingRef = useRef<number | null>(null)
  const hydratedManualDiscountRef = useRef<number | null>(null)
  const hydratedNotesRef = useRef<string | null>(null)
  const hydratedPaymentMethodRef = useRef<PaymentMethod | null>(null)
  const shippingDirtyRef = useRef(false)
  const manualDiscountDirtyRef = useRef(false)
  const notesDirtyRef = useRef(false)
  const paymentMethodDirtyRef = useRef(false)

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadPaymentMethodsFromSettings()
  }, [])

  const paymentMethodsForSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return availablePaymentMethods

    const allowed = availablePaymentMethods.filter((method) =>
      selectedCustomer.paymentTerms.includes(method.value)
    )

    return allowed.length > 0 ? allowed : availablePaymentMethods
  }, [availablePaymentMethods, selectedCustomer])

  useEffect(() => {
    if (!selectedCustomer) return;
    const allowedByCustomer = paymentMethodsForSelectedCustomer.map((method) => method.value)

    if (allowedByCustomer.includes(paymentMethod)) return;

    const fallback = allowedByCustomer[0] || availablePaymentMethods[0]?.value;
    if (fallback) {
      setPaymentMethod(fallback);
    }
  }, [selectedCustomer, paymentMethod, availablePaymentMethods, paymentMethodsForSelectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCart([])
      setShippingPrice(0)
      setManualDiscount(0)
      setNotes("")
      hydratedShippingRef.current = null
      hydratedManualDiscountRef.current = null
      hydratedNotesRef.current = null
      hydratedPaymentMethodRef.current = null
      shippingDirtyRef.current = false
      manualDiscountDirtyRef.current = false
      notesDirtyRef.current = false
      paymentMethodDirtyRef.current = false
      return
    }
    void loadSelectedCustomerCart(selectedCustomer.id)
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (!selectedCustomer || isLoadingSelectedCustomerCart) return
    if (!shippingDirtyRef.current) return

    if (
      hydratedShippingRef.current !== null &&
      Math.abs(shippingPrice - hydratedShippingRef.current) < 0.0001
    ) {
      hydratedShippingRef.current = null
      shippingDirtyRef.current = false
      return
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await persistShippingInCustomerCart(shippingPrice)
      })
    }, 500)

    return () => clearTimeout(timeout)
  }, [shippingPrice, selectedCustomer?.id, isLoadingSelectedCustomerCart])

  useEffect(() => {
    if (!selectedCustomer || isLoadingSelectedCustomerCart) return
    if (!manualDiscountDirtyRef.current) return

    if (
      hydratedManualDiscountRef.current !== null &&
      Math.abs(manualDiscount - hydratedManualDiscountRef.current) < 0.0001
    ) {
      hydratedManualDiscountRef.current = null
      manualDiscountDirtyRef.current = false
      return
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await persistManualDiscountInCustomerCart(manualDiscount)
      })
    }, 500)

    return () => clearTimeout(timeout)
  }, [manualDiscount, selectedCustomer?.id, isLoadingSelectedCustomerCart])

  async function loadCustomers(): Promise<Customer[]> {
    setIsLoadingCustomers(true);
    const result = await getCustomersAction({ status: "APPROVED" });
    if (result.success && result.data) {
      setCustomers(result.data);
      setIsLoadingCustomers(false);
      return result.data;
    }
    setIsLoadingCustomers(false);
    return [];
  }

  async function loadProducts() {
    setIsLoadingProducts(true);
    const result = await getStoreProductsAction({ isActive: true });
    if (result.success && result.data) {
      setProducts(result.data);
    }
    setIsLoadingProducts(false);
  }

  async function loadPaymentMethodsFromSettings() {
    const result = await getCorePaymentMethodsAction()
    if (result.success && result.data && result.data.length > 0) {
      setAvailablePaymentMethods(result.data)
      return
    }

    setAvailablePaymentMethods(PAYMENT_METHODS)
  }

  function mapBackendCartToOrderCart(cartData: CartWithCalculation): CartItem[] {
    return (cartData.items || []).map((item) => {
      const rawItem = item as unknown as {
        unitPrice?: number
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
        cartItemId: String(item.id || ""),
        productId: String(item.productId || product?.id || ""),
        variantId: String(item.variantId || variant?.id || ""),
        productName: String(product?.name || "Produto"),
        sku: String(variant?.variantSku || ""),
        color: String(variant?.color || ""),
        size: String(variant?.size || ""),
        quantity: Number(item.quantity || 0),
        unitPrice,
        stock: Number(variant?.stock || 999999),
        image: product?.images?.[0],
      }
    })
  }

  async function loadSelectedCustomerCart(customerId: string) {
    setIsLoadingSelectedCustomerCart(true)
    const result = await getAdminCustomerCartAction(customerId)

    if (!result.success || !result.data) {
      setCart([])
      showError(result.error || "Erro ao carregar carrinho do cliente")
      setIsLoadingSelectedCustomerCart(false)
      return
    }

    setCart(mapBackendCartToOrderCart(result.data))
    const loadedShipping = Number(result.data.shippingAmount || 0)
    const loadedManualDiscount = Number(result.data.manualDiscountAmount || 0)
    const loadedNotes = String(result.data.checkoutNotes || "")
    hydratedShippingRef.current = loadedShipping
    hydratedManualDiscountRef.current = loadedManualDiscount
    hydratedNotesRef.current = loadedNotes
    shippingDirtyRef.current = false
    manualDiscountDirtyRef.current = false
    notesDirtyRef.current = false
    setShippingPrice(loadedShipping)
    setManualDiscount(loadedManualDiscount)
    setNotes(loadedNotes)
    if (isPaymentMethodValue(String(result.data.paymentOptionCode || ""))) {
      const loadedPaymentMethod = String(result.data.paymentOptionCode) as PaymentMethod
      hydratedPaymentMethodRef.current = loadedPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(loadedPaymentMethod)
    } else {
      hydratedPaymentMethodRef.current = paymentMethod
      paymentMethodDirtyRef.current = false
    }
    setError(null)
    setIsLoadingSelectedCustomerCart(false)
  }

  async function persistShippingInCustomerCart(nextShippingPrice: number) {
    if (!selectedCustomer) return
    if (
      hydratedShippingRef.current !== null &&
      Math.abs(nextShippingPrice - hydratedShippingRef.current) < 0.0001
    ) {
      shippingDirtyRef.current = false
      return
    }

    const result = await updateAdminCustomerCartShippingAction(selectedCustomer.id, {
      code: "manual",
      name: "Frete Manual",
      priceCents: Math.max(0, Math.round(nextShippingPrice * 100)),
      deliveryDays: 0,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir frete no carrinho do cliente")
      return
    }

    setCart(mapBackendCartToOrderCart(result.data))
    const persistedShipping = Number(result.data.shippingAmount || 0)
    hydratedShippingRef.current = persistedShipping
    shippingDirtyRef.current = false
    setShippingPrice(persistedShipping)
    setError(null)
  }

  async function persistPaymentInCustomerCart(nextPaymentMethod: PaymentMethod) {
    if (!selectedCustomer) return
    if (!paymentMethodDirtyRef.current) return
    if (hydratedPaymentMethodRef.current === nextPaymentMethod) {
      paymentMethodDirtyRef.current = false
      return
    }

    const paymentLabel =
      availablePaymentMethods.find((method) => method.value === nextPaymentMethod)?.label || nextPaymentMethod

    const result = await updateAdminCustomerCartPaymentAction(selectedCustomer.id, {
      code: nextPaymentMethod,
      name: paymentLabel,
      paymentType: nextPaymentMethod,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir forma de pagamento no carrinho do cliente")
      return
    }

    setCart(mapBackendCartToOrderCart(result.data))
    if (isPaymentMethodValue(String(result.data.paymentOptionCode || ""))) {
      const persistedPaymentMethod = String(result.data.paymentOptionCode) as PaymentMethod
      hydratedPaymentMethodRef.current = persistedPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(persistedPaymentMethod)
    } else {
      hydratedPaymentMethodRef.current = nextPaymentMethod
      paymentMethodDirtyRef.current = false
      setPaymentMethod(nextPaymentMethod)
    }
    setError(null)
  }

  async function persistNotesInCustomerCart(nextNotes: string) {
    if (!selectedCustomer) return
    if (!notesDirtyRef.current) return

    const normalizedNotes = nextNotes.trim()
    if ((hydratedNotesRef.current || "") === normalizedNotes) {
      notesDirtyRef.current = false
      return
    }

    const result = await updateAdminCustomerCartNotesAction(selectedCustomer.id, {
      notes: normalizedNotes,
    })

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir observações no carrinho do cliente")
      return
    }

    setCart(mapBackendCartToOrderCart(result.data))
    const persistedNotes = String(result.data.checkoutNotes || "")
    hydratedNotesRef.current = persistedNotes
    notesDirtyRef.current = false
    setNotes(persistedNotes)
    setError(null)
  }

  async function persistManualDiscountInCustomerCart(nextManualDiscount: number) {
    if (!selectedCustomer) return

    const normalizedManualDiscount = Math.min(
      maxManualDiscount,
      Math.max(0, Number(nextManualDiscount) || 0)
    )

    if (Math.abs(normalizedManualDiscount - nextManualDiscount) > 0.0001) {
      setManualDiscount(normalizedManualDiscount)
    }

    const result = await updateAdminCustomerCartManualDiscountAction(
      selectedCustomer.id,
      normalizedManualDiscount,
    )

    if (!result.success || !result.data) {
      showError(result.error || "Erro ao persistir desconto manual no carrinho do cliente")
      return
    }

    setCart(mapBackendCartToOrderCart(result.data))
    const persistedManualDiscount = Number(result.data.manualDiscountAmount || 0)
    hydratedManualDiscountRef.current = persistedManualDiscount
    manualDiscountDirtyRef.current = false
    setManualDiscount(persistedManualDiscount)
    setError(null)
  }

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter((c) =>
      c.companyName?.toLowerCase().includes(search) ||
      c.tradeName?.toLowerCase().includes(search) ||
      c.cnpj?.includes(search) ||
      c.contactName?.toLowerCase().includes(search)
    );
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setVariantQuantities({});
    setCollapsedVariantColors({});

    const result = await getStoreProductWithVariantsAction(product.id);
    if (result.success && result.data) {
      setProductVariants(result.data.variants || []);
    } else {
      setProductVariants([]);
    }
  };

  const variantsByColor = useMemo(() => {
    const grouped: Record<string, ProductVariant[]> = {};
    productVariants.forEach((v) => {
      if (!grouped[v.color]) {
        grouped[v.color] = [];
      }
      grouped[v.color].push(v);
    });
    return grouped;
  }, [productVariants]);

  const variantColorEntries = useMemo(() => {
    return Object.entries(variantsByColor)
      .sort(([colorA], [colorB]) => colorA.localeCompare(colorB))
      .map(([color, variants]) => [
        color,
        [...variants].sort((a, b) => String(a.size || "").localeCompare(String(b.size || ""))),
      ] as const)
  }, [variantsByColor])

  const allVariantColorGroupKeys = useMemo(() => {
    if (!selectedProduct) return []
    return variantColorEntries.map(([color]) => `${selectedProduct.id}:${color}`)
  }, [variantColorEntries, selectedProduct])

  const areAllVariantColorsCollapsed = useMemo(() => {
    return (
      allVariantColorGroupKeys.length > 0 &&
      allVariantColorGroupKeys.every((key) => Boolean(collapsedVariantColors[key]))
    )
  }, [allVariantColorGroupKeys, collapsedVariantColors])

  function toggleAllVariantColorGroups() {
    if (!selectedProduct || allVariantColorGroupKeys.length === 0) return

    const shouldCollapseAll = !areAllVariantColorsCollapsed

    setCollapsedVariantColors((prev) => {
      const next = { ...prev }
      for (const key of allVariantColorGroupKeys) {
        next[key] = shouldCollapseAll
      }
      return next
    })
  }

  const handleAddToCart = () => {
    if (!selectedProduct || !selectedCustomer) return;

    const items = Object.entries(variantQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }))

    if (items.length === 0) return

    startTransition(async () => {
      const result = await addToAdminCustomerCartBatchAction(selectedCustomer.id, items)
      if (!result.success || !result.data) {
        showError(result.error || "Erro ao adicionar itens no carrinho do cliente")
        return
      }

      setCart(mapBackendCartToOrderCart(result.data))
      setError(null)
      setVariantQuantities({})
    })
  };

  const handleRemoveFromCart = (variantId: string) => {
    if (!selectedCustomer) return
    const target = cart.find((item) => item.variantId === variantId)
    if (!target?.cartItemId) return

    startTransition(async () => {
      const result = await removeAdminCustomerCartItemAction(selectedCustomer.id, target.cartItemId)
      if (!result.success || !result.data) {
        showError(result.error || "Erro ao remover item do carrinho do cliente")
        return
      }

      setCart(mapBackendCartToOrderCart(result.data))
      setError(null)
    })
  };

  const handleUpdateCartQuantity = (variantId: string, delta: number) => {
    if (!selectedCustomer) return
    const target = cart.find((item) => item.variantId === variantId)
    if (!target?.cartItemId) return

    const newQty = Math.max(1, Math.min(target.stock, target.quantity + delta))

    startTransition(async () => {
      const result = await updateAdminCustomerCartItemAction(
        selectedCustomer.id,
        target.cartItemId,
        newQty,
      )
      if (!result.success || !result.data) {
        showError(result.error || "Erro ao atualizar item do carrinho do cliente")
        return
      }

      setCart(mapBackendCartToOrderCart(result.data))
      setError(null)
    })
  };

  const setVariantQuantity = (variant: ProductVariant, value: number) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [variant.id]: Math.min(variant.stock, Math.max(0, Math.trunc(Number(value) || 0))),
    }))
  }

  const incrementVariantQuantity = (variant: ProductVariant) => {
    const currentQty = Number(variantQuantities[variant.id] || 0)
    setVariantQuantity(variant, currentQty + 1)
  }

  const decrementVariantQuantity = (variant: ProductVariant) => {
    const currentQty = Number(variantQuantities[variant.id] || 0)
    setVariantQuantity(variant, currentQty - 1)
  }

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const totalPieces = cart.reduce((acc, item) => acc + item.quantity, 0);
    const manualDiscountApplied = Math.min(Math.max(0, manualDiscount), Math.max(0, subtotal + shippingPrice));
    const total = Math.max(0, subtotal - manualDiscountApplied + shippingPrice);
    return { subtotal, totalPieces, total, manualDiscountApplied };
  }, [cart, manualDiscount, shippingPrice]);

  const maxManualDiscount = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0)
    return Math.max(0, subtotal + shippingPrice)
  }, [cart, shippingPrice])

  useEffect(() => {
    if (manualDiscount <= maxManualDiscount) return
    manualDiscountDirtyRef.current = true
    setManualDiscount(maxManualDiscount)
  }, [manualDiscount, maxManualDiscount])

  const cartByProductColor = useMemo(() => {
    const grouped: Record<string, {
      productName: string;
      color: string;
      image?: string;
      items: CartItem[];
      total: number;
    }> = {};

    cart.forEach((item) => {
      const key = `${item.productId}-${item.color}`;
      if (!grouped[key]) {
        grouped[key] = {
          productName: item.productName,
          color: item.color,
          image: item.image,
          items: [],
          total: 0,
        };
      }
      grouped[key].items.push(item);
      grouped[key].total += item.unitPrice * item.quantity;
    });

    return grouped;
  }, [cart]);

  const handleSubmitOrder = async () => {
    setError(null);
    if (!selectedCustomer || cart.length === 0) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", selectedCustomer.id);
      formData.set("items", JSON.stringify(cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }))));
      formData.set("shippingOptionId", "manual");
      formData.set("shippingPrice", shippingPrice.toString());
      formData.set("manualDiscount", manualDiscount.toString());
      formData.set("paymentMethod", paymentMethod);
      formData.set("notes", notes);

      const result = await createAssistedOrderAction(formData);
      if (result.success && result.data) {
        router.push(`/orders/${result.data.id}`);
        return;
      }

      showError(result.error || "Erro ao criar pedido");
    });
  };

  const canGoNext = () => {
    if (currentStep === 1) return !!selectedCustomer;
    if (currentStep === 2) return cart.length > 0;
    return true;
  };

  const goToStep = (step: Step) => {
    if (step < currentStep || canGoNext()) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Novo Pedido</h1>
          <p className="text-sm text-muted-foreground">Crie um pedido para um cliente</p>
        </div>
      </div>

      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {STEPS.map((step, index) => (
          <div key={step.step} className="flex items-center">
            <button
              onClick={() => goToStep(step.step as Step)}
              className={`flex items-center gap-2 ${
                currentStep === step.step
                  ? "text-primary"
                  : currentStep > step.step
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                currentStep === step.step
                  ? "border-primary bg-primary text-primary-foreground"
                  : currentStep > step.step
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-muted-foreground"
              }`}>
                {currentStep > step.step ? <Check className="h-4 w-4" /> : step.step}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-12 lg:w-24 h-0.5 mx-2 ${
                currentStep > step.step ? "bg-green-600" : "bg-muted"
              }`} />
            )}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Selecionar Cliente
                  </CardTitle>
                  <CardDescription>Escolha um cliente existente ou cadastre um novo</CardDescription>
                </div>
                <Button onClick={() => setShowNewCustomerDialog(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CNPJ ou contato..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isLoadingCustomers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{customer.tradeName || customer.companyName}</p>
                          <p className="text-sm text-muted-foreground truncate">{customer.companyName}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">{customer.cnpj}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm">{customer.city}/{customer.state}</p>
                          <p className="text-xs text-muted-foreground">{customer.contactName}</p>
                        </div>
                        {selectedCustomer?.id === customer.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {selectedCustomer && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{selectedCustomer.tradeName || selectedCustomer.companyName}</p>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.cnpj}</p>
                  </div>
                  <Button onClick={() => setCurrentStep(2)}>
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produtos
                </CardTitle>
                <CardDescription>Selecione os produtos e quantidades</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {!selectedProduct ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
                    {isLoadingProducts ? (
                      <div className="col-span-full flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum produto encontrado</p>
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => void handleSelectProduct(product)}
                          className="p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="aspect-square rounded-md bg-muted mb-2 overflow-hidden">
                            {product.images?.[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                          <p className="text-sm font-semibold mt-1">{formatCurrency(product.basePrice)}</p>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-md bg-muted overflow-hidden">
                          {selectedProduct.images?.[0] ? (
                            <img
                              src={selectedProduct.images[0]}
                              alt={selectedProduct.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{selectedProduct.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedProduct.sku}</p>
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => setSelectedProduct(null)}>
                        Voltar
                      </Button>
                    </div>

                    <Separator />

                    <div className="max-h-100 overflow-y-auto rounded-md border">
                      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.5fr)_80px_110px_112px] gap-3 border-b bg-muted/95 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur sm:px-4">
                        <div className="flex items-center gap-1">
                          <span>Variante</span>
                          <button
                            type="button"
                            onClick={toggleAllVariantColorGroups}
                            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                            title={areAllVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                            aria-label={areAllVariantColorsCollapsed ? "Expandir tudo" : "Recolher tudo"}
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${areAllVariantColorsCollapsed ? "-rotate-90" : "rotate-0"}`}
                            />
                          </button>
                        </div>
                        <span>Estoque</span>
                        <span>Preço</span>
                        <span className="text-center">Quantidade</span>
                      </div>
                      <div>
                        {variantColorEntries.map(([color, variants]) => {
                          const colorData = selectedProduct.colors?.find((c) => c.name === color)
                          const colorGroupKey = `${selectedProduct.id}:${color}`
                          const isCollapsed = Boolean(collapsedVariantColors[colorGroupKey])

                          return (
                            <div key={color} className="border-b last:border-b-0">
                              <button
                                type="button"
                                className="sticky top-9 z-5 flex w-full items-center gap-2 border-b bg-muted/95 px-3 py-2 text-left text-sm font-medium backdrop-blur sm:px-4"
                                onClick={() =>
                                  setCollapsedVariantColors((prev) => ({
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
                                const variantPrice =
                                  typeof variant.priceOverride === "number"
                                    ? variant.priceOverride
                                    : selectedProduct.basePrice

                                    return (
                                      <div
                                        key={variant.id}
                                        className="grid grid-cols-[minmax(0,1.5fr)_80px_110px_112px] items-center gap-3 px-3 py-3 sm:px-4"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="shrink-0">
                                              {variant.size || "Único"}
                                            </Badge>
                                            <span className="truncate text-xs text-muted-foreground">
                                              {selectedProduct.name}
                                            </span>
                                          </div>
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            SKU: {variant.variantSku || "-"}
                                          </div>
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                          {variant.stock}
                                        </div>

                                        <div className="text-sm font-medium">
                                          {formatCurrency(variantPrice)}
                                        </div>

                                        <div className="shrink-0 justify-self-center">
                                          <div className="flex items-center gap-1">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => decrementVariantQuantity(variant)}
                                              disabled={variant.stock === 0 || (variantQuantities[variant.id] || 0) <= 0}
                                            >
                                              <Minus className="h-3.5 w-3.5" />
                                            </Button>

                                            <IntegerInput
                                              value={variantQuantities[variant.id] || 0}
                                              onChange={(value) => setVariantQuantity(variant, Number(value || 0))}
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
                                              onClick={() => incrementVariantQuantity(variant)}
                                              disabled={
                                                variant.stock === 0 ||
                                                (variantQuantities[variant.id] || 0) >= variant.stock
                                              }
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

                    <Button
                      onClick={handleAddToCart}
                      className="w-full"
                      disabled={Object.values(variantQuantities).every((q) => q === 0)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar ao Pedido
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-5 w-5" />
                  Carrinho ({cartTotals.totalPieces} pecas)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                {isLoadingSelectedCustomerCart ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item adicionado
                  </p>
                ) : (
                  cart.map((item) => (
                    <div key={item.variantId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
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
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Valores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Frete (R$)</Label>
                  <CurrencyInput
                    value={shippingPrice}
                    min={0}
                    className="space-y-0"
                    onChange={(value) => {
                      shippingDirtyRef.current = true
                      setShippingPrice(Number(value || 0))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Desconto Manual (R$)</Label>
                  <CurrencyInput
                    value={manualDiscount}
                    min={0}
                    max={maxManualDiscount}
                    helperText={`Máximo permitido: ${formatCurrency(maxManualDiscount)}`}
                    className="space-y-0"
                    onChange={(value) => {
                      manualDiscountDirtyRef.current = true
                      const normalized = Math.min(maxManualDiscount, Math.max(0, Number(value || 0)))
                      setManualDiscount(normalized)
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Forma de Pagamento</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => {
                      const nextValue = v as PaymentMethod
                      if (nextValue === paymentMethod) return
                      paymentMethodDirtyRef.current = true
                      setPaymentMethod(nextValue)
                      startTransition(async () => {
                        await persistPaymentInCustomerCart(nextValue)
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodsForSelectedCustomer.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(cartTotals.subtotal)}</span>
                  </div>
                  {cartTotals.manualDiscountApplied > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto</span>
                      <span>-{formatCurrency(cartTotals.manualDiscountApplied)}</span>
                    </div>
                  )}
                  {shippingPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(shippingPrice)}</span>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Observacoes sobre o pedido..."
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

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => setCurrentStep(3)}
                disabled={cart.length === 0}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && selectedCustomer && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-medium">{selectedCustomer.tradeName || selectedCustomer.companyName}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contato</p>
                  <p className="font-medium">{selectedCustomer.contactName}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Endereco</p>
                  <p className="font-medium">{selectedCustomer.street}, {selectedCustomer.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomer.city}/{selectedCustomer.state} - {selectedCustomer.zipCode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produtos do Pedido ({cartTotals.totalPieces} pecas)
              </CardTitle>
              <CardDescription>Itens agrupados por produto e cor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(cartByProductColor).map(([key, group]) => (
                  <div key={key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md bg-muted overflow-hidden shrink-0">
                        {group.image ? (
                          <img src={group.image} alt={group.productName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{group.productName}</p>
                        <p className="text-sm text-muted-foreground">Cor: {group.color}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 text-xs uppercase text-muted-foreground font-medium">Tamanho</th>
                            <th className="text-center py-2 px-4 text-xs uppercase text-muted-foreground font-medium">Qtd</th>
                            <th className="text-right py-2 pl-4 text-xs uppercase text-muted-foreground font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.variantId} className="border-b border-dashed">
                              <td className="py-2 pr-4 font-medium">{item.size}</td>
                              <td className="py-2 px-4 text-center">{item.quantity}</td>
                              <td className="py-2 pl-4 text-right">{formatCurrency(item.unitPrice * item.quantity)}</td>
                            </tr>
                          ))}
                          <tr className="font-semibold">
                            <td className="py-2 pr-4">Total</td>
                            <td className="py-2 px-4 text-center">{group.items.reduce((acc, i) => acc + i.quantity, 0)}</td>
                            <td className="py-2 pl-4 text-right">{formatCurrency(group.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(cartTotals.subtotal)}</span>
                </div>
                {cartTotals.manualDiscountApplied > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto</span>
                    <span>-{formatCurrency(cartTotals.manualDiscountApplied)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span>{formatCurrency(shippingPrice)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotals.total)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma de Pagamento</span>
                  <Badge variant="outline">
                    {availablePaymentMethods.find((m) => m.value === paymentMethod)?.label || paymentMethod}
                  </Badge>
                </div>
                {notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observacoes</p>
                    <p className="text-sm">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={isPending}
              className="flex-1"
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
      )}

      <NewCustomerDialog
        open={showNewCustomerDialog}
        onOpenChange={setShowNewCustomerDialog}
        priceTables={priceTables}
        sellers={sellers}
        onCreated={async (id) => {
          const updatedCustomers = await loadCustomers();
          const created = updatedCustomers.find((customer) => customer.id === id) || null;
          if (created) {
            setSelectedCustomer(created);
          }
        }}
      />
    </div>
  );
}
