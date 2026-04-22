"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"
import { StoreColorsManager } from "@/components/admin/store-colors-manager"
import { GenericAttributeValuesManager } from "@/components/admin/generic-attribute-values-manager"
import type { Asset, Category } from "@/lib/types"
import type { Attribute } from "@/lib/actions/attributes"
import type { AttributesContextType } from "@/components/admin/attributes-provider"
import { deleteStoreAttribute, updateStoreAttributeSortOrder } from "@/lib/actions/attributes"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Ban, ImageIcon, Package, Palette, Star, Trash2, X } from "lucide-react"

type ProductOption = {
  id: string
  name: string
  code?: string
}

interface AssetFormProps {
  asset?: Asset
  products: ProductOption[]
  attributes: Attribute[]
  categories: Category[]
  storeId?: number | null
  onSubmit: (formData: FormData) => Promise<void>
  onCancel: () => void
  onRefreshAttributes?: () => Promise<void>
}

type ImageGroupingType = "product" | "attributes" | "full_sku"
type SelectedValuesByAttribute = Record<number, number[]>
type GroupImagesMap = Record<string, string[]>

type AssetEditorGroup = {
  key: string
  label: string
  sku: string
  combinationKey: string | null
  attributeValueIds: number[]
}

function normalizeGroupToggleKey(value: string): string {
  return String(value || "").trim().toUpperCase()
}

function buildGroupToggleKey(group: Pick<AssetEditorGroup, "combinationKey" | "sku">): string {
  const combination = String(group.combinationKey || "product").trim().toLowerCase()
  const sku = normalizeSkuToken(group.sku)
  return normalizeGroupToggleKey(`${combination}::${sku}`)
}

function normalizeSkuToken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "")
    .replace(/QUADRO-ONICO/g, "QUADRO-UNICO")
    .replace(/QUADRO-NICO/g, "QUADRO-UNICO")
    .replace(/(^|-)ONICO(?=-|$)/g, "$1UNICO")
    .replace(/(^|-)NICO(?=-|$)/g, "$1UNICO")
}

function buildSku(baseCode: string, selectedValueCodes: string[]): string {
  const normalizedBase = normalizeSkuToken(baseCode)
  const tail = selectedValueCodes
    .map((entry) => normalizeSkuToken(entry))
    .filter((entry) => entry.length > 0)

  if (tail.length === 0) return normalizedBase
  return `${normalizedBase}-${tail.join("-")}`
}

function cartesianCombinations<T>(values: T[][]): T[][] {
  if (values.length === 0) return [[]]

  return values.reduce<T[][]>((acc, current) => {
    const result: T[][] = []
    for (const prefix of acc) {
      for (const value of current) {
        result.push([...prefix, value])
      }
    }
    return result
  }, [[]])
}

function toCombinationKey(valueIds: number[]): string | null {
  if (valueIds.length === 0) return null
  return [...valueIds].sort((left, right) => left - right).join(",")
}

function normalizeLookupToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/quadro-onico/g, "quadro-unico")
    .replace(/quadro-nico/g, "quadro-unico")
    .replace(/dptico/g, "diptico")
    .replace(/trptico/g, "triptico")
    .replace(/dimenso/g, "dimensao")
    .replace(/(^|-)onico(?=-|$)/g, "$1unico")
    .replace(/(^|-)nico(?=-|$)/g, "$1unico")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function resolveGroupAttributeValueIds(
  group: { attributeValueIds?: number[]; combinationKey?: string | null; sku?: string | null },
  valueToAttributeMap: Map<number, number>,
  attributes: Attribute[],
  allowedAttributeIds?: Set<number>,
): number[] {
  const directIds = Array.isArray(group?.attributeValueIds)
    ? group.attributeValueIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0 && valueToAttributeMap.has(value))
    : []

  const fromCombinationKey = typeof group?.combinationKey === "string"
    ? group.combinationKey
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((value) => Number.isInteger(value) && value > 0 && valueToAttributeMap.has(value))
    : []

  const inferredByAttribute = new Map<number, number>()
  for (const valueId of [...directIds, ...fromCombinationKey]) {
    const attributeId = valueToAttributeMap.get(valueId)
    if (!attributeId) continue
    if (allowedAttributeIds && !allowedAttributeIds.has(attributeId)) continue
    if (!inferredByAttribute.has(attributeId)) {
      inferredByAttribute.set(attributeId, valueId)
    }
  }

  const normalizedSku = normalizeLookupToken(String(group?.sku || ""))
  if (!normalizedSku) {
    return Array.from(inferredByAttribute.values()).sort((a, b) => a - b)
  }

  for (const attribute of attributes) {
    if (allowedAttributeIds && !allowedAttributeIds.has(attribute.id)) continue
    if (inferredByAttribute.has(attribute.id)) continue

    for (const value of attribute.values || []) {
      const lookup = normalizeLookupToken(value.code || value.name || "")
      if (!lookup) continue

      const matcher = new RegExp(`(^|-)${escapeRegExp(lookup)}(-|$)`)
      if (!matcher.test(normalizedSku)) continue

      if (!inferredByAttribute.has(attribute.id)) {
        inferredByAttribute.set(attribute.id, value.id)
      }
    }
  }

  return Array.from(inferredByAttribute.values()).sort((a, b) => a - b)
}

function getAssetGroupingAttributeIds(asset?: Asset): number[] {
  if (!asset || asset.imageGroupingRule?.type !== "attributes") return []

  return Array.isArray(asset.imageGroupingRule.attribute_ids)
    ? asset.imageGroupingRule.attribute_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : []
}

export function AssetForm({ asset, products, attributes, categories, storeId, onSubmit, onCancel, onRefreshAttributes }: AssetFormProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [productId, setProductId] = useState<string>(asset?.productId || "")
  const [code, setCode] = useState<string>(asset?.code || "")
  const [title, setTitle] = useState<string>(asset?.title || "")
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    Array.isArray(asset?.categoryIds) && asset.categoryIds.length > 0
      ? asset.categoryIds
      : [],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const valueToAttributeMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const attribute of attributes) {
      for (const value of attribute.values || []) {
        map.set(value.id, attribute.id)
      }
    }
    return map
  }, [attributes])

  const initialSelectedValuesByAttribute = useMemo<SelectedValuesByAttribute>(() => {
    if (!asset || asset.skuGroups.length === 0) {
      return {}
    }

    const groupingAttributeIds = getAssetGroupingAttributeIds(asset)
    const allowedGroupingAttributeSet = groupingAttributeIds.length > 0
      ? new Set(groupingAttributeIds)
      : undefined

    const map: SelectedValuesByAttribute = {}

    for (const group of asset.skuGroups) {
      const resolvedValueIds = resolveGroupAttributeValueIds(
        group,
        valueToAttributeMap,
        attributes,
        allowedGroupingAttributeSet,
      )

      for (const valueId of resolvedValueIds) {
        const attributeId = valueToAttributeMap.get(valueId)
        if (!attributeId) continue

        if (!Array.isArray(map[attributeId])) {
          map[attributeId] = []
        }

        if (!map[attributeId].includes(valueId)) {
          map[attributeId].push(valueId)
        }
      }
    }

    return map
  }, [asset, valueToAttributeMap, attributes])

  const [selectedValuesByAttribute, setSelectedValuesByAttribute] = useState<SelectedValuesByAttribute>(
    initialSelectedValuesByAttribute,
  )

  const initialGroupImages = useMemo<GroupImagesMap>(() => {
    const map: GroupImagesMap = {}
    const groupingAttributeIds = getAssetGroupingAttributeIds(asset)
    const allowedGroupingAttributeSet = groupingAttributeIds.length > 0
      ? new Set(groupingAttributeIds)
      : undefined

    for (const group of asset?.skuGroups || []) {
      const resolvedValueIds = resolveGroupAttributeValueIds(
        group,
        valueToAttributeMap,
        attributes,
        allowedGroupingAttributeSet,
      )
      const key = toCombinationKey(resolvedValueIds) || "product"
      map[key] = Array.isArray(group.images) ? group.images : []
    }

    return map
  }, [asset, valueToAttributeMap, attributes])

  const [groupImages, setGroupImages] = useState<GroupImagesMap>(initialGroupImages)

  const initialDisabledGroupKeys = useMemo<string[]>(() => {
    const raw = Array.isArray(asset?.meta?.disabledVariantGroups)
      ? asset.meta.disabledVariantGroups
      : []

    return Array.from(
      new Set(
        raw
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => normalizeGroupToggleKey(entry))
          .filter((entry) => entry.length > 0),
      ),
    )
  }, [asset])

  const [disabledGroupKeys, setDisabledGroupKeys] = useState<string[]>(initialDisabledGroupKeys)

  const initialHighlightedGroupKeys = useMemo<string[]>(() => {
    const raw = Array.isArray(asset?.meta?.highlightedVariantGroups)
      ? asset.meta.highlightedVariantGroups
      : []

    return Array.from(
      new Set(
        raw
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => normalizeGroupToggleKey(entry))
          .filter((entry) => entry.length > 0),
      ),
    )
  }, [asset])

  const [highlightedGroupKeys, setHighlightedGroupKeys] = useState<string[]>(initialHighlightedGroupKeys)

  const initialImageGroupingType = useMemo<ImageGroupingType>(() => {
    if (asset?.imageGroupingRule?.type === "full_sku") {
      return "full_sku"
    }

    if (asset?.imageGroupingRule?.type === "attributes") {
      return "attributes"
    }

    if (asset?.imageGroupingRule?.type === "product") {
      return "product"
    }

    const hasVariantGroups = (asset?.skuGroups || []).some((group) => {
      const resolvedValueIds = resolveGroupAttributeValueIds(group, valueToAttributeMap, attributes)
      return resolvedValueIds.length > 0
    })

    return hasVariantGroups ? "attributes" : "product"
  }, [asset, valueToAttributeMap, attributes])

  const [imageGroupingType, setImageGroupingType] = useState<ImageGroupingType>(initialImageGroupingType)

  const initiallySelectedGroupingAttributeIds = useMemo(() => {
    const fromRule = getAssetGroupingAttributeIds(asset)
    if (fromRule.length > 0) {
      return Array.from(new Set(fromRule))
    }

    const selected = Object.keys(initialSelectedValuesByAttribute)
      .map((key) => Number(key))
      .filter((value) => Number.isInteger(value) && value > 0)

    return selected
  }, [initialSelectedValuesByAttribute])

  const [selectedImageGroupingAttributeIds, setSelectedImageGroupingAttributeIds] = useState<number[]>(
    initiallySelectedGroupingAttributeIds,
  )
  const [orderedStoreAttributes, setOrderedStoreAttributes] = useState<Attribute[]>(attributes)
  const [isStoreColorsDrawerOpen, setIsStoreColorsDrawerOpen] = useState(false)
  const [isGenericAttributeDrawerOpen, setIsGenericAttributeDrawerOpen] = useState(false)
  const [genericAttributeDrawerMode, setGenericAttributeDrawerMode] = useState<"create" | "manage">("manage")
  const [genericCreateResetKey, setGenericCreateResetKey] = useState(0)
  const [selectedManagedAttributeId, setSelectedManagedAttributeId] = useState<number | null>(null)
  const [deleteAttributeDialogOpen, setDeleteAttributeDialogOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<Attribute | null>(null)
  const [isDeletingAttribute, setIsDeletingAttribute] = useState(false)

  const attributesContext = useMemo<AttributesContextType>(() => {
    const colorAttribute = orderedStoreAttributes.find((attribute) => {
      const code = String(attribute.code || "").trim().toLowerCase()
      return ["color", "colors", "cor", "cores"].includes(code)
    })
    const sizeAttribute = orderedStoreAttributes.find((attribute) => {
      const code = String(attribute.code || "").trim().toLowerCase()
      return ["size", "sizes", "tamanho", "tamanhos"].includes(code)
    })

    return {
      attributes: orderedStoreAttributes,
      colorAttribute,
      sizeAttribute,
      storeId: storeId ?? null,
    }
  }, [orderedStoreAttributes, storeId])

  const tabs = ["general", "attributes", "images"] as const
  const activeTabIndex = Math.max(0, tabs.indexOf(activeTab as (typeof tabs)[number]))

  const selectedManagedAttribute = selectedManagedAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedManagedAttributeId) || null
    : null

  const nextAttributeSortOrder = orderedStoreAttributes.reduce((maxSortOrder, currentAttribute) => {
    const currentSortOrder = Number(currentAttribute.sort_order ?? 0)
    return Math.max(maxSortOrder, currentSortOrder)
  }, -1) + 1

  const valueMetaById = useMemo(() => {
    const map = new Map<
      number,
      {
        attributeId: number
        attributeName: string
        attributeOrder: number
        valueName: string
        valueCode: string
      }
    >()

    orderedStoreAttributes.forEach((attribute, index) => {
      const order = Number.isFinite(attribute.sort_order) ? attribute.sort_order : index
      ;(attribute.values || []).forEach((value) => {
        map.set(value.id, {
          attributeId: attribute.id,
          attributeName: attribute.name,
          attributeOrder: order,
          valueName: value.name || value.code || String(value.id),
          valueCode: value.code || value.name || String(value.id),
        })
      })
    })

    return map
  }, [orderedStoreAttributes])

  const selectedAttributeIds = useMemo(() => {
    return orderedStoreAttributes
      .filter((attribute) => (selectedValuesByAttribute[attribute.id] || []).length > 0)
      .map((attribute) => attribute.id)
  }, [orderedStoreAttributes, selectedValuesByAttribute])

  useEffect(() => {
    setOrderedStoreAttributes(attributes)
  }, [attributes])

  useEffect(() => {
    setProductId(asset?.productId || "")
    setCode(asset?.code || "")
    setTitle(asset?.title || "")
    setSelectedCategoryIds(
      Array.isArray(asset?.categoryIds) && asset.categoryIds.length > 0
        ? asset.categoryIds
        : [],
    )
    setSelectedValuesByAttribute(initialSelectedValuesByAttribute)
    setGroupImages(initialGroupImages)
    setDisabledGroupKeys(initialDisabledGroupKeys)
    setHighlightedGroupKeys(initialHighlightedGroupKeys)
    setImageGroupingType(initialImageGroupingType)
    setSelectedImageGroupingAttributeIds(initiallySelectedGroupingAttributeIds)
  }, [
    asset?.id,
    asset?.productId,
    asset?.code,
    asset?.title,
    initialSelectedValuesByAttribute,
    initialGroupImages,
    initialDisabledGroupKeys,
    initialHighlightedGroupKeys,
    initialImageGroupingType,
    initiallySelectedGroupingAttributeIds,
    asset?.categoryIds,
  ])

  const effectiveGroupingAttributeIds = useMemo(() => {
    if (imageGroupingType === "product") return []

    if (imageGroupingType === "full_sku") {
      return selectedAttributeIds
    }

    const selected = selectedImageGroupingAttributeIds.filter((attributeId) => {
      return (selectedValuesByAttribute[attributeId] || []).length > 0
    })

    if (selected.length > 0) return selected

    return selectedAttributeIds.slice(0, 1)
  }, [imageGroupingType, selectedAttributeIds, selectedImageGroupingAttributeIds, selectedValuesByAttribute])

  const editorGroups = useMemo<AssetEditorGroup[]>(() => {
    const normalizedCode = normalizeSkuToken(code)
    const baseSkuCode = normalizedCode || "ASSET"

    if (imageGroupingType === "product") {
      return [
        {
          key: "product",
          label: "Produto",
          sku: baseSkuCode,
          combinationKey: null,
          attributeValueIds: [],
        },
      ]
    }

    const attributeValuesForGrouping = effectiveGroupingAttributeIds
      .map((attributeId) => {
        return (selectedValuesByAttribute[attributeId] || []).filter((valueId) => valueMetaById.has(valueId))
      })
      .filter((values) => values.length > 0)

    if (attributeValuesForGrouping.length === 0) {
      return [
        {
          key: "product",
          label: "Produto",
          sku: baseSkuCode,
          combinationKey: null,
          attributeValueIds: [],
        },
      ]
    }

    const combinations = cartesianCombinations<number>(attributeValuesForGrouping)

    return combinations.map((combination) => {
      const orderedValueIds = [...combination]
      const sortedForKey = [...orderedValueIds].sort((left, right) => left - right)
      const combinationKey = toCombinationKey(sortedForKey)

      const valueLabels = orderedValueIds
        .map((valueId) => valueMetaById.get(valueId)?.valueName || String(valueId))
        .filter(Boolean)

      const valueCodes = orderedValueIds
        .map((valueId) => valueMetaById.get(valueId)?.valueCode || String(valueId))
        .filter(Boolean)

      return {
        key: combinationKey || "product",
        label: valueLabels.join(" / ") || "Produto",
        sku: buildSku(baseSkuCode, valueCodes),
        combinationKey,
        attributeValueIds: sortedForKey,
      }
    })
  }, [code, imageGroupingType, effectiveGroupingAttributeIds, selectedValuesByAttribute, valueMetaById])

  const submitGroups = useMemo(() => {
    return editorGroups
      .map((group) => ({
        sku: group.sku,
        combinationKey: group.combinationKey,
        attributeValueIds: group.attributeValueIds,
        images: groupImages[group.key] || [],
      }))
      .filter((group) => {
        const toggleKey = buildGroupToggleKey(group)
        return !disabledGroupKeys.includes(toggleKey)
      })
      .filter((group) => group.images.length > 0)
  }, [editorGroups, groupImages, disabledGroupKeys])

  const submitImageGroupingRule = useMemo(() => {
    if (imageGroupingType === "product") {
      return { type: "product" as const }
    }

    if (imageGroupingType === "full_sku") {
      return { type: "full_sku" as const }
    }

    return {
      type: "attributes" as const,
      attribute_ids: effectiveGroupingAttributeIds,
    }
  }, [imageGroupingType, effectiveGroupingAttributeIds])

  const totalImageVariations = editorGroups.length
  const variationsWithPhotos = editorGroups.filter((group) => (groupImages[group.key] || []).length > 0).length
  const totalPhotos = editorGroups.reduce((total, group) => total + (groupImages[group.key] || []).length, 0)

  const canSubmit = productId.length > 0 && normalizeSkuToken(code).length > 0 && selectedCategoryIds.length > 0 && submitGroups.length > 0

  function toggleAttributeValue(attributeId: number, valueId: number) {
    setSelectedValuesByAttribute((prev) => {
      const currentValues = prev[attributeId] || []
      const exists = currentValues.includes(valueId)
      const nextValues = exists
        ? currentValues.filter((entry) => entry !== valueId)
        : [...currentValues, valueId]

      return {
        ...prev,
        [attributeId]: nextValues,
      }
    })
  }

  function toggleImageGroupingAttribute(attributeId: number) {
    setSelectedImageGroupingAttributeIds((prev) => {
      if (prev.includes(attributeId)) {
        return prev.filter((entry) => entry !== attributeId)
      }

      return [...prev, attributeId]
    })
  }

  function isColorAttribute(attribute: Attribute) {
    const code = String(attribute.code || "").trim().toLowerCase()
    return ["color", "colors", "cor", "cores"].includes(code)
  }

  function openAttributeManager(attribute: Attribute) {
    if (isColorAttribute(attribute)) {
      setIsStoreColorsDrawerOpen(true)
      return
    }

    setGenericAttributeDrawerMode("manage")
    setSelectedManagedAttributeId(attribute.id)
    setIsGenericAttributeDrawerOpen(true)
  }

  async function moveAttribute(attributeId: number, direction: "up" | "down") {
    const index = orderedStoreAttributes.findIndex((attribute) => attribute.id === attributeId)
    if (index === -1) return

    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= orderedStoreAttributes.length) return

    const reordered = [...orderedStoreAttributes]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    setOrderedStoreAttributes(reordered)

    const updates = await Promise.all(
      reordered.map((attribute, sortOrder) =>
        updateStoreAttributeSortOrder({
          attributeId: attribute.id,
          sortOrder,
        }),
      ),
    )

    if (updates.some((result) => !result.success)) {
      toast.error("Falha ao ordenar atributo")
      await onRefreshAttributes?.()
      return
    }

    await onRefreshAttributes?.()
    toast.success("Ordem dos atributos atualizada")
  }

  function openDeleteAttributeDialog(attribute: Attribute) {
    setAttributeToDelete(attribute)
    setDeleteAttributeDialogOpen(true)
  }

  async function confirmDeleteAttribute() {
    if (!attributeToDelete) return

    setIsDeletingAttribute(true)
    const result = await deleteStoreAttribute(attributeToDelete.id)
    setIsDeletingAttribute(false)

    if (!result.success) {
      toast.error("Falha ao remover atributo", {
        description: result.error || "Não foi possível remover o atributo.",
      })
      return
    }

    setSelectedValuesByAttribute((prev) => {
      const next = { ...prev }
      delete next[attributeToDelete.id]
      return next
    })
    setSelectedImageGroupingAttributeIds((prev) => prev.filter((attributeId) => attributeId !== attributeToDelete.id))

    if (selectedManagedAttributeId === attributeToDelete.id) {
      setSelectedManagedAttributeId(null)
      setIsGenericAttributeDrawerOpen(false)
    }

    const removedName = attributeToDelete.name
    setDeleteAttributeDialogOpen(false)
    setAttributeToDelete(null)
    await onRefreshAttributes?.()

    toast.success("Atributo removido", {
      description: `"${removedName}" foi removido com sucesso.`,
    })
  }

  function updateGroupImages(groupKey: string, urls: string[]) {
    setGroupImages((prev) => ({
      ...prev,
      [groupKey]: urls,
    }))
  }

  function isGroupDisabled(group: AssetEditorGroup) {
    const toggleKey = buildGroupToggleKey(group)
    return disabledGroupKeys.includes(toggleKey)
  }

  function toggleGroupDisabled(group: AssetEditorGroup) {
    const toggleKey = buildGroupToggleKey(group)
    setDisabledGroupKeys((prev) => {
      if (prev.includes(toggleKey)) {
        return prev.filter((entry) => entry !== toggleKey)
      }

      return [...prev, toggleKey]
    })
  }

  function isGroupHighlighted(group: AssetEditorGroup) {
    const toggleKey = buildGroupToggleKey(group)
    return highlightedGroupKeys.includes(toggleKey)
  }

  function toggleGroupHighlighted(group: AssetEditorGroup) {
    const toggleKey = buildGroupToggleKey(group)
    setHighlightedGroupKeys((prev) => {
      if (prev.includes(toggleKey)) {
        return prev.filter((entry) => entry !== toggleKey)
      }

      return [...prev, toggleKey]
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const payload = new FormData()
      payload.set("productId", productId)
      payload.set("code", normalizeSkuToken(code))
      payload.set("title", title)
      payload.set("categoryId", selectedCategoryIds[0] || "")
      payload.set("categoryIds", JSON.stringify(selectedCategoryIds))
      payload.set("groups", JSON.stringify(submitGroups))
      payload.set("meta", JSON.stringify({ disabledVariantGroups: disabledGroupKeys, highlightedVariantGroups: highlightedGroupKeys }))
      payload.set("imageGroupingRule", JSON.stringify(submitImageGroupingRule))

      await onSubmit(payload)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="relative grid w-full grid-cols-3">
            <span
              className="absolute inset-y-0.75 left-0.75 rounded-md bg-background shadow-sm transition-transform duration-300 ease-out pointer-events-none z-0"
              style={{
                width: `calc(${100 / tabs.length}% - 6px)`,
                transform: `translateX(calc(${activeTabIndex * 100}% + ${activeTabIndex * 6}px))`,
              }}
            />
            <TabsTrigger value="general" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="attributes" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Atributos</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Imagens</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
                <CardDescription>
                  Dados principais do asset.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.code ? `${product.code} · ${product.name}` : product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Código da Obra</Label>
                    <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex: QD-NATUREZA" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Título da Obra</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título para organização no catálogo" />
                </div>

                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map((category) => {
                      const checked = selectedCategoryIds.includes(category.id)
                      return (
                        <label key={category.id} className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const isSelected = isChecked === true
                              const next = isSelected
                                ? Array.from(new Set([...selectedCategoryIds, category.id]))
                                : selectedCategoryIds.filter((id) => id !== category.id)
                              setSelectedCategoryIds(next)
                            }}
                          />
                          <span className="text-sm">{category.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attributes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Atributos do Produto</CardTitle>
                <CardDescription>
                  Selecione os valores de cada atributo cadastrado para este produto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attributes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum atributo cadastrado para a loja.</p>
                ) : (
                  <div className="space-y-2">
                    {orderedStoreAttributes.map((attribute, index) => {
                      const selectedValues = selectedValuesByAttribute[attribute.id] || []

                      return (
                        <div key={attribute.id} className="rounded-md border px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium truncate">{attribute.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                code: {attribute.code} • selecionados: {selectedValues.length} • valores: {attribute.values?.length || 0}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="cursor-pointer"
                                disabled={index === 0}
                                onClick={() => moveAttribute(attribute.id, "up")}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="cursor-pointer"
                                disabled={index === orderedStoreAttributes.length - 1}
                                onClick={() => moveAttribute(attribute.id, "down")}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => openAttributeManager(attribute)}
                              >
                                Gerenciar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="cursor-pointer text-destructive hover:text-destructive"
                                onClick={() => openDeleteAttributeDialog(attribute)}
                                aria-label={`Remover atributo ${attribute.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3">
                            {(attribute.values || []).length ? (
                              <div className="flex flex-wrap gap-2">
                                {(attribute.values || []).map((value) => {
                                  const isSelected = selectedValues.includes(value.id)
                                  return (
                                    <button
                                      key={value.id}
                                      type="button"
                                      onClick={() => toggleAttributeValue(attribute.id, value.id)}
                                      className={`h-8 px-3 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-black text-white border-black hover:bg-black/90"
                                          : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900"
                                      }`}
                                    >
                                      {value.name || value.code}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Nenhum valor cadastrado para este atributo.</p>
                            )}

                        <AlertDialog
                          open={deleteAttributeDialogOpen}
                          onOpenChange={(open) => {
                            if (isDeletingAttribute) return
                            setDeleteAttributeDialogOpen(open)
                            if (!open) {
                              setAttributeToDelete(null)
                            }
                          }}
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar remoção de atributo</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o atributo {attributeToDelete ? `"${attributeToDelete.name}"` : "selecionado"}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="cursor-pointer" disabled={isDeletingAttribute}>
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
                                onClick={confirmDeleteAttribute}
                                disabled={!attributeToDelete || isDeletingAttribute}
                              >
                                {isDeletingAttribute ? "Removendo..." : "Remover"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                          </div>
                        </div>
                      )
                    })}

                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nível das Imagens</CardTitle>
                <CardDescription>
                  Defina em qual nível as imagens serão agrupadas no produto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={imageGroupingType}
                  onValueChange={(value) => setImageGroupingType(value as ImageGroupingType)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  <Label htmlFor="image-grouping-product" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="product" id="image-grouping-product" className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Por Produto</div>
                      <div className="text-xs text-muted-foreground">Todas as variantes compartilham as mesmas imagens.</div>
                    </div>
                  </Label>

                  <Label htmlFor="image-grouping-attributes" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="attributes" id="image-grouping-attributes" className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Por Atributos</div>
                      <div className="text-xs text-muted-foreground">Agrupa por atributos selecionados (ex: cor).</div>
                    </div>
                  </Label>

                  <Label htmlFor="image-grouping-full-sku" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="full_sku" id="image-grouping-full-sku" className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Por SKU Completo</div>
                      <div className="text-xs text-muted-foreground">Cada variante terá suas próprias imagens.</div>
                    </div>
                  </Label>
                </RadioGroup>

                {imageGroupingType === "attributes" && (
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium mb-2">Atributos para agrupamento</p>
                    {selectedAttributeIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Selecione valores de atributos na aba Atributos para habilitar esta opção.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attributes
                          .filter((attribute) => selectedAttributeIds.includes(attribute.id))
                          .map((attribute) => (
                            <label key={attribute.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={selectedImageGroupingAttributeIds.includes(attribute.id)}
                                onCheckedChange={() => toggleImageGroupingAttribute(attribute.id)}
                              />
                              <span>{attribute.name}</span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Imagens do Produto</CardTitle>
                <CardDescription>
                  {imageGroupingType === "product"
                    ? "Todas as variantes compartilham as mesmas imagens."
                    : imageGroupingType === "attributes"
                      ? "As imagens são agrupadas pelos atributos selecionados."
                      : "Cada combinação de SKU possui seu próprio grupo de imagens."}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border px-2 py-1">
                    Variações: <strong>{totalImageVariations}</strong>
                  </span>
                  <span className="rounded-md border px-2 py-1">
                    Com fotos: <strong>{variationsWithPhotos}</strong>
                  </span>
                  <span className="rounded-md border px-2 py-1">
                    Total de fotos: <strong>{totalPhotos}</strong>
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {editorGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Preencha o código e selecione atributos para gerar grupos de imagem.</p>
                ) : (
                  <div className="space-y-6">
                    {editorGroups.map((group) => (
                      <div key={group.key} className="space-y-3">
                        <div className="space-y-1">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{group.label}</div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 cursor-pointer"
                                onClick={() => toggleGroupDisabled(group)}
                                aria-label={isGroupDisabled(group) ? `Reativar variante ${group.label}` : `Desativar variante ${group.label}`}
                                title={isGroupDisabled(group) ? "Reativar variante" : "Desativar variante"}
                              >
                                <Ban className={`h-4 w-4 ${isGroupDisabled(group) ? "text-destructive" : ""}`} />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 cursor-pointer"
                                onClick={() => toggleGroupHighlighted(group)}
                                aria-label={isGroupHighlighted(group) ? `Remover destaque de ${group.label}` : `Marcar ${group.label} como destaque`}
                                title={isGroupHighlighted(group) ? "Remover destaque" : "Marcar como destaque"}
                              >
                                <Star className={`h-4 w-4 ${isGroupHighlighted(group) ? "fill-yellow-400 text-yellow-400" : ""}`} />
                              </Button>
                            </div>
                            {isGroupDisabled(group) && (
                              <div className="text-xs text-muted-foreground">Variante desativada (não será usada no asset).</div>
                            )}
                          </div>
                        </div>

                        <MultiImageUpload
                          value={groupImages[group.key] || []}
                          onChange={(urls) => updateGroupImages(group.key, urls)}
                          folder="assets"
                          maxImages={20}
                          disabled={isGroupDisabled(group)}
                          showHeaderInfo={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="sticky bottom-0 bg-background border-t p-4 flex justify-end gap-2 -mx-6 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Salvando..." : asset ? "Atualizar Asset" : "Criar Asset"}
        </Button>
      </div>

      <Drawer
        open={isStoreColorsDrawerOpen}
        onOpenChange={setIsStoreColorsDrawerOpen}
        direction="right"
      >
        <DrawerContent>
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Gerenciar cores da loja</DrawerTitle>
              <DrawerDescription>
                Defina e atualize as cores globais da loja sem vínculo com o asset atual.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          <div className="px-4 pt-4 pb-4 overflow-y-auto">
            <StoreColorsManager
              attributes={attributesContext}
              storeId={storeId}
              onRefreshAttributes={onRefreshAttributes}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isGenericAttributeDrawerOpen}
        onOpenChange={(open) => {
          setIsGenericAttributeDrawerOpen(open)
          if (!open) {
            setSelectedManagedAttributeId(null)
            setGenericAttributeDrawerMode("manage")
          }
        }}
        direction="right"
      >
        <DrawerContent>
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Gerenciar atributo</DrawerTitle>
              <DrawerDescription>
                Gerencie os valores do atributo selecionado.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          <div className="px-4 pt-4 pb-4 overflow-y-auto">
            <GenericAttributeValuesManager
              key={genericAttributeDrawerMode === "create" ? `create-${genericCreateResetKey}` : `manage-${selectedManagedAttribute?.id ?? "none"}`}
              attribute={genericAttributeDrawerMode === "manage" ? selectedManagedAttribute : null}
              nextAttributeSortOrder={nextAttributeSortOrder}
              mode={genericAttributeDrawerMode === "manage" ? "manage-values" : "create-attribute"}
              storeId={storeId}
              onAttributeCreated={(createdAttribute) => {
                setGenericAttributeDrawerMode("manage")
                setSelectedManagedAttributeId(createdAttribute.id)
                setIsGenericAttributeDrawerOpen(true)
                setGenericCreateResetKey((prev) => prev + 1)
              }}
              onRefreshAttributes={onRefreshAttributes}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </form>
  )
}
