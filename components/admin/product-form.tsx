"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/ui/rich-editor";
import CurrencyInput from "@/components/form/CurrencyInput";
import IntegerInput from "@/components/form/IntegerInput";
import MultiUploadInput from "@/components/form/MultiUploadInput";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Plus,
  Trash2,
  Upload,
  X,
  Loader2,
  GripVertical,
  Save,
  Palette,
  Ruler,
  Package,
  Video,
  ImageIcon,
  Layers,
  DollarSign,
  ArrowDown,
  ArrowUp,
  FilterX,
  FolderOpen,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import type { Product, Category, ProductColor, ProductVariant, ProductCustomField, StockMode } from "@/lib/types";
import { getMediaAspectRatioStyle } from "@/lib/utils";
import { INFINITE_STOCK_MAX_QTY } from "@/lib/stock-mode";
import type { AttributesContextType } from "@/components/admin/attributes-provider";
import { StoreColorsManager } from "./store-colors-manager";
import { GenericAttributeValuesManager } from "./generic-attribute-values-manager";
import { StoreAttributeNameField } from "./store-attribute-name-field";
import { createColorValue, createSizeValue, deleteAttributeValue, updateAttributeValue, updateAttributeValueMeta, updateAttributeValueSortOrder } from "@/lib/actions/attribute-values";
import { deleteStoreAttribute, updateStoreAttributeSortOrder } from "@/lib/actions/attributes";
import { getSiteSettingsAction } from "@/lib/actions/settings";
import { isErpIntegrated as readErpIntegratedFromSettings, ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE } from "@/lib/erp-integration";
import { getWmsLocationsAction, getWmsWarehousesAction, type WmsLocation, type WmsWarehouse } from "@/lib/actions/wms";
import { createMeasurementTableAction, getMeasurementTablesAction, updateMeasurementTableAction } from "@/lib/actions/measurement-tables";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import { useAdminStore } from "@/contexts/admin-store-context";
import { toast } from "sonner";
import type { Attribute } from "@/lib/actions/attributes";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Validation schema
const productFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").min(3, "Nome deve ter no mínimo 3 caracteres"),
  sku: z.string().min(1, "SKU é obrigatório"),
  description: z.string().optional(),
  materials: z.string().optional(),
  measures: z.string().optional(),
  measurementTableId: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

// Common colors with HEX codes
const COMMON_COLORS = [
  { name: "Preto", hex: "#000000" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Cinza", hex: "#808080" },
  { name: "Marinho", hex: "#000080" },
  { name: "Azul", hex: "#0000FF" },
  { name: "Vermelho", hex: "#FF0000" },
  { name: "Rosa", hex: "#FFC0CB" },
  { name: "Verde", hex: "#008000" },
  { name: "Amarelo", hex: "#FFFF00" },
  { name: "Laranja", hex: "#FFA500" },
  { name: "Roxo", hex: "#800080" },
  { name: "Bege", hex: "#F5F5DC" },
  { name: "Marrom", hex: "#8B4513" },
  { name: "Vinho", hex: "#722F37" },
  { name: "Nude", hex: "#E3BC9A" },
  { name: "Mostarda", hex: "#FFDB58" },
  { name: "Terracota", hex: "#E2725B" },
  { name: "Off-White", hex: "#FAF9F6" },
];

interface ProductFormProps {
  product?: Product;
  categories: Category[];
  attributes?: AttributesContextType;
  storeId?: number | null;
  isErpIntegrated?: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onSaveColorImages?: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  onRefreshAttributes?: () => Promise<void>;
}

interface SortableImageCardProps {
  id: string;
  img: string;
  label: string;
  idx: number;
  onRemove: () => void;
  aspectStyle?: React.CSSProperties;
}

function SortableImageCard({ id, img, label, idx, onRemove, aspectStyle }: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...aspectStyle,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${aspectStyle ? '' : 'aspect-3/4'} rounded-lg border overflow-hidden group transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 ring-2 ring-primary z-10' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <CloudflareImage
        src={img || "/placeholder.svg"}
        cloudflare={{ width: 150, height: 200, fit: "cover", dpr: 2 }}
        alt={`${label} ${idx + 1}`}
        fill
        sizes="(max-width: 640px) 25vw, 12vw"
        className="object-cover"
      />
      <div className="absolute top-1 left-1 rounded-md bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-8 w-8 bg-gray-500/40 hover:bg-gray-500/55 text-white cursor-pointer"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {idx === 0 && (
        <Badge className="absolute bottom-2 left-2">Principal</Badge>
      )}
    </div>
  );
}

export function ProductForm({
  product,
  categories,
  attributes,
  storeId,
  isErpIntegrated: isErpIntegratedProp = false,
  onSubmit,
  onSaveColorImages,
  onCancel,
  onRefreshAttributes,
}: ProductFormProps) {
  const { session } = useAdminStore();
  const [erpIntegrated, setErpIntegrated] = useState(isErpIntegratedProp);

  useEffect(() => {
    setErpIntegrated(isErpIntegratedProp);
  }, [isErpIntegratedProp]);

  useEffect(() => {
    let cancelled = false;

    void getSiteSettingsAction(undefined, { include: { erp: true } }).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      setErpIntegrated(readErpIntegratedFromSettings(result.data.erpSettings));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeStoreSizeLabel = (value: string) => String(value || '').trim().toUpperCase();
  const normalizeColorAttributeValueId = (value: unknown): number | undefined => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };

  type ImageGroupingType = 'product' | 'attributes' | 'full_sku';
  const [activeTab, setActiveTab] = useState("general");
  const [isStoreColorsDrawerOpen, setIsStoreColorsDrawerOpen] = useState(false);
  const [isStoreSizesDrawerOpen, setIsStoreSizesDrawerOpen] = useState(false);
  const [isGenericAttributeDrawerOpen, setIsGenericAttributeDrawerOpen] = useState(false);
  const [genericAttributeDrawerMode, setGenericAttributeDrawerMode] = useState<"create" | "manage">("manage");
  const [genericCreateResetKey, setGenericCreateResetKey] = useState(0);
  const [selectedManagedAttributeId, setSelectedManagedAttributeId] = useState<number | null>(null);
  const [selectedColorManagerAttributeId, setSelectedColorManagerAttributeId] = useState<number | null>(null);
  const [selectedSizeManagerAttributeId, setSelectedSizeManagerAttributeId] = useState<number | null>(null);
  const [attributeManagerSelection, setAttributeManagerSelection] = useState<"color" | "size" | "new">("color");
  const [deleteAttributeDialogOpen, setDeleteAttributeDialogOpen] = useState(false);
  const [attributeToDelete, setAttributeToDelete] = useState<Attribute | null>(null);
  const [isDeletingAttribute, setIsDeletingAttribute] = useState(false);
  const [imageGroupingType, setImageGroupingType] = useState<ImageGroupingType>('attributes');
  const [selectedImageGroupingAttributeIds, setSelectedImageGroupingAttributeIds] = useState<number[]>([]);
  const imageGroupingUserChangedRef = useRef(false);
  const [imageGroupingChangeDialogOpen, setImageGroupingChangeDialogOpen] = useState(false);
  const [pendingImageGroupingType, setPendingImageGroupingType] = useState<ImageGroupingType | null>(null);
  const [videoGroupingType, setVideoGroupingType] = useState<ImageGroupingType>('attributes');
  const [selectedVideoGroupingAttributeIds, setSelectedVideoGroupingAttributeIds] = useState<number[]>([]);
  const videoGroupingUserChangedRef = useRef(false);
  const [variantAttributeFilters, setVariantAttributeFilters] = useState<Record<number, string>>({});
  const [variantDrawerKey, setVariantDrawerKey] = useState<string | null>(null);
  const [disabledVariantKeys, setDisabledVariantKeys] = useState<string[]>([]);
  const [variantStatusFilter, setVariantStatusFilter] = useState<'all' | 'active' | 'disabled'>('active');
  const [attributeValuePickerAttributeId, setAttributeValuePickerAttributeId] = useState<number | null>(null);
  const [attributeValuePickerSearch, setAttributeValuePickerSearch] = useState('');
  const [stockModeConfig, setStockModeConfig] = useState<StockMode>('FANTASY');
  const [stockVariantMaxQty, setStockVariantMaxQty] = useState(999);
  const [productCustomFieldDefs, setProductCustomFieldDefs] = useState<ProductCustomField[]>([]);
  const [productCustomFieldValues, setProductCustomFieldValues] = useState<Record<string, string | string[]>>({});
  const [mediaAspectRatio, setMediaAspectRatio] = useState<{
    width: number | null;
    height: number | null;
  }>({ width: null, height: null });
  const mediaAspectStyle = useMemo(
    () => getMediaAspectRatioStyle(mediaAspectRatio.width, mediaAspectRatio.height),
    [mediaAspectRatio.width, mediaAspectRatio.height],
  );
  const imageAspectStyle = mediaAspectStyle;
  const videoAspectStyle = mediaAspectStyle;
  const [wmsLocations, setWmsLocations] = useState<WmsLocation[]>([]);
  const [wmsWarehouses, setWmsWarehouses] = useState<WmsWarehouse[]>([]);
  const [measurementTables, setMeasurementTables] = useState<Array<{
    id: string;
    name: string;
    meta: Record<string, unknown>;
  }>>([]);
  const [isMeasurementTableDrawerOpen, setIsMeasurementTableDrawerOpen] = useState(false);
  const [isMeasurementTablePopoverOpen, setIsMeasurementTablePopoverOpen] = useState(false);
  const [isLoadingMeasurementTables, setIsLoadingMeasurementTables] = useState(false);
  const [measurementTableSearch, setMeasurementTableSearch] = useState('');
  const [isCreatingMeasurementTable, setIsCreatingMeasurementTable] = useState(false);
  const [editingMeasurementTableId, setEditingMeasurementTableId] = useState<string | null>(null);
  const [newMeasurementTableName, setNewMeasurementTableName] = useState('');
  const [newMeasurementTableGrid, setNewMeasurementTableGrid] = useState<string[][]>([
    ['GRADE', 'P', 'M', 'G'],
    ['BUSTO', '84-90', '90-96', '96-102'],
    ['CINTURA', '68-73', '73-77', '77-81'],
    ['QUADRIL', '94-98', '98-104', '104-108'],
  ]);
  const [variantPreferredSellableLocations, setVariantPreferredSellableLocations] = useState<Record<string, string[]>>({});
  const hydratedProductIdRef = useRef<string | null>(null);
  // Form validation with react-hook-form
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      sku: product?.sku || "",
      description: product?.description || "",
      materials: product?.materials || "",
      measures: product?.measures || "",
      measurementTableId: product?.measurementTableId || "",
      categoryId: product?.categoryId || product?.categoryIds?.[0] || "",
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
    },
  });

  const { handleSubmit: handleFormSubmit, formState: { isSubmitting } } = form;

  const [tags, setTags] = useState<string[]>(product?.tags || []);
  const [newTag, setNewTag] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    Array.isArray(product?.categoryIds) && product.categoryIds.length > 0
      ? product.categoryIds
      : (product?.categoryId ? [product.categoryId] : [])
  );

  // Internal color type with required id and images for form management
  type FormColor = {
    id: string;
    name: string;
    hex: string;
    images: string[];
    attributeValueId?: number;
  };

  type FormVideo = {
    id?: number;
    url: string;
    hlsUrl?: string;
    mp4Url?: string;
    previewUrl?: string;
    thumbUrl?: string;
    externalId?: string;
    name?: string;
    storagePath?: string;
  };

  // Colors with images
  const [colors, setColors] = useState<FormColor[]>(
    (product?.colors || []).map((c, i) => ({
      id: c.id || `color-${i}`,
      name: c.name,
      hex: c.hex,
      images: c.images || [],
      attributeValueId: normalizeColorAttributeValueId(c.attributeValueId),
    }))
  );
  const [activeProductColorIds, setActiveProductColorIds] = useState<string[]>(
    (product?.colors || []).map((c, i) => c.id || `color-${i}`)
  );

  function resolveHexFromStoreColor(name: string, rgb?: string) {
    const rgbValue = rgb?.trim();
    if (rgbValue && rgbValue.startsWith('#') && (rgbValue.length === 7 || rgbValue.length === 4)) {
      return rgbValue;
    }

    const common = COMMON_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return common?.hex || '#000000';
  }

  function getColorDotStyle(color?: FormColor): React.CSSProperties {
    if (!color) {
      return { backgroundColor: '#000000' };
    }

    const storeColorValues = attributes?.colorAttribute?.values || [];
    const normalizedName = color.name.trim().toLowerCase();
    const colorAttributeValueId = normalizeColorAttributeValueId(color.attributeValueId);
    const storeColorValue = typeof colorAttributeValueId === 'number'
      ? storeColorValues.find((value) => value.id === colorAttributeValueId)
      : storeColorValues.find((value) => {
          const valueName = value.name?.trim().toLowerCase();
          const valueCode = value.code?.trim().toLowerCase();
          return valueName === normalizedName || valueCode === normalizedName;
        });

    const meta = (storeColorValue?.meta || {}) as { imageUrl?: string; rgb?: string };
    const imageUrl = typeof meta.imageUrl === 'string' && meta.imageUrl.trim().length > 0
      ? meta.imageUrl.trim()
      : undefined;
    const rgb = typeof meta.rgb === 'string' && meta.rgb.trim().startsWith('#')
      ? meta.rgb.trim()
      : undefined;

    return {
      backgroundColor: rgb || color.hex || '#000000',
      ...(imageUrl
        ? {
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {}),
    };
  }

  function dedupeColors(list: FormColor[]) {
    const seen = new Set<string>();
    return list.filter((color) => {
      const normalizedId = normalizeColorAttributeValueId(color.attributeValueId);
      const key = typeof normalizedId === 'number'
        ? `id:${normalizedId}`
        : `name:${color.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  useEffect(() => {
    // Ao criar novo produto, prefill com cores da loja se não houver cores ainda
    if (product) return;
    if (colors.length > 0) return;

    const storeColors = attributes?.colorAttribute?.values || [];
    if (!storeColors.length) return;

    const prefilledColors: FormColor[] = storeColors.map((value, idx) => ({
      id: `store-color-${value.id}-${idx}`,
      name: value.name,
      hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
      images: [],
      attributeValueId: value.id,
    }));

    setColors(prefilledColors);
  }, [attributes?.colorAttribute?.values, product, colors.length]);

  // Sincronizar cores da loja quando os atributos mudarem (independente de edição ou criação)
  useEffect(() => {
    const storeColors = attributes?.colorAttribute?.values || [];
    if (!storeColors.length) return;

    // Se está editando e as cores já foram carregadas do produto, mesclar com cores da loja
    if (product && colors.length > 0) {
      const existingColorIds = new Set(
        colors
          .map((c) => normalizeColorAttributeValueId(c.attributeValueId))
          .filter((id): id is number => typeof id === 'number')
      );
      const newStoreColors = storeColors
        .filter(value => !existingColorIds.has(value.id))
        .map((value, idx) => ({
          id: `store-color-${value.id}-${idx}`,
          name: value.name,
          hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
          images: [],
          attributeValueId: value.id,
        }));

      if (newStoreColors.length > 0) {
        setColors(prev => dedupeColors([...prev, ...newStoreColors]));
      }
    }
  }, [attributes?.colorAttribute?.values, product, colors.length]);

  // Remove cores que foram deletadas da loja
  useEffect(() => {
    const storeColorIds = new Set(attributes?.colorAttribute?.values?.map(v => v.id) || []);

    setColors(prev =>
      prev.filter(color => {
        // Manter cores que são do produto (sem attributeValueId)
        const normalizedId = normalizeColorAttributeValueId(color.attributeValueId);
        if (!normalizedId) return true;
        // Remover cores que foram deletadas da loja
        return storeColorIds.has(normalizedId);
      })
    );

    setActiveProductColorIds(prev => {
      const storeColorIds = new Set(attributes?.colorAttribute?.values?.map(v => v.id) || []);
      return prev.filter(colorId => {
        // Manter cores que não têm attributeValueId (cores do produto)
        const hasNoAttrId = !colors.some(c => c.id === colorId && normalizeColorAttributeValueId(c.attributeValueId));
        if (hasNoAttrId) return true;
        // Para cores com attributeValueId, verificar se ainda existem na loja
        const color = colors.find(c => c.id === colorId);
        const normalizedId = normalizeColorAttributeValueId(color?.attributeValueId);
        if (!normalizedId) return true;
        return storeColorIds.has(normalizedId);
      });
    });
  }, [attributes?.colorAttribute?.values?.map(v => v.id).join(',') || '']);

  // Sincronizar estados quando o produto mudar
  useEffect(() => {
    if (!product) {
      hydratedProductIdRef.current = null;
      return;
    }

    const variantsDataForHydration = (product as any)?.__variantsData;
    const variantsDataSignature = Array.isArray(variantsDataForHydration)
      ? `${variantsDataForHydration.length}:${variantsDataForHydration.map((entry: any) => entry?.id ?? '').join(',')}`
      : '0';
    const hydrationKey = `${product.id || ''}:${variantsDataSignature}`;
    if (hydratedProductIdRef.current === hydrationKey) return;
    hydratedProductIdRef.current = hydrationKey;

    if (!product) return;

    console.log('🔄 Produto mudou, sincronizando estados...');
    console.log('📦 Product colors:', product.colors);
    console.log('🏪 Store colors from attributes:', attributes?.colorAttribute?.values);

    // Reset do formulário com os valores do produto
    form.reset({
      name: product.name || "",
      sku: product.sku || "",
      description: product.description || "",
      materials: product.materials || "",
      measures: product.measures || "",
      measurementTableId: product.measurementTableId || "",
      categoryId: product.categoryId || product.categoryIds?.[0] || "",
      isActive: product.isActive ?? true,
      isFeatured: product.isFeatured ?? false,
    });

    setSelectedCategoryIds(
      Array.isArray(product.categoryIds) && product.categoryIds.length > 0
        ? product.categoryIds
        : (product.categoryId ? [product.categoryId] : []),
    );

    // MESCLAR cores do produto com cores da loja
    const storeColors = attributes?.colorAttribute?.values || [];
    const productColors: FormColor[] = (product.colors || []).map((c, i) => ({
      id: c.id || `color-${i}`,
      name: c.name,
      hex: c.hex,
      images: c.images || [],
      attributeValueId: normalizeColorAttributeValueId(c.attributeValueId),
    }));

    // Adicionar cores da loja que não estão no produto
    const productColorValueIds = new Set(
      productColors
        .map((c) => normalizeColorAttributeValueId(c.attributeValueId))
        .filter((id): id is number => typeof id === 'number')
    );
    const additionalStoreColors: FormColor[] = storeColors
      .filter(value => !productColorValueIds.has(value.id))
      .map((value, idx) => ({
        id: `store-color-${value.id}-${idx}`,
        name: value.name,
        hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
        images: [],
        attributeValueId: value.id,
      }));

    // Combinar cores do produto + cores da loja
    const allColors = dedupeColors([...productColors, ...additionalStoreColors]);
    console.log('🎨 Total colors disponíveis:', allColors.length, allColors);

    setColors(allColors);
    setActiveProductColorIds(productColors.map(c => c.id));

    // Atualizar tamanhos (fallback para tamanhos da loja quando produto não tiver vínculo)
    const storeSizes = (attributes?.attributes || [])
      .filter((attribute) => ['size', 'sizes', 'tamanho', 'tamanhos'].includes(attribute.code.toLowerCase()))
      .flatMap((attribute) =>
        attribute.values
          .map((value) => (value.name || value.code || '').trim().toUpperCase())
          .filter(Boolean)
      );

    const normalizedProductSizes = (product.sizes || [])
      .map((size) => String(size).trim().toUpperCase())
      .filter(Boolean);

    const effectiveSizes = normalizedProductSizes.length > 0
      ? normalizedProductSizes
      : Array.from(new Set(storeSizes));

    console.log('📏 Atualizando tamanhos do produto:', product.sizes);
    console.log('📏 Fallback tamanhos da loja:', storeSizes);
    console.log('📏 Tamanhos efetivos na edição:', effectiveSizes);
    setSizes(effectiveSizes);
    setStoreSizeSelections(effectiveSizes);

    // Atualizar tags
    setTags(product.tags || []);

    // Atualizar imagens padrão
    setDefaultImages(product.images || []);
    setVariantImages({});

    // Atualizar preços e estoque das variantes se disponível
    const variantsData = (product as any).__variantsData;
    if (variantsData && Array.isArray(variantsData)) {
      const newStocks: Record<string, number> = {};
      const newBasePrices: Record<string, string> = {};
      const newCosts: Record<string, string> = {};
      const newPromoPrices: Record<string, string> = {};
      const newNcms: Record<string, string> = {};
      const newBarcodes: Record<string, string> = {};
      const newWeightGrams: Record<string, string> = {};
      const newVariantIdsByKey: Record<string, string> = {};
      const newVariantImages: Record<string, string[]> = {};
      const newHighlightedVariantKeys: Record<string, boolean> = {};
      const newDisabledVariantKeys: string[] = [];
      const newVariantSkuOverrides: Record<string, string> = {};
      const newPreferredSellableLocations: Record<string, string[]> = {};
      const selectedValuesByAttribute: Record<number, Set<number>> = {};
      const persistedSelectedOrderByAttribute: Record<number, number[]> = (() => {
        const rawMeta = ((product as any)?.meta || {}) as Record<string, unknown>;
        const raw = rawMeta.attribute_values_by_attribute ?? rawMeta.attributeValuesByAttribute;

        if (!raw || typeof raw !== 'object') return {};

        const normalized: Record<number, number[]> = {};
        Object.entries(raw as Record<string, unknown>).forEach(([attributeIdRaw, valueIdsRaw]) => {
          const attributeId = Number(attributeIdRaw);
          if (!Number.isInteger(attributeId) || attributeId <= 0 || !Array.isArray(valueIdsRaw)) return;

          const valueIds = Array.from(
            new Set(
              valueIdsRaw
                .map((value) => Number(value))
                .filter((valueId) => Number.isInteger(valueId) && valueId > 0)
            )
          );

          if (valueIds.length > 0) {
            normalized[attributeId] = valueIds;
          }
        });

        return normalized;
      })();

      const valueToAttributeMap = new Map<number, number>();
      (attributes?.attributes || []).forEach((attribute) => {
        (attribute.values || []).forEach((value) => {
          valueToAttributeMap.set(value.id, attribute.id);
        });
      });

      variantsData.forEach((v: any) => {
        const attributeValueIds = Array.isArray(v.attributeValueIds)
          ? v.attributeValueIds.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id))
          : [];

        const rawCombinationKey = typeof v.combinationKey === 'string'
          ? v.combinationKey.trim().toLowerCase()
          : '';
        const isSimpleVariant = v.isSimpleProduct === true || rawCombinationKey === '_default';

        const key = buildVariantKeyFromVariantsDataEntry({
          attributeValueIds,
          combinationKey: v.combinationKey ?? v.combination_key,
          isSimpleProduct: isSimpleVariant,
          color: v.color,
          size: v.size,
        });

        if (v.id !== null && v.id !== undefined) {
          const variantId = String(v.id);
          newVariantIdsByKey[key] = variantId;

          const colorSizeKey = buildVariantColorSizeKey(v.color, v.size);
          if (colorSizeKey) {
            newVariantIdsByKey[colorSizeKey] = variantId;
          }
        }

        if (Array.isArray(v.images) && v.images.length > 0) {
          const normalizedImages = v.images
            .filter((url: unknown): url is string => typeof url === 'string')
            .map((url: string) => url.trim())
            .filter((url: string) => url.length > 0);

          if (normalizedImages.length > 0 && !newVariantImages[key]) {
            newVariantImages[key] = normalizedImages;
          }
        }

        // A seleção visual dos atributos deve refletir apenas variantes ativas.
        // Variantes desativadas continuam visíveis nas abas de variações/preço/estoque.
        if (v.active !== false) {
          attributeValueIds.forEach((valueId: number) => {
            const attributeId = valueToAttributeMap.get(valueId);
            if (!attributeId) return;
            if (!selectedValuesByAttribute[attributeId]) {
              selectedValuesByAttribute[attributeId] = new Set<number>();
            }
            selectedValuesByAttribute[attributeId].add(valueId);
          });
        }

        newStocks[key] = v.stock || 0;
        if (v.basePrice !== null && v.basePrice !== undefined) {
          newBasePrices[key] = String(v.basePrice);
        }
        if (v.cost !== null && v.cost !== undefined) {
          newCosts[key] = String(v.cost);
        }
        if (v.priceOverride !== null && v.priceOverride !== undefined) {
          newPromoPrices[key] = String(v.priceOverride);
        }
        if (v.ncm !== null && v.ncm !== undefined) {
          newNcms[key] = String(v.ncm);
        }
        if ((v as any).barcode !== null && (v as any).barcode !== undefined) {
          newBarcodes[key] = String((v as any).barcode);
        }
        if ((v as any).weightGrams !== null && (v as any).weightGrams !== undefined) {
          newWeightGrams[key] = String((v as any).weightGrams);
        }

        if (v.active === false) {
          const variantSize = String(v.size || '').trim().toUpperCase();
          const shouldPreserveDisabledState = !variantSize || effectiveSizes.includes(variantSize);
          if (shouldPreserveDisabledState) {
            newDisabledVariantKeys.push(key);
          }
        }

        const persistedSku = typeof v.sku === 'string' ? v.sku.trim() : '';
        if (!erpIntegrated && persistedSku) {
          newVariantSkuOverrides[key] = persistedSku;
        }

        const preferredSellableLocationIdsRaw =
          (v as any).preferredSellableLocationIds
          ?? (v as any)?.preferred_sellable_location_ids
          ?? (v as any)?.meta?.preferred_sellable_location_ids
          ?? [];

        if (Array.isArray(preferredSellableLocationIdsRaw) && preferredSellableLocationIdsRaw.length > 0) {
          const normalizedPreferredIds = preferredSellableLocationIdsRaw
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
            .map((id: number) => String(id));

          if (normalizedPreferredIds.length > 0) {
            newPreferredSellableLocations[key] = normalizedPreferredIds;
          }
        }

        if (v.isHighlighted === true) {
          newHighlightedVariantKeys[key] = true;
        }
      });

      setVariantStocks(newStocks);
      setVariantBasePrices(newBasePrices);
      setVariantSkuOverrides(newVariantSkuOverrides);
      setVariantPreferredSellableLocations(newPreferredSellableLocations);
      setVariantCosts(newCosts);
      setVariantPromotionalPrices(newPromoPrices);
      setVariantNcms(newNcms);
      setVariantBarcodes(newBarcodes);
      setVariantWeightGrams(newWeightGrams);
      setVariantIdsByKey(newVariantIdsByKey);
      setVariantImages(newVariantImages);
      hydratedVideoGroupsKeyRef.current = null;
      setHighlightedVariantKeys(newHighlightedVariantKeys);
      setDisabledVariantKeys(Array.from(new Set(newDisabledVariantKeys)));

      if (Object.keys(selectedValuesByAttribute).length > 0) {
        setSelectedAttributeValuesByAttribute((prev) => {
          const merged: Record<number, number[]> = { ...prev };
          Object.entries(selectedValuesByAttribute).forEach(([attributeId, valueSet]) => {
            const numericAttributeId = Number(attributeId);
            const activeIdsInInsertionOrder = Array.from(valueSet);
            const persistedOrder = persistedSelectedOrderByAttribute[numericAttributeId] || [];
            const persistedIdsSet = new Set<number>(persistedOrder);

            const prioritizedFromPersisted = persistedOrder.filter((valueId) => valueSet.has(valueId));
            const remainingFromActive = activeIdsInInsertionOrder.filter((valueId) => !persistedIdsSet.has(valueId));

            const current = merged[numericAttributeId] || [];
            const currentValid = current.filter((valueId) => valueSet.has(valueId));
            const currentExtras = currentValid.filter(
              (valueId) => !prioritizedFromPersisted.includes(valueId) && !remainingFromActive.includes(valueId)
            );

            merged[numericAttributeId] = [
              ...prioritizedFromPersisted,
              ...remainingFromActive,
              ...currentExtras,
            ];
          });
          return merged;
        });
      }
    } else {
      setDisabledVariantKeys([]);
      setVariantSkuOverrides({});
      setVariantPreferredSellableLocations({});
      setHighlightedVariantKeys({});
      setVariantNcms({});
      setVariantBarcodes({});
      setVariantWeightGrams({});
      setVariantIdsByKey({});
      setVariantVideos({});
      hydratedVideoGroupsKeyRef.current = null;
    }
  }, [product?.id, product?.meta, (product as any)?.__variantsData]);

  useEffect(() => {
    const rule = (product as any)?.__imageGroupingRule;
    if (!rule || typeof rule !== 'object') return;

    const type = String((rule as any).type || 'product') as ImageGroupingType;
    if (['product', 'attributes', 'full_sku'].includes(type)) {
      setImageGroupingType(type);
    }

    const attributeIds = Array.isArray((rule as any).attribute_ids)
      ? (rule as any).attribute_ids
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    setSelectedImageGroupingAttributeIds(attributeIds);
  }, [product?.id]);

  useEffect(() => {
    const rule = (product as any)?.__videoGroupingRule;
    if (!rule || typeof rule !== 'object') return;

    const type = String((rule as any).type || 'product') as ImageGroupingType;
    if (['product', 'attributes', 'full_sku'].includes(type)) {
      setVideoGroupingType(type);
    }

    const attributeIds = Array.isArray((rule as any).attribute_ids)
      ? (rule as any).attribute_ids
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    setSelectedVideoGroupingAttributeIds(attributeIds);
  }, [product?.id]);

  useEffect(() => {
    if (product?.id) return;
    if (imageGroupingUserChangedRef.current) return;
    if (selectedImageGroupingAttributeIds.length > 0) return;

    const colorAttribute = (attributes?.attributes || []).find((attribute) => {
      const code = String(attribute.code || '').trim().toLowerCase();
      return ['color', 'colors', 'cor', 'cores'].includes(code);
    });

    if (colorAttribute) {
      setImageGroupingType('attributes');
      setSelectedImageGroupingAttributeIds([colorAttribute.id]);
    }
  }, [product?.id, attributes?.attributes, selectedImageGroupingAttributeIds.length]);

  useEffect(() => {
    if (product?.id) return;
    if (videoGroupingUserChangedRef.current) return;
    if (selectedVideoGroupingAttributeIds.length > 0) return;

    const colorAttribute = (attributes?.attributes || []).find((attribute) => {
      const code = String(attribute.code || '').trim().toLowerCase();
      return ['color', 'colors', 'cor', 'cores'].includes(code);
    });

    if (colorAttribute) {
      setVideoGroupingType('attributes');
      setSelectedVideoGroupingAttributeIds([colorAttribute.id]);
    }
  }, [product?.id, attributes?.attributes, selectedVideoGroupingAttributeIds.length]);

  // Quando atributos mudarem (ex: criar nova cor), adicionar às cores disponíveis
  useEffect(() => {
    const storeColors = attributes?.colorAttribute?.values || [];
    if (!storeColors.length) return;
    if (colors.length === 0) return; // Esperar cores serem inicializadas primeiro

    const existingValueIds = new Set(colors.map(c => c.attributeValueId).filter(Boolean));
    const newColors: FormColor[] = storeColors
      .filter(value => !existingValueIds.has(value.id))
      .map((value, idx) => ({
        id: `store-color-${value.id}-${Date.now()}-${idx}`,
        name: value.name,
        hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
        images: [],
        attributeValueId: value.id,
      }));

    if (newColors.length > 0) {
      console.log('➕ Adicionando novas cores da loja:', newColors);
      setColors(prev => dedupeColors([...prev, ...newColors]));
    }
  }, [attributes?.colorAttribute?.values]);

  // Sizes selected for this product
  const [sizes, setSizes] = useState<string[]>(product?.sizes || []);
  const [storeSizeSelections, setStoreSizeSelections] = useState<string[]>(product?.sizes || []);
  const [storeSizesDisplayOrder, setStoreSizesDisplayOrder] = useState<string[]>([]);
  const [draggedStoreSize, setDraggedStoreSize] = useState<string | null>(null);
  const [dragOverStoreSize, setDragOverStoreSize] = useState<string | null>(null);
  const [isSavingStoreSizesOrder, setIsSavingStoreSizesOrder] = useState(false);
  const [newStoreSize, setNewStoreSize] = useState("");
  const [isAddingStoreSize, setIsAddingStoreSize] = useState(false);
  const [sizeValueNameDrafts, setSizeValueNameDrafts] = useState<Record<number, string>>({});
  const [savingSizeValueId, setSavingSizeValueId] = useState<number | null>(null);
  const [selectedAttributeValuesByAttribute, setSelectedAttributeValuesByAttribute] = useState<Record<number, number[]>>({});
  const [draggedSelectedAttributeValue, setDraggedSelectedAttributeValue] = useState<{ attributeId: number; valueId: number } | null>(null);
  const [dragOverSelectedAttributeValue, setDragOverSelectedAttributeValue] = useState<{ attributeId: number; valueId: number } | null>(null);

  useEffect(() => {
    const allAttributes = attributes?.attributes || [];
    if (!allAttributes.length) {
      setSelectedAttributeValuesByAttribute({});
      return;
    }

    setSelectedAttributeValuesByAttribute((prev) => {
      const merged: Record<number, number[]> = {};

      allAttributes.forEach((attribute) => {
        const validValueIds = new Set(attribute.values.map((value) => value.id));
        const previousIds = Array.from(new Set((prev[attribute.id] || []).filter((id) => validValueIds.has(id))));

        if (previousIds.length > 0) {
          merged[attribute.id] = previousIds;
        }
      });

      return merged;
    });
  }, [attributes?.attributes]);

  useEffect(() => {
    const allAttributes = attributes?.attributes || [];
    if (!allAttributes.length) return;

    const selectedValueIds = new Set<number>(
      Object.values(selectedAttributeValuesByAttribute)
        .flatMap((ids) => ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    const colorAttributes = allAttributes.filter((attribute) => {
      const code = String(attribute.code || '').trim().toLowerCase();
      return ['color', 'colors', 'cor', 'cores'].includes(code);
    });

    const selectedColorValueIds = new Set<number>(
      colorAttributes
        .flatMap((attribute) => attribute.values || [])
        .map((value) => value.id)
        .filter((valueId) => selectedValueIds.has(valueId))
    );

    if (selectedColorValueIds.size > 0) {
      const selectedFromStore: FormColor[] = colorAttributes
        .flatMap((attribute) => attribute.values || [])
        .filter((value) => selectedColorValueIds.has(value.id))
        .map((value, idx) => ({
          id: `store-color-${value.id}-${idx}`,
          name: value.name,
          hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
          images: [],
          attributeValueId: value.id,
        }));

      if (selectedFromStore.length > 0) {
        setColors((prev) => {
          const next = dedupeColors([...prev, ...selectedFromStore]);
          if (next.length === prev.length) {
            const same = next.every((entry, index) => {
              const current = prev[index];
              return (
                current &&
                current.id === entry.id &&
                current.name === entry.name &&
                current.hex === entry.hex &&
                normalizeColorAttributeValueId(current.attributeValueId) === normalizeColorAttributeValueId(entry.attributeValueId)
              );
            });

            if (same) {
              return prev;
            }
          }

          return next;
        });
      }
    }

    setActiveProductColorIds((prev) => {
      const selectedColorIds = colors
        .filter((color) => {
          const valueId = normalizeColorAttributeValueId(color.attributeValueId);
          return typeof valueId === 'number' && selectedColorValueIds.has(valueId);
        })
        .map((color) => color.id);

      if (selectedColorIds.length === 0) return [];

      const merged = Array.from(new Set([...prev, ...selectedColorIds]));
      return merged.filter((colorId) => selectedColorIds.includes(colorId));
    });

    const sizeAttributes = allAttributes.filter((attribute) => {
      const code = String(attribute.code || '').trim().toLowerCase();
      return ['size', 'sizes', 'tamanho', 'tamanhos'].includes(code);
    });

    const selectedSizeLabels = Array.from(
      new Set(
        sizeAttributes
          .flatMap((attribute) => attribute.values || [])
          .filter((value) => selectedValueIds.has(value.id))
          .map((value) => (value.name || value.code || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );

    setSizes(selectedSizeLabels);
    setStoreSizeSelections((prev) => {
      if (!selectedSizeLabels.length) return [];
      const merged = Array.from(new Set([...prev, ...selectedSizeLabels]));
      return merged.filter((size) => selectedSizeLabels.includes(size));
    });
  }, [attributes?.attributes, selectedAttributeValuesByAttribute, colors]);

  // Carregar tamanhos da loja quando os atributos mudarem
  useEffect(() => {
    const sizeAttributes = (attributes?.attributes || []).filter((attribute) =>
      ['size', 'sizes', 'tamanho', 'tamanhos'].includes(attribute.code.toLowerCase())
    );

    const storeSizes = sizeAttributes.flatMap((attribute) =>
      attribute.values
        .map((value) => (value.name || value.code || '').trim().toUpperCase())
        .filter(Boolean)
    );

    if (!storeSizes.length) return;

    const uniqueStoreSizes = Array.from(new Set(storeSizes));

    // Se está criando e não tem seleções ainda, usar os da loja
    if (!product && storeSizeSelections.length === 0) {
      setStoreSizeSelections(uniqueStoreSizes);
    }
    // Se está editando, mesclar com tamanhos que já existem
    else if (product && storeSizeSelections.length > 0) {
      const merged = Array.from(new Set([...storeSizeSelections, ...uniqueStoreSizes]));
      if (merged.length > storeSizeSelections.length) {
        // Há novos tamanhos da loja que não estavam antes - não adicionar automaticamente aos selecionados
        // mas eles estarão disponíveis para seleção manual
      }
    }
  }, [attributes?.attributes, product, storeSizeSelections.length]);



  // Variants (auto-generated from colors x sizes)
  const [variants, setVariants] = useState<Partial<ProductVariant>[]>([]);
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});
  const [variantBasePrices, setVariantBasePrices] = useState<Record<string, string>>({});
  const [variantSkuOverrides, setVariantSkuOverrides] = useState<Record<string, string>>({});
  const [variantCosts, setVariantCosts] = useState<Record<string, string>>({});
  const [variantPromotionalPrices, setVariantPromotionalPrices] = useState<Record<string, string>>({});
  const [variantNcms, setVariantNcms] = useState<Record<string, string>>({});
  const [variantBarcodes, setVariantBarcodes] = useState<Record<string, string>>({});
  const [variantWeightGrams, setVariantWeightGrams] = useState<Record<string, string>>({});
  const [highlightedVariantKeys, setHighlightedVariantKeys] = useState<Record<string, boolean>>({});
  const [variantIdsByKey, setVariantIdsByKey] = useState<Record<string, string>>({});
  const [variantImages, setVariantImages] = useState<Record<string, string[]>>({});
  const [variantVideos, setVariantVideos] = useState<Record<string, FormVideo | null>>({});
  const [uploadingImageGroupKey, setUploadingImageGroupKey] = useState<string | null>(null);
  const [uploadingVideoGroupKey, setUploadingVideoGroupKey] = useState<string | null>(null);

  function buildVariantKeyFromAttributeValues(attributeValueIds: number[]) {
    if (!attributeValueIds.length) return '_default';
    return [...attributeValueIds].sort((a, b) => a - b).join('|');
  }

  function buildVariantKeyFromVariantsDataEntry(entry: {
    attributeValueIds?: unknown;
    combinationKey?: unknown;
    isSimpleProduct?: boolean;
    color?: unknown;
    size?: unknown;
  }) {
    const attributeValueIds = Array.isArray(entry.attributeValueIds)
      ? entry.attributeValueIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const rawCombinationKey = typeof entry.combinationKey === 'string'
      ? entry.combinationKey.trim().toLowerCase()
      : '';
    const isSimpleVariant = entry.isSimpleProduct === true || rawCombinationKey === '_default';

    if (attributeValueIds.length > 0) {
      return buildVariantKeyFromAttributeValues(attributeValueIds);
    }

    if (isSimpleVariant) {
      return '_default';
    }

    return `${entry.color}-${entry.size}`;
  }

  function normalizeVariantMatchToken(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  function buildVariantColorSizeKey(color: unknown, size: unknown): string {
    const normalizedColor = normalizeVariantMatchToken(color);
    const normalizedSize = normalizeVariantMatchToken(size);
    if (!normalizedColor || !normalizedSize) return '';
    return `${normalizedColor}|${normalizedSize}`;
  }

  const erpVariantSkuIndex = useMemo(() => {
    const entries: any[] = Array.isArray((product as any)?.__variantsData)
      ? (product as any).__variantsData
      : [];

    return { entries };
  }, [product]);

  function getErpVariantEntryFromDb(params: {
    variantId?: string | null;
    variantKey?: string;
    attributeValueIds?: number[];
    color?: string;
    size?: string;
  }) {
    const { entries } = erpVariantSkuIndex;

    const variantId = params.variantId ? String(params.variantId).trim() : '';
    if (variantId) {
      const byIdEntry = entries.find((entry: any) => String(entry?.id ?? '') === variantId);
      if (byIdEntry) return byIdEntry;
    }

    const attributeValueIds = Array.isArray(params.attributeValueIds)
      ? params.attributeValueIds.filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (attributeValueIds.length > 0) {
      const attributeKey = buildVariantKeyFromAttributeValues(attributeValueIds);
      const byAttributeEntry = entries.find(
        (entry: any) => buildVariantKeyFromAttributeValues(
          Array.isArray(entry?.attributeValueIds) ? entry.attributeValueIds : [],
        ) === attributeKey,
      );
      if (byAttributeEntry) return byAttributeEntry;
    }

    if (params.variantKey) {
      const byKeyEntry = entries.find(
        (entry: any) => buildVariantKeyFromVariantsDataEntry(entry) === params.variantKey,
      );
      if (byKeyEntry) return byKeyEntry;
    }

    const colorSizeKey = buildVariantColorSizeKey(params.color, params.size);
    if (colorSizeKey) {
      const byColorSizeEntry = entries.find(
        (entry: any) => buildVariantColorSizeKey(entry?.color, entry?.size) === colorSizeKey,
      );
      if (byColorSizeEntry) return byColorSizeEntry;
    }

    const normalizedColor = normalizeVariantMatchToken(params.color);
    const normalizedSize = normalizeVariantMatchToken(params.size);
    if (normalizedColor && normalizedSize) {
      return entries.find((entry: any) =>
        normalizeVariantMatchToken(entry?.color) === normalizedColor
        && normalizeVariantMatchToken(entry?.size) === normalizedSize,
      );
    }

    return undefined;
  }

  function getErpVariantSkuFromDb(params: {
    variantId?: string | null;
    variantKey?: string;
    attributeValueIds?: number[];
    color?: string;
    size?: string;
  }): string {
    const entry = getErpVariantEntryFromDb(params);
    if (entry && typeof entry.sku === 'string' && entry.sku.trim()) {
      return entry.sku.trim();
    }
    return '';
  }

  function displayVariantSku(
    variantKey: string,
    context: {
      variantId?: string;
      attributeValueIds?: number[];
      color?: string;
      size?: string;
    },
    synthesizedSku = '',
  ): string {
    if (erpIntegrated) {
      return getErpVariantSkuFromDb({
        variantId: context.variantId || variantIdsByKey[variantKey] || null,
        variantKey,
        attributeValueIds: context.attributeValueIds,
        color: context.color,
        size: context.size,
      });
    }

    const override = variantSkuOverrides[variantKey];
    if (typeof override === 'string' && override.trim()) {
      return override.trim();
    }

    const persisted = getErpVariantSkuFromDb({
      variantId: context.variantId || variantIdsByKey[variantKey] || null,
      variantKey,
      attributeValueIds: context.attributeValueIds,
      color: context.color,
      size: context.size,
    });
    if (persisted) {
      return persisted;
    }

    return synthesizedSku;
  }

  function resolveSubmittedVariantSku(
    variantKey: string,
    existing: { id?: unknown; sku?: unknown; color?: unknown; size?: unknown } | undefined,
    synthesizedFallback: string,
    attributeValueIds?: number[],
  ) {
    return displayVariantSku(
      variantKey,
      {
        variantId: existing?.id != null ? String(existing.id) : undefined,
        attributeValueIds,
        color: typeof existing?.color === 'string' ? existing.color : undefined,
        size: typeof existing?.size === 'string' ? existing.size : undefined,
      },
      synthesizedFallback,
    );
  }

  function isVariantDisabled(variantKey: string): boolean {
    return disabledVariantKeys.includes(variantKey);
  }

  function toggleVariantDisabled(variantKey: string) {
    setDisabledVariantKeys((prev) => {
      if (prev.includes(variantKey)) {
        return prev.filter((entry) => entry !== variantKey);
      }

      return [...prev, variantKey];
    });
  }

  // Default images (for products without color variants)
  const [defaultImages, setDefaultImages] = useState<string[]>(product?.images || []);
  const [isUploadingDefault, setIsUploadingDefault] = useState(false);
  const [uploadingColorImageId, setUploadingColorImageId] = useState<string | null>(null);

  const defaultFileInputRef = useRef<HTMLInputElement>(null);
  const colorImageFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const imageGroupFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const videoGroupFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hydratedVideoGroupsKeyRef = useRef<string | null>(null);
  const imageOrderSyncInFlightRef = useRef<Record<string, boolean>>({});
  const queuedImageOrderSyncRef = useRef<Record<string, { variantIds: number[]; images: string[] }>>({});
  const imageDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const normalizedPermissionCodes = useMemo(
    () => Array.isArray(session?.permissionCodes)
      ? session.permissionCodes
          .map((code) => String(code || '').trim().toLowerCase())
          .filter(Boolean)
      : null,
    [session?.permissionCodes],
  );

  const hasProductTabPermission = useMemo(() => {
    const hasPermission = (code: string) => {
      // Sem payload de permissões no contexto: mantém comportamento atual.
      if (!normalizedPermissionCodes) return true;
      return normalizedPermissionCodes.includes(code.toLowerCase());
    };

    return {
      categories: hasPermission('products.manage_categories'),
      images: hasPermission('products.manage_images'),
      videos: hasPermission('products.manage_videos'),
      variants: hasPermission('products.manage_variants'),
      pricesView: hasPermission('prices.view'),
      pricesEdit: hasPermission('prices.edit'),
      inventoryView: hasPermission('inventory.view'),
      inventoryEdit: hasPermission('inventory.edit'),
    };
  }, [normalizedPermissionCodes]);

  useEffect(() => {
    let cancelled = false;

    const loadStockSettings = async () => {
      const [settingsResult, locationsResult, warehousesResult] = await Promise.all([
        getSiteSettingsAction(),
        getWmsLocationsAction(),
        getWmsWarehousesAction(),
      ]);
      if (cancelled) return;

      if (settingsResult.success && settingsResult.data) {
        setStockModeConfig(settingsResult.data.stockMode || 'FANTASY');
        setStockVariantMaxQty(Math.max(1, Number(settingsResult.data.variantMaxQty || 999)));
        const productFields = Array.isArray(settingsResult.data.productCustomFields)
          ? [...settingsResult.data.productCustomFields].sort((left, right) => left.order - right.order)
          : [];
        setProductCustomFieldDefs(productFields);
        setMediaAspectRatio({
          width: settingsResult.data.customization?.mediaAspectWidth ?? null,
          height: settingsResult.data.customization?.mediaAspectHeight ?? null,
        });
      }

      if (locationsResult.success && Array.isArray(locationsResult.data)) {
        setWmsLocations(locationsResult.data);
      }

      if (warehousesResult.success && Array.isArray(warehousesResult.data)) {
        setWmsWarehouses(warehousesResult.data);
      }
    };

    void loadStockSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const meta = product?.meta && typeof product.meta === 'object'
      ? product.meta as Record<string, unknown>
      : null;
    const customFieldsRaw = meta?.custom_fields && typeof meta.custom_fields === 'object'
      ? meta.custom_fields as Record<string, unknown>
      : {};

    const nextValues = Object.entries(customFieldsRaw).reduce<Record<string, string | string[]>>((acc, [key, value]) => {
      if (value === null || value === undefined) return acc;
      if (Array.isArray(value)) {
        acc[key] = value.map((entry) => String(entry)).filter(Boolean);
        return acc;
      }
      if (typeof value === 'string') {
        acc[key] = value;
        return acc;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = String(value);
        return acc;
      }
      acc[key] = JSON.stringify(value);
      return acc;
    }, {});

    setProductCustomFieldValues(nextValues);
  }, [product?.id]);

  useEffect(() => {
    void loadMeasurementTables('', 10);
  }, []);

  // Pre-seed the measurement tables list with the current product's table so the
  // button and checkmark render correctly before the lazy load completes.
  useEffect(() => {
    if (product?.measurementTableId && product?.measurementTableName) {
      setMeasurementTables((prev) => {
        const alreadyLoaded = prev.some((t) => t.id === product.measurementTableId);
        if (alreadyLoaded) return prev;
        return [{ id: product.measurementTableId!, name: product.measurementTableName!, meta: {} }, ...prev];
      });
    }
  }, [product?.measurementTableId, product?.measurementTableName]);

  useEffect(() => {
    if (!isMeasurementTablePopoverOpen) return;

    const timeoutId = setTimeout(() => {
      void loadMeasurementTables(measurementTableSearch, 10);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [measurementTableSearch, isMeasurementTablePopoverOpen]);

  function normalizeStockInputByMode(rawValue: number | null | undefined): number {
    const numericValue = Math.max(0, Math.floor(Number(rawValue || 0)));

    if (stockModeConfig === 'BINARY') {
      return numericValue > 0 ? 1 : 0;
    }

    if (stockModeConfig === 'INFINITO') {
      return numericValue > 0 ? INFINITE_STOCK_MAX_QTY : 0;
    }

    if (stockModeConfig === 'FANTASY') {
      return numericValue > 0 ? 1 : 0;
    }

    return numericValue;
  }

  function normalizeMeasurementGrid(grid: string[][]): string[][] {
    const normalizedRows = (Array.isArray(grid) ? grid : [])
      .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []));

    const fallback = [
      ['GRADE', 'P', 'M', 'G'],
      ['BUSTO', '', '', ''],
    ];

    const source = normalizedRows.length > 0 ? normalizedRows : fallback;
    const maxCols = Math.max(2, ...source.map((row) => row.length || 0));

    return source.map((row) => {
      const next = [...row];
      while (next.length < maxCols) {
        next.push('');
      }
      return next;
    });
  }

  function buildMeasurementTableMeta(grid: string[][]) {
    const normalizedGrid = normalizeMeasurementGrid(grid);
    const headerRow = normalizedGrid[0] || [];

    return {
      table: normalizedGrid.map((row) => ({
        items: row.map((value, colIndex) => ({
          value: String(value || '').trim(),
          label: String(headerRow[colIndex] || '').trim(),
        })),
      })),
    };
  }

  function parseMeasurementTableGrid(meta: Record<string, unknown>): string[][] {
    const rows = Array.isArray(meta?.table) ? meta.table : [];
    const parsed = rows
      .map((row) => {
        const rowItems = Array.isArray((row as { items?: unknown }).items)
          ? (row as { items: unknown[] }).items
          : [];

        return rowItems.map((item) => {
          if (item && typeof item === 'object' && 'value' in item) {
            const raw = (item as { value?: unknown }).value;
            return String(raw ?? '').trim();
          }

          return '';
        });
      })
      .filter((row) => row.length > 0);

    return normalizeMeasurementGrid(parsed);
  }

  function resetMeasurementTableDraft() {
    setEditingMeasurementTableId(null);
    setNewMeasurementTableName('');
    setNewMeasurementTableGrid([
      ['GRADE', 'P', 'M', 'G'],
      ['BUSTO', '', '', ''],
      ['CINTURA', '', '', ''],
    ]);
  }

  function handleMeasurementTableDrawerOpenChange(open: boolean) {
    setIsMeasurementTableDrawerOpen(open);
    if (!open) {
      resetMeasurementTableDraft();
    }
  }

  function handleOpenCreateMeasurementTableDrawer() {
    resetMeasurementTableDraft();
    setIsMeasurementTableDrawerOpen(true);
  }

  function handleOpenEditMeasurementTableDrawer(tableId: string) {
    const selectedTable = measurementTables.find((table) => table.id === tableId);

    if (!selectedTable) {
      toast.error('Tabela de medidas não encontrada', {
        description: 'Atualize a lista e tente novamente.',
      });
      return;
    }

    setEditingMeasurementTableId(selectedTable.id);
    setNewMeasurementTableName(String(selectedTable.name || '').trim());
    setNewMeasurementTableGrid(parseMeasurementTableGrid(selectedTable.meta || {}));
    setIsMeasurementTableDrawerOpen(true);
  }

  function truncateMeasurementTableLabel(label: string, maxLength: number = 14) {
    const normalized = String(label || '').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1)}...`;
  }

  function updateMeasurementGridCell(rowIndex: number, colIndex: number, value: string) {
    setNewMeasurementTableGrid((prev) => {
      const next = normalizeMeasurementGrid(prev).map((row) => [...row]);
      if (!next[rowIndex]) return next;
      next[rowIndex][colIndex] = value;
      return next;
    });
  }

  function addMeasurementGridColumn() {
    setNewMeasurementTableGrid((prev) =>
      normalizeMeasurementGrid(prev).map((row, rowIndex) => [
        ...row,
        rowIndex === 0 ? `COL${row.length}` : '',
      ])
    );
  }

  function removeMeasurementGridColumn(colIndex: number) {
    setNewMeasurementTableGrid((prev) => {
      const next = normalizeMeasurementGrid(prev);
      if ((next[0]?.length || 0) <= 2) return next;
      return next.map((row) => row.filter((_, idx) => idx !== colIndex));
    });
  }

  function addMeasurementGridRow() {
    setNewMeasurementTableGrid((prev) => {
      const next = normalizeMeasurementGrid(prev);
      const columns = next[0]?.length || 2;
      return [...next, Array.from({ length: columns }, () => '')];
    });
  }

  function removeMeasurementGridRow(rowIndex: number) {
    setNewMeasurementTableGrid((prev) => {
      const next = normalizeMeasurementGrid(prev);
      if (next.length <= 2) return next;
      return next.filter((_, idx) => idx !== rowIndex);
    });
  }

  async function loadMeasurementTables(searchTerm: string = '', limit: number = 10) {
    setIsLoadingMeasurementTables(true);
    try {
      const result = await getMeasurementTablesAction({
        query: searchTerm,
        limit,
      });
      if (!result.success || !result.data) {
        toast.error('Falha ao carregar tabelas de medidas', {
          description: result.error || 'Não foi possível listar as tabelas disponíveis.',
        });
        return;
      }

      setMeasurementTables((prev) => {
        const freshItems = result.data
          .filter((item) => item.id && item.name)
          .map((item) => ({
            id: String(item.id),
            name: String(item.name),
            meta: (item.meta || {}) as Record<string, unknown>,
          }));
        const freshIds = new Set(freshItems.map((i) => i.id));
        // Preserve the currently-selected entry even if it wasn't returned in
        // this batch (the table list is paginated / limited to 10 items).
        const selectedId = form.getValues('measurementTableId');
        if (selectedId && !freshIds.has(selectedId)) {
          const existing = prev.find((i) => i.id === selectedId);
          if (existing) return [existing, ...freshItems];
        }
        return freshItems;
      });
    } finally {
      setIsLoadingMeasurementTables(false);
    }
  }

  async function handleCreateMeasurementTable() {
    const name = newMeasurementTableName.trim();
    if (!name) {
      toast.error('Nome obrigatório', {
        description: 'Informe o nome da tabela de medidas.',
      });
      return;
    }

    setIsCreatingMeasurementTable(true);
    try {
      const meta = buildMeasurementTableMeta(newMeasurementTableGrid);
      const result = editingMeasurementTableId
        ? await updateMeasurementTableAction({ id: editingMeasurementTableId, name, meta })
        : await createMeasurementTableAction({ name, meta });

      if (!result.success || !result.data) {
        toast.error(editingMeasurementTableId ? 'Falha ao atualizar tabela de medidas' : 'Falha ao criar tabela de medidas', {
          description: result.error || (editingMeasurementTableId
            ? 'Não foi possível salvar as alterações da tabela.'
            : 'Não foi possível salvar a nova tabela.'),
        });
        return;
      }

      const created = {
        id: String(result.data.id),
        name: String(result.data.name || name),
        meta: (result.data.meta || {}) as Record<string, unknown>,
      };

      setMeasurementTables((prev) => {
        const next = [...prev.filter((item) => item.id !== created.id), created];
        next.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
        return next;
      });

      form.setValue('measurementTableId', created.id, { shouldDirty: true });
      setMeasurementTableSearch('');
      setIsMeasurementTablePopoverOpen(false);
      setIsMeasurementTableDrawerOpen(false);
      resetMeasurementTableDraft();

      toast.success(editingMeasurementTableId ? 'Tabela de medidas atualizada' : 'Tabela de medidas criada');
    } finally {
      setIsCreatingMeasurementTable(false);
    }
  }

  function buildImageGroupKey(
    variantKey: string,
    selectedValues: Array<{ attributeId: number; valueId: number }>
  ) {
    if (imageGroupingType === 'product') {
      return 'product';
    }

    if (imageGroupingType === 'full_sku') {
      const sortedValueIds = [...selectedValues]
        .sort((a, b) => a.attributeId - b.attributeId)
        .map((item) => item.valueId);

      if (!sortedValueIds.length) {
        return `sku:${String(variantKey || '').replace(/\|/g, '-')}`;
      }

      return `sku:${sortedValueIds.join('-')}`;
    }

    const selectedAttributeIds = selectedImageGroupingAttributeIds;
    if (!selectedAttributeIds.length) {
      return 'product';
    }

    const attrsSet = new Set(selectedAttributeIds);
    const groupedValues = selectedValues.filter((item) => attrsSet.has(item.attributeId));
    if (!groupedValues.length) {
      return 'product';
    }

    const groupedKey = [...groupedValues]
      .sort((a, b) => a.attributeId - b.attributeId)
      .map((item) => item.valueId)
      .join('-');

    return `attr:${groupedKey}`;
  }

  function buildLegacyImageGroupKey(
    variantKey: string,
    selectedValues: Array<{ attributeId: number; valueId: number }>
  ) {
    if (imageGroupingType === 'product') {
      return 'product';
    }

    if (imageGroupingType === 'full_sku') {
      return `sku:${variantKey}`;
    }

    const selectedAttributeIds = selectedImageGroupingAttributeIds;
    if (!selectedAttributeIds.length) {
      return 'product';
    }

    const attrsSet = new Set(selectedAttributeIds);
    const groupedValues = selectedValues.filter((item) => attrsSet.has(item.attributeId));
    if (!groupedValues.length) {
      return 'product';
    }

    const groupedKey = groupedValues
      .map((item) => `${item.attributeId}:${item.valueId}`)
      .join('|');

    return `attr:${groupedKey}`;
  }

  function resolveImagesForGroup(
    groupKey: string,
    legacyGroupKey: string,
    variantKey: string,
    fallbackImages: string[] = [],
  ): string[] {
    if (groupKey === 'product') {
      return Array.isArray(defaultImages) ? defaultImages : [];
    }

    if (Object.prototype.hasOwnProperty.call(variantImages, groupKey)) {
      return Array.isArray(variantImages[groupKey]) ? variantImages[groupKey] : [];
    }

    if (Object.prototype.hasOwnProperty.call(variantImages, legacyGroupKey)) {
      return Array.isArray(variantImages[legacyGroupKey]) ? variantImages[legacyGroupKey] : [];
    }

    if (Object.prototype.hasOwnProperty.call(variantImages, variantKey)) {
      return Array.isArray(variantImages[variantKey]) ? variantImages[variantKey] : [];
    }

    return fallbackImages;
  }

  function applyGroupImagesToLocalState(groupKey: string, nextImages: string[]) {
    if (groupKey === 'product') {
      setDefaultImages(nextImages);
      return;
    }

    setVariantImages((prev) => {
      const next: Record<string, string[]> = {
        ...prev,
        [groupKey]: nextImages,
      };

      generatedVariants.forEach((variant) => {
        const selectedValues = variant.selectedValues.map((value) => ({
          attributeId: value.attributeId,
          valueId: value.valueId,
        }));
        const variantGroupKey = buildImageGroupKey(variant.variantKey, selectedValues);
        const legacyGroupKey = buildLegacyImageGroupKey(variant.variantKey, selectedValues);

        if (variantGroupKey === groupKey || legacyGroupKey === groupKey) {
          next[variant.variantKey] = nextImages;
          if (legacyGroupKey !== groupKey) {
            next[legacyGroupKey] = nextImages;
          }
        }
      });

      return next;
    });

    if (groupKey.startsWith('attr:')) {
      const groupedValueIds = groupKey
        .slice(5)
        .split('-')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);

      if (groupedValueIds.length > 0) {
        const groupedValueIdSet = new Set(groupedValueIds);
        setColors((prev) => prev.map((color) => {
          const attributeValueId = normalizeColorAttributeValueId(color.attributeValueId);
          if (typeof attributeValueId === 'number' && groupedValueIdSet.has(attributeValueId)) {
            return { ...color, images: nextImages };
          }
          return color;
        }));
      }
    }
  }

  function buildVideoGroupKey(
    variantKey: string,
    selectedValues: Array<{ attributeId: number; valueId: number }>
  ) {
    if (videoGroupingType === 'product') {
      return 'product';
    }

    if (videoGroupingType === 'full_sku') {
      const sortedValueIds = [...selectedValues]
        .sort((a, b) => a.attributeId - b.attributeId)
        .map((item) => item.valueId);

      if (!sortedValueIds.length) {
        return `sku:${String(variantKey || '').replace(/\|/g, '-')}`;
      }

      return `sku:${sortedValueIds.join('-')}`;
    }

    const selectedAttributeIds = selectedVideoGroupingAttributeIds;
    if (!selectedAttributeIds.length) {
      return 'product';
    }

    const attrsSet = new Set(selectedAttributeIds);
    const groupedValues = selectedValues.filter((item) => attrsSet.has(item.attributeId));
    if (!groupedValues.length) {
      return 'product';
    }

    const groupedKey = [...groupedValues]
      .sort((a, b) => a.attributeId - b.attributeId)
      .map((item) => item.valueId)
      .join('-');

    return `attr:${groupedKey}`;
  }

  function buildLegacyVideoGroupKey(
    variantKey: string,
    selectedValues: Array<{ attributeId: number; valueId: number }>
  ) {
    if (videoGroupingType === 'product') {
      return 'product';
    }

    if (videoGroupingType === 'full_sku') {
      return `sku:${variantKey}`;
    }

    const selectedAttributeIds = selectedVideoGroupingAttributeIds;
    if (!selectedAttributeIds.length) {
      return 'product';
    }

    const attrsSet = new Set(selectedAttributeIds);
    const groupedValues = selectedValues.filter((item) => attrsSet.has(item.attributeId));
    if (!groupedValues.length) {
      return 'product';
    }

    const groupedKey = groupedValues
      .map((item) => `${item.attributeId}:${item.valueId}`)
      .join('|');

    return `attr:${groupedKey}`;
  }

  function buildAttributeValueLookupMap() {
    const valueById = new Map<number, {
      id: number;
      name: string;
      code: string;
      attributeId: number;
      attributeCode: string;
      attributeName: string;
    }>();

    (attributes?.attributes || []).forEach((attribute) => {
      (attribute.values || []).forEach((value) => {
        valueById.set(value.id, {
          id: value.id,
          name: value.name || value.code || String(value.id),
          code: value.code || value.name || String(value.id),
          attributeId: attribute.id,
          attributeCode: attribute.code,
          attributeName: attribute.name,
        });
      });
    });

    return valueById;
  }

  function mapVariantsDataEntryToDisplayVariant(
    entry: any,
    valueById: Map<number, {
      id: number;
      name: string;
      code: string;
      attributeId: number;
      attributeCode: string;
      attributeName: string;
    }>,
  ) {
    const attributeValueIds = Array.isArray(entry?.attributeValueIds)
      ? entry.attributeValueIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];

    const variantKey = buildVariantKeyFromVariantsDataEntry({
      attributeValueIds,
      combinationKey: entry?.combinationKey ?? entry?.combination_key,
      isSimpleProduct: entry?.isSimpleProduct,
      color: entry?.color,
      size: entry?.size,
    });

    const selectedValues = attributeValueIds
      .map((valueId: number) => {
        const value = valueById.get(valueId);
        if (!value) return null;
        return {
          attributeId: value.attributeId,
          attributeCode: value.attributeCode,
          attributeName: value.attributeName,
          valueId: value.id,
          valueName: value.name,
          valueCode: value.code,
        };
      })
      .filter((value): value is {
        attributeId: number;
        attributeCode: string;
        attributeName: string;
        valueId: number;
        valueName: string;
        valueCode: string;
      } => Boolean(value));

    const preferredSellableLocationIds = (variantPreferredSellableLocations[variantKey] || [])
      .map((idStr) => {
        const id = Number(idStr);
        return Number.isInteger(id) && id > 0 ? id : null;
      })
      .filter((id): id is number => id !== null);

    const parsedBasePrice = variantBasePrices[variantKey] ? parseFloat(variantBasePrices[variantKey]) : NaN;
    const parsedCost = variantCosts[variantKey] ? parseFloat(variantCosts[variantKey]) : NaN;
    const parsedPromotionalPrice = variantPromotionalPrices[variantKey] ? parseFloat(variantPromotionalPrices[variantKey]) : NaN;

    return {
      id: entry?.id != null ? String(entry.id) : (variantIdsByKey[variantKey] || ''),
      variantKey,
      combinationLabel: selectedValues.length > 0
        ? selectedValues.map((value) => `${value.attributeName}: ${value.valueName}`).join(' • ')
        : 'Padrão',
      selectedValues,
      color: typeof entry?.color === 'string' && entry.color ? entry.color : 'Único',
      size: typeof entry?.size === 'string' && entry.size ? String(entry.size).toUpperCase() : 'ÚNICO',
      variantSku: typeof entry?.sku === 'string' ? entry.sku.trim() : '',
      stock: normalizeStockInputByMode(
        typeof variantStocks[variantKey] === 'number'
          ? variantStocks[variantKey]
          : (typeof entry?.stock === 'number' ? entry.stock : 0),
      ),
      priceOverride: Number.isFinite(parsedPromotionalPrice)
        ? parsedPromotionalPrice
        : (typeof entry?.priceOverride === 'number' ? entry.priceOverride : null),
      basePrice: Number.isFinite(parsedBasePrice)
        ? parsedBasePrice
        : (typeof entry?.basePrice === 'number' ? entry.basePrice : (product?.basePrice ?? 0)),
      cost: Number.isFinite(parsedCost)
        ? parsedCost
        : (typeof entry?.cost === 'number' ? entry.cost : (product?.cost ?? null)),
      ncm: typeof variantNcms[variantKey] === 'string'
        ? variantNcms[variantKey]
        : (typeof entry?.ncm === 'string' ? entry.ncm : ''),
      barcode: typeof variantBarcodes[variantKey] === 'string'
        ? variantBarcodes[variantKey]
        : (typeof entry?.barcode === 'string' ? entry.barcode : ''),
      weightGrams: variantWeightGrams[variantKey]
        ? Number(variantWeightGrams[variantKey])
        : (typeof entry?.weightGrams === 'number' ? entry.weightGrams : null),
      images: Array.isArray(variantImages[variantKey])
        ? variantImages[variantKey]
        : (Array.isArray(entry?.images) ? entry.images : []),
      attribute_values: attributeValueIds,
      active: !isVariantDisabled(variantKey),
      isHighlighted: highlightedVariantKeys[variantKey] === true,
      preferredSellableLocationIds: preferredSellableLocationIds.length > 0 ? preferredSellableLocationIds : undefined,
    };
  }

  function buildVariantsFromDbData() {
    const entries: any[] = Array.isArray((product as any)?.__variantsData)
      ? (product as any).__variantsData
      : [];

    if (!entries.length) {
      return [];
    }

    const valueById = buildAttributeValueLookupMap();
    return entries.map((entry) => mapVariantsDataEntryToDisplayVariant(entry, valueById));
  }

  // Generate variants from selected attribute values (ordered by attribute sort_order)
  function generateVariants(selectedMapOverride?: Record<number, number[]>) {
    if (erpIntegrated) {
      return buildVariantsFromDbData();
    }
    const newVariants: Array<
      Partial<ProductVariant> & {
        variantKey: string;
        combinationLabel: string;
        selectedValues: Array<{
          attributeId: number;
          attributeCode: string;
          attributeName: string;
          valueId: number;
          valueName: string;
          valueCode: string;
        }>;
        basePrice: number | null;
        cost: number | null;
        ncm: string;
        barcode: string;
        attribute_values: number[];
        images: string[];
        active: boolean;
        isHighlighted: boolean;
        preferredSellableLocationIds: number[];
      }
    > = [];

    const allAttributes = (attributes?.attributes || [])
      .slice()
      .sort((a, b) => {
        const bySortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (bySortOrder !== 0) return bySortOrder;
        return a.name.localeCompare(b.name);
      });

    const selectedAttributeMap = selectedMapOverride || selectedAttributeValuesByAttribute;

    const selectedAttributeGroups = allAttributes
      .map((attribute) => {
        const selectedIds = selectedAttributeMap[attribute.id] || [];
        if (!selectedIds.length) return null;

        const valuesById = new Map(
          (attribute.values || []).map((value) => [value.id, value] as const)
        );
        const values = selectedIds
          .map((valueId) => valuesById.get(valueId))
          .filter((value): value is Attribute['values'][number] => Boolean(value));

        if (!values.length) return null;

        return { attribute, values };
      })
      .filter((group): group is { attribute: Attribute; values: Attribute['values'] } => Boolean(group));

    if (!selectedAttributeGroups.length) {
      const variantKey = '_default';
      const parsedBasePrice = variantBasePrices[variantKey] ? parseFloat(variantBasePrices[variantKey]) : NaN;
      const parsedCost = variantCosts[variantKey] ? parseFloat(variantCosts[variantKey]) : NaN;
      const parsedPromotionalPrice = variantPromotionalPrices[variantKey] ? parseFloat(variantPromotionalPrices[variantKey]) : NaN;

      const basePrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : (product?.basePrice ?? 0);
      const cost = Number.isFinite(parsedCost) ? parsedCost : (product?.cost ?? null);
      const promotionalPrice = Number.isFinite(parsedPromotionalPrice) ? parsedPromotionalPrice : null;

      const preferredSellableLocationIds = (variantPreferredSellableLocations[variantKey] || [])
        .map((idStr) => {
          const id = Number(idStr);
          return Number.isInteger(id) && id > 0 ? id : null;
        })
        .filter((id): id is number => id !== null);

      newVariants.push({
        id: variantIdsByKey[variantKey] || '',
        variantKey,
        combinationLabel: 'Padrão',
        selectedValues: [],
        color: 'Único',
        size: 'ÚNICO',
        variantSku: erpIntegrated
          ? getErpVariantSkuFromDb({
              variantId: variantIdsByKey[variantKey] || null,
              variantKey,
            })
          : displayVariantSku(variantKey, {
              variantId: variantIdsByKey[variantKey],
            }, form.getValues('sku')),
        stock: normalizeStockInputByMode(variantStocks[variantKey] || 0),
        priceOverride: promotionalPrice,
        basePrice,
        cost,
        ncm: variantNcms[variantKey] || '',
        barcode: variantBarcodes[variantKey] || '',
        weightGrams: variantWeightGrams[variantKey] ? Number(variantWeightGrams[variantKey]) : null,
        images: Array.isArray(defaultImages) ? defaultImages : [],
        attribute_values: [],
        active: !isVariantDisabled(variantKey),
        isHighlighted: highlightedVariantKeys[variantKey] === true,
        preferredSellableLocationIds: preferredSellableLocationIds.length > 0 ? preferredSellableLocationIds : undefined,
      });

      return newVariants;
    }

    const combinations: Array<Array<{
      attribute: Attribute;
      value: Attribute['values'][number];
    }>> = [];

    function buildCombinations(
      groupIndex: number,
      partial: Array<{ attribute: Attribute; value: Attribute['values'][number] }>
    ) {
      if (groupIndex >= selectedAttributeGroups.length) {
        combinations.push([...partial]);
        return;
      }

      const group = selectedAttributeGroups[groupIndex];
      group.values.forEach((value) => {
        partial.push({ attribute: group.attribute, value });
        buildCombinations(groupIndex + 1, partial);
        partial.pop();
      });
    }

    buildCombinations(0, []);

    combinations.forEach((combination) => {
      const attributeValueIds = combination.map((item) => item.value.id);
      const variantKey = buildVariantKeyFromAttributeValues(attributeValueIds);

      const parsedBasePrice = variantBasePrices[variantKey] ? parseFloat(variantBasePrices[variantKey]) : NaN;
      const parsedCost = variantCosts[variantKey] ? parseFloat(variantCosts[variantKey]) : NaN;
      const parsedPromotionalPrice = variantPromotionalPrices[variantKey] ? parseFloat(variantPromotionalPrices[variantKey]) : NaN;
      const basePrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : (product?.basePrice ?? 0);
      const cost = Number.isFinite(parsedCost) ? parsedCost : (product?.cost ?? null);
      const promotionalPrice = Number.isFinite(parsedPromotionalPrice) ? parsedPromotionalPrice : null;

      const colorSelection = combination.find((item) => isColorAttribute(item.attribute));
      const sizeSelection = combination.find((item) => isSizeAttribute(item.attribute));

      const colorName = colorSelection?.value.name || 'Único';
      const sizeName = (sizeSelection?.value.name || sizeSelection?.value.code || 'Único').toUpperCase();

      const colorObj = typeof colorSelection?.value.id === 'number'
        ? colors.find((color) => color.attributeValueId === colorSelection.value.id)
        : undefined;

      const imageGroupKey = buildImageGroupKey(
        variantKey,
        combination.map((item) => ({
          attributeId: item.attribute.id,
          valueId: item.value.id,
        }))
      );

      const legacyImageGroupKey = buildLegacyImageGroupKey(
        variantKey,
        combination.map((item) => ({
          attributeId: item.attribute.id,
          valueId: item.value.id,
        }))
      );

      const variantSpecificImages = resolveImagesForGroup(
        imageGroupKey,
        legacyImageGroupKey,
        variantKey,
        imageGroupKey === 'product'
          ? (Array.isArray(defaultImages) ? defaultImages : [])
          : (Array.isArray(colorObj?.images) ? colorObj.images : []),
      );

      const synthesizedSku = erpIntegrated
        ? ''
        : (() => {
          const skuSuffix = combination
            .map((item) => String(item.value.code || item.value.name || '').trim().toUpperCase())
            .filter(Boolean)
            .join('-');
          return skuSuffix
            ? `${form.getValues('sku')}-${skuSuffix}`
            : form.getValues('sku');
        })();

      const preferredSellableLocationIds = (variantPreferredSellableLocations[variantKey] || [])
        .map((idStr) => {
          const id = Number(idStr);
          return Number.isInteger(id) && id > 0 ? id : null;
        })
        .filter((id): id is number => id !== null);

      newVariants.push({
        id: (() => {
          if (!erpIntegrated) {
            return variantIdsByKey[variantKey] || '';
          }
          const matchedEntry = getErpVariantEntryFromDb({
            variantId: variantIdsByKey[variantKey] || null,
            variantKey,
            attributeValueIds,
            color: colorName,
            size: sizeName,
          });
          if (matchedEntry?.id != null) {
            return String(matchedEntry.id);
          }
          return variantIdsByKey[variantKey] || '';
        })(),
        variantKey,
        combinationLabel: combination
          .map((item) => `${item.attribute.name}: ${item.value.name || item.value.code}`)
          .join(' • '),
        selectedValues: combination.map((item) => ({
          attributeId: item.attribute.id,
          attributeCode: item.attribute.code,
          attributeName: item.attribute.name,
          valueId: item.value.id,
          valueName: item.value.name,
          valueCode: item.value.code,
        })),
        color: colorName,
        size: sizeName,
        variantSku: erpIntegrated
          ? getErpVariantSkuFromDb({
              variantId: variantIdsByKey[variantKey] || null,
              variantKey,
              attributeValueIds,
              color: colorName,
              size: sizeName,
            })
          : displayVariantSku(
              variantKey,
              {
                color: colorName,
                size: sizeName,
                variantId: variantIdsByKey[variantKey],
                attributeValueIds,
              },
              synthesizedSku,
            ),
        stock: normalizeStockInputByMode(variantStocks[variantKey] || 0),
        priceOverride: promotionalPrice,
        basePrice,
        cost,
        ncm: variantNcms[variantKey] || '',
        barcode: variantBarcodes[variantKey] || '',
        weightGrams: variantWeightGrams[variantKey] ? Number(variantWeightGrams[variantKey]) : null,
        images: variantSpecificImages,
        attribute_values: attributeValueIds,
        active: !isVariantDisabled(variantKey),
        isHighlighted: highlightedVariantKeys[variantKey] === true,
        preferredSellableLocationIds: preferredSellableLocationIds.length > 0 ? preferredSellableLocationIds : undefined,
      });
    });

    return newVariants;
  }

  function applyVariantPriceToAll(
    type: 'cost' | 'base' | 'promo',
    sourceKey: string,
    targetVariantKeys?: string[]
  ) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const allowedKeys = new Set(
      (targetVariantKeys && targetVariantKeys.length > 0)
        ? targetVariantKeys
        : variantsList.map((variant) => variant.variantKey)
    );

    if (type === 'cost') {
      const sourceValue = variantCosts[sourceKey] ?? "";
      setVariantCosts((prev) => {
        const next = { ...prev };
        variantsList.forEach((variant) => {
          const key = variant.variantKey;
          if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
            next[key] = sourceValue;
          }
        });
        return next;
      });
      return;
    }

    if (type === 'base') {
      const sourceValue = variantBasePrices[sourceKey] ?? "";
      setVariantBasePrices((prev) => {
        const next = { ...prev };
        variantsList.forEach((variant) => {
          const key = variant.variantKey;
          if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
            next[key] = sourceValue;
          }
        });
        return next;
      });
      return;
    }

    const sourceValue = variantPromotionalPrices[sourceKey] ?? "";
    setVariantPromotionalPrices((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
          next[key] = sourceValue;
        }
      });
      return next;
    });
  }

  function applyVariantStockToAll(sourceKey: string) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const sourceValue = normalizeStockInputByMode(variantStocks[sourceKey] ?? 0);

    setVariantStocks((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key !== sourceKey && !isVariantDisabled(key)) {
          next[key] = sourceValue;
        }
      });
      return next;
    });
  }

  function applyVariantSellableLocationsToAll(sourceKey: string) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const sourceValue = [...(variantPreferredSellableLocations[sourceKey] || [])];

    setVariantPreferredSellableLocations((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key === sourceKey || isVariantDisabled(key)) {
          return;
        }

        if (sourceValue.length > 0) {
          next[key] = [...sourceValue];
        } else {
          delete next[key];
        }
      });
      return next;
    });
  }

  function applyVariantNcmToAll(sourceKey: string, targetVariantKeys?: string[]) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const allowedKeys = new Set(
      (targetVariantKeys && targetVariantKeys.length > 0)
        ? targetVariantKeys
        : variantsList.map((variant) => variant.variantKey)
    );

    const sourceValue = variantNcms[sourceKey] ?? "";
    setVariantNcms((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
          next[key] = sourceValue;
        }
      });
      return next;
    });
  }

  function applyVariantBarcodeToAll(sourceKey: string, targetVariantKeys?: string[]) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const allowedKeys = new Set(
      (targetVariantKeys && targetVariantKeys.length > 0)
        ? targetVariantKeys
        : variantsList.map((variant) => variant.variantKey)
    );

    const sourceValue = variantBarcodes[sourceKey] ?? "";
    setVariantBarcodes((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
          next[key] = sourceValue;
        }
      });
      return next;
    });
  }

  function applyVariantWeightToAll(sourceKey: string, targetVariantKeys?: string[]) {
    const variantsList = generateVariants();
    if (isVariantDisabled(sourceKey)) {
      return;
    }

    const allowedKeys = new Set(
      (targetVariantKeys && targetVariantKeys.length > 0)
        ? targetVariantKeys
        : variantsList.map((variant) => variant.variantKey)
    );

    const sourceValue = variantWeightGrams[sourceKey] ?? "";
    setVariantWeightGrams((prev) => {
      const next = { ...prev };
      variantsList.forEach((variant) => {
        const key = variant.variantKey;
        if (key !== sourceKey && allowedKeys.has(key) && !isVariantDisabled(key)) {
          next[key] = sourceValue;
        }
      });
      return next;
    });
  }

  // Gera um código único para o atributo (color ou size)
  function generateUniqueCode(name: string, existingCodes: string[]): string {
    let code = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Se o código já existe, adiciona um número
    if (existingCodes.includes(code)) {
      let counter = 1;
      while (existingCodes.includes(`${code}-${counter}`)) {
        counter++;
      }
      code = `${code}-${counter}`;
    }

    return code;
  }

  // Upload default images
  async function uploadDefaultImages(files: FileList) {
    setIsUploadingDefault(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('imageType', 'productImage');
        formData.append('folder', `products/${form.getValues('sku') || 'new'}`);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha no upload');
        return result.url as string;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setDefaultImages([...defaultImages, ...uploadedUrls]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploadingDefault(false);
    }
  }

  async function uploadProductColorImages(colorId: string, files: FileList) {
    setUploadingColorImageId(colorId);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('imageType', 'productImage');
        formData.append('folder', `products/${form.getValues('sku') || 'new'}/colors/${colorId}`);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha no upload');
        return result.url as string;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setColors((prev) => prev.map((color) =>
        color.id === colorId
          ? { ...color, images: [...(color.images || []), ...uploadedUrls] }
          : color
      ));
    } catch (error) {
      console.error('Upload color image error:', error);
      toast.error('Falha no upload da imagem da cor');
    } finally {
      setUploadingColorImageId(null);
    }
  }

  function removeProductColorImage(colorId: string, imageIndex: number) {
    setColors((prev) => prev.map((color) =>
      color.id === colorId
        ? { ...color, images: (color.images || []).filter((_, idx) => idx !== imageIndex) }
        : color
    ));
  }

  // Add tag
  function addTag() {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    setTags([...tags, newTag.trim()]);
    setNewTag("");
  }

  function reorderStoreSizes(fromSize: string, toSize: string) {
    if (!fromSize || !toSize || fromSize === toSize) return;

    const fromIndex = storeSizesDisplayOrder.indexOf(fromSize);
    const toIndex = storeSizesDisplayOrder.indexOf(toSize);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...storeSizesDisplayOrder];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setStoreSizesDisplayOrder(next);

    void persistStoreSizesOrder(next);
  }

  function moveStoreSize(size: string, direction: 'up' | 'down') {
    const currentIndex = storeSizesDisplayOrder.indexOf(size);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetSize = storeSizesDisplayOrder[targetIndex];
    if (!targetSize) return;

    reorderStoreSizes(size, targetSize);
  }

  async function persistStoreSizesOrder(nextOrder: string[]) {
    const normalizedCodes = ['size', 'sizes', 'tamanho', 'tamanhos'];
    const sizeValues = (attributes?.attributes || [])
      .filter((attribute) => normalizedCodes.includes(String(attribute.code || '').trim().toLowerCase()))
      .flatMap((attribute) =>
        attribute.values.map((value) => ({
          id: value.id,
          label: (value.name || value.code || '').trim().toUpperCase(),
          sortOrder: Number(value.sort_order ?? 0),
        }))
      )
      .filter((entry) => entry.label.length > 0);

    if (!sizeValues.length) return;

    const valuesByLabel = new Map<string, Array<{ id: number; sortOrder: number }>>();
    sizeValues.forEach((entry) => {
      const list = valuesByLabel.get(entry.label) || [];
      list.push({ id: entry.id, sortOrder: entry.sortOrder });
      valuesByLabel.set(entry.label, list);
    });

    const updates: Array<{ id: number; sortOrder: number }> = [];
    let nextSortOrder = 0;

    nextOrder.forEach((sizeLabel) => {
      const entries = valuesByLabel.get(sizeLabel) || [];
      entries.forEach((entry) => {
        if (entry.sortOrder !== nextSortOrder) {
          updates.push({ id: entry.id, sortOrder: nextSortOrder });
        }
        nextSortOrder += 1;
      });
    });

    if (!updates.length) return;

    setIsSavingStoreSizesOrder(true);
    try {
      const results = await Promise.all(
        updates.map((update) => updateAttributeValueSortOrder(update.id, update.sortOrder))
      );

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        toast.error('Falha ao ordenar tamanhos', {
          description: 'Não foi possível salvar a nova ordem de todos os tamanhos.',
        });
        return;
      }

      await onRefreshAttributes?.();
      toast('Ordem atualizada', {
        description: 'A nova ordem dos tamanhos foi salva.',
      });
    } finally {
      setIsSavingStoreSizesOrder(false);
    }
  }

  async function persistManagedSizeValuesOrder(orderedIds: number[]) {
    if (!orderedIds.length) return;

    const valueById = new Map(managedSizeValues.map((value) => [value.id, value]));
    const updates = orderedIds
      .map((id, sortOrder) => ({
        id,
        sortOrder,
        currentSortOrder: valueById.get(id)?.sortOrder ?? 0,
      }))
      .filter((entry) => entry.currentSortOrder !== entry.sortOrder);

    if (!updates.length) return;

    setIsSavingStoreSizesOrder(true);
    try {
      const results = await Promise.all(
        updates.map((update) => updateAttributeValueSortOrder(update.id, update.sortOrder))
      );

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        toast.error('Falha ao ordenar tamanhos', {
          description: 'Não foi possível salvar a nova ordem de todos os tamanhos.',
        });
        return;
      }

      await onRefreshAttributes?.();
      toast('Ordem atualizada', {
        description: 'A nova ordem dos tamanhos foi salva.',
      });
    } finally {
      setIsSavingStoreSizesOrder(false);
    }
  }

  function moveManagedSizeValue(valueId: number, direction: 'up' | 'down') {
    const orderedIds = managedSizeValues.map((value) => value.id);
    const currentIndex = orderedIds.indexOf(valueId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const next = [...orderedIds];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

    void persistManagedSizeValuesOrder(next);
  }

  async function saveManagedSizeValueName(valueId: number, currentName: string) {
    const nextName = (sizeValueNameDrafts[valueId] || '').trim();
    if (!nextName || nextName === currentName) return;

    setSavingSizeValueId(valueId);
    const result = await updateAttributeValue(valueId, { name: nextName });
    setSavingSizeValueId(null);

    if (!result.success) {
      toast.error('Falha ao atualizar tamanho', {
        description: result.error || 'Não foi possível atualizar o nome.',
      });
      return;
    }

    await onRefreshAttributes?.();
    toast('Tamanho atualizado', {
      description: `Nome alterado para "${nextName}".`,
    });
  }

  function handleStoreSizeDragStart(size: string) {
    setDraggedStoreSize(size);
  }

  function handleStoreSizeDragOver(event: React.DragEvent<HTMLButtonElement>, size: string) {
    event.preventDefault();
    if (draggedStoreSize && draggedStoreSize !== size) {
      setDragOverStoreSize(size);
    }
  }

  function handleStoreSizeDragLeave() {
    setDragOverStoreSize(null);
  }

  function handleStoreSizeDrop(event: React.DragEvent<HTMLButtonElement>, targetSize: string) {
    event.preventDefault();
    if (!draggedStoreSize || draggedStoreSize === targetSize) {
      setDragOverStoreSize(null);
      setDraggedStoreSize(null);
      return;
    }

    reorderStoreSizes(draggedStoreSize, targetSize);
    setDragOverStoreSize(null);
    setDraggedStoreSize(null);
  }

  function handleStoreSizeDragEnd() {
    setDragOverStoreSize(null);
    setDraggedStoreSize(null);
  }

  async function removeStoreSize(size: string) {
    const sizeAttributesFromStore = (attributes?.attributes || []).filter((attribute) =>
      ['size', 'sizes', 'tamanho', 'tamanhos'].includes(String(attribute.code || '').trim().toLowerCase())
    );
    const sizeValue = sizeAttributesFromStore
      .flatMap((attribute) => attribute.values || [])
      .find((value) => (value.name || value.code || '').trim().toUpperCase() === size);

    if (!sizeValue) return;

    setSelectedAttributeValuesByAttribute((prev) => {
      if (!sizeAttributesFromStore.length) return prev;

      const next = { ...prev };
      sizeAttributesFromStore.forEach((attribute) => {
        const matchingIds = (attribute.values || [])
          .filter((value) => (value.name || value.code || '').trim().toUpperCase() === size)
          .map((value) => value.id);

        if (!matchingIds.length) return;
        const selected = next[attribute.id] || [];
        next[attribute.id] = selected.filter((id) => !matchingIds.includes(id));
      });

      return next;
    });

    setStoreSizeSelections((prev) => prev.filter((entry) => entry !== size));
    setSizes((prev) => prev.filter((entry) => entry !== size));
    setStoreSizesDisplayOrder((prev) => prev.filter((entry) => entry !== size));

    const result = await deleteAttributeValue(sizeValue.id);
    if (result.success) {
      await onRefreshAttributes?.();
      toast('Tamanho removido', {
        description: 'O tamanho foi removido do catálogo.',
      });
    } else {
      toast.error('Falha ao remover', {
        description: 'Não foi possível remover o tamanho.',
      });
    }
  }

  async function handleCreateStoreSize() {
    const normalizedSize = normalizeStoreSizeLabel(newStoreSize);
    if (!normalizedSize) return;

    const alreadyAvailable = storeSizeOptions.includes(normalizedSize);
    if (alreadyAvailable) {
      setNewStoreSize("");
      toast('Tamanho já existe', {
        description: 'O tamanho já está cadastrado no catálogo da loja.',
      });
      return;
    }

    if (!storeId) {
      toast.error('Loja não identificada', {
        description: 'Não foi possível criar o tamanho sem o storeId.',
      });
      return;
    }

    setIsAddingStoreSize(true);
    try {
      const result = await createSizeValue(normalizedSize, storeId);
      if (!result.success) {
        toast.error('Falha ao adicionar', {
          description: 'Não foi possível criar o tamanho na loja.',
        });
        return;
      }

      setNewStoreSize("");
      await onRefreshAttributes?.();
      toast('Tamanho adicionado', {
        description: 'O tamanho foi criado no catálogo da loja.',
      });
    } finally {
      setIsAddingStoreSize(false);
    }
  }

  function isAttributeValueSelected(attribute: Attribute, valueId: number) {
    return (selectedAttributeValuesByAttribute[attribute.id] || []).includes(valueId);
  }

  function toggleAttributeValue(attribute: Attribute, valueId: number) {
    if (erpIntegrated) {
      toast.error(ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE);
      return;
    }

    const currentlySelected = (selectedAttributeValuesByAttribute[attribute.id] || []).includes(valueId);

    const current = selectedAttributeValuesByAttribute[attribute.id] || [];
    const next = currentlySelected
      ? current.filter((id) => id !== valueId)
      : [...current, valueId];

    const nextSelectedMap: Record<number, number[]> = {
      ...selectedAttributeValuesByAttribute,
      [attribute.id]: next,
    };

    if (next.length === 0) {
      delete nextSelectedMap[attribute.id];
    }

    setSelectedAttributeValuesByAttribute(nextSelectedMap);

    // Ao selecionar novamente um valor (ex.: cor), reativa variantes que incluem esse valor.
    if (!currentlySelected) {
      const nextGeneratedVariantKeySet = new Set(
        generateVariants(nextSelectedMap).map((variant) => variant.variantKey)
      );

      setDisabledVariantKeys((prev) =>
        prev.filter((variantKey) => {
          if (!variantKey || variantKey === '_default') return true;
          const valueIds = variantKey
            .split('|')
            .map((entry) => Number(entry))
            .filter((entry) => Number.isInteger(entry) && entry > 0);

          const includesSelectedValue = valueIds.includes(valueId);
          const existsInNextSelection = nextGeneratedVariantKeySet.has(variantKey);

          // Mantém desativada se não voltou para o conjunto gerado atual.
          if (!includesSelectedValue || !existsInNextSelection) {
            return true;
          }

          // Remove da lista de desativadas quando a variante foi recriada pela seleção atual.
          return false;
        })
      );
    }
  }

  function reorderSelectedAttributeValue(attributeId: number, fromValueId: number, toValueId: number) {
    if (erpIntegrated) return;
    if (!fromValueId || !toValueId || fromValueId === toValueId) return;

    const current = selectedAttributeValuesByAttribute[attributeId] || [];
    const fromIndex = current.indexOf(fromValueId);
    const toIndex = current.indexOf(toValueId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setSelectedAttributeValuesByAttribute((prev) => ({
      ...prev,
      [attributeId]: next,
    }));
  }

  function handleSelectedAttributeValueDragStart(
    event: React.DragEvent<HTMLElement>,
    attributeId: number,
    valueId: number,
  ) {
    setDraggedSelectedAttributeValue({ attributeId, valueId });
    event.dataTransfer.setData('text/plain', `${attributeId}:${valueId}`);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleSelectedAttributeValueDragOver(
    event: React.DragEvent<HTMLElement>,
    attributeId: number,
    targetValueId: number,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!draggedSelectedAttributeValue) return;
    if (draggedSelectedAttributeValue.attributeId !== attributeId) return;
    if (draggedSelectedAttributeValue.valueId === targetValueId) return;
    setDragOverSelectedAttributeValue({ attributeId, valueId: targetValueId });
  }

  function handleSelectedAttributeValueDrop(
    event: React.DragEvent<HTMLElement>,
    attributeId: number,
    targetValueId: number,
  ) {
    event.preventDefault();
    const transferRaw = event.dataTransfer.getData('text/plain');
    const [transferAttributeRaw, transferValueRaw] = transferRaw.split(':');
    const transferAttributeId = Number(transferAttributeRaw);
    const transferValueId = Number(transferValueRaw);
    const source =
      Number.isInteger(transferAttributeId) && transferAttributeId > 0 && Number.isInteger(transferValueId) && transferValueId > 0
        ? { attributeId: transferAttributeId, valueId: transferValueId }
        : draggedSelectedAttributeValue;

    if (!source) {
      setDragOverSelectedAttributeValue(null);
      return;
    }

    if (source.attributeId !== attributeId) {
      setDragOverSelectedAttributeValue(null);
      setDraggedSelectedAttributeValue(null);
      return;
    }

    reorderSelectedAttributeValue(attributeId, source.valueId, targetValueId);
    setDragOverSelectedAttributeValue(null);
    setDraggedSelectedAttributeValue(null);
  }

  function handleSelectedAttributeValueDragEnd() {
    setDragOverSelectedAttributeValue(null);
    setDraggedSelectedAttributeValue(null);
  }

  // Handle form submit
  function buildFormData(values: ProductFormValues) {
    // Imagens globais do produto (fallback para produtos sem imagens por variante)
    let finalImages = defaultImages;

    const fd = new FormData();
    fd.append('name', values.name);
    fd.append('slug', values.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    fd.append('sku', erpIntegrated && product?.sku ? product.sku : values.sku);
    fd.append('description', values.description || '');
    fd.append('materials', values.materials || '');
    fd.append('measures', values.measures || '');
    fd.append('measurementTableId', values.measurementTableId || '');
    const effectiveSelectedAttributeValuesByAttribute = (() => {
      const nextMap: Record<number, number[]> = {
        ...selectedAttributeValuesByAttribute,
      };

      const allAttributes = attributes?.attributes || [];
      const currentAttributeIds = new Set(allAttributes.map((attr) => attr.id));

      // Remover chaves de atributos que foram deletados ou já não existem
      Object.keys(nextMap).forEach((key) => {
        const attrId = Number(key);
        if (!currentAttributeIds.has(attrId)) {
          delete nextMap[attrId];
        }
      });

      // Remover chaves com arrays vazios (para não enviar ao backend)
      Object.keys(nextMap).forEach((key) => {
        const attrId = Number(key);
        const validValueIds = new Set(
          (allAttributes.find((attribute) => attribute.id === attrId)?.values || []).map((value) => value.id)
        );

        nextMap[attrId] = (nextMap[attrId] || []).filter((id) => validValueIds.has(id));

        if (Array.isArray(nextMap[attrId]) && nextMap[attrId].length === 0) {
          delete nextMap[attrId];
        }
      });

      return nextMap;
    })();

    const generatedVariants = generateVariants(effectiveSelectedAttributeValuesByAttribute);
    const compactVariantsBase = generatedVariants.length > 0
      ? generatedVariants.map((variant) => ({
          variantId: variant.id ? String(variant.id) : null,
          variantSku: erpIntegrated
            ? (typeof variant.variantSku === 'string' ? variant.variantSku.trim() : '')
            : variant.variantSku,
          color: variant.color,
          size: variant.size,
          active: variant.active !== false,
          isHighlighted: variant.isHighlighted === true,
          preferredSellableLocationIds: Array.isArray(variant.preferredSellableLocationIds)
            ? variant.preferredSellableLocationIds
            : [],
          stock: typeof variant.stock === 'number' ? variant.stock : 0,
          basePrice: typeof variant.basePrice === 'number' ? variant.basePrice : null,
          cost: typeof variant.cost === 'number' ? variant.cost : null,
          ncm: typeof variant.ncm === 'string' ? variant.ncm : '',
          barcode: typeof (variant as any).barcode === 'string' ? (variant as any).barcode : '',
          weightGrams: typeof (variant as any).weightGrams === 'number' ? (variant as any).weightGrams : null,
          priceOverride: typeof variant.priceOverride === 'number' ? variant.priceOverride : null,
          images: Array.isArray(variant.images) ? variant.images : [],
          attribute_values: Array.isArray(variant.attribute_values) ? variant.attribute_values : [],
        }))
      : [{
          variantId: variantIdsByKey['_default'] ? String(variantIdsByKey['_default']) : null,
          variantSku: resolveSubmittedVariantSku('_default', undefined, values.sku),
          color: '',
          size: '',
          active: true,
          isHighlighted: false,
          preferredSellableLocationIds: [],
          stock: typeof variantStocks['_default'] === 'number' ? variantStocks['_default'] : 0,
          basePrice: variantBasePrices['_default'] != null ? Number(variantBasePrices['_default']) : (product?.basePrice ?? 0),
          cost: variantCosts['_default'] != null ? Number(variantCosts['_default']) : (product?.cost ?? null),
          priceOverride: variantPromotionalPrices['_default'] != null ? Number(variantPromotionalPrices['_default']) : null,
          ncm: variantNcms['_default'] ?? '',
          barcode: variantBarcodes['_default'] ?? '',
          weightGrams: variantWeightGrams['_default'] ? Number(variantWeightGrams['_default']) : null,
          images: Array.isArray(defaultImages) ? defaultImages : [],
          attribute_values: [],
        }];

    const compactVariantKeySet = new Set(
      compactVariantsBase.map((variant) =>
        Array.isArray(variant.attribute_values)
          ? buildVariantKeyFromAttributeValues(
              variant.attribute_values
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
            )
          : '_default'
      )
    );

    const existingVariantsData = Array.isArray((product as any)?.__variantsData)
      ? (product as any).__variantsData
      : [];
    const existingVariantByKey = new Map<string, any>();
    const attributeIdByValueId = new Map<number, number>();
    (attributes?.attributes || []).forEach((attribute) => {
      (attribute.values || []).forEach((value) => {
        attributeIdByValueId.set(value.id, attribute.id);
      });
    });
    existingVariantsData.forEach((entry: any) => {
      const attributeValueIds = Array.isArray(entry?.attributeValueIds)
        ? entry.attributeValueIds
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
        : [];

      const rawCombinationKey = typeof entry?.combinationKey === 'string'
        ? entry.combinationKey.trim().toLowerCase()
        : '';

      const key = attributeValueIds.length > 0
        ? buildVariantKeyFromAttributeValues(attributeValueIds)
        : (entry?.isSimpleProduct === true || rawCombinationKey === '_default')
          ? '_default'
          : '';

      if (key) {
        existingVariantByKey.set(key, entry);
      }
    });

    const inactiveMissingVariants = Array.from(existingVariantByKey.entries())
      .filter(([variantKey]) => !compactVariantKeySet.has(variantKey))
      .map(([variantKey, existing]) => {
        const attributeValues = variantKey === '_default'
          ? []
          : variantKey
              .split('|')
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value) && value > 0);

        const selectedValuesForGrouping = attributeValues
          .map((valueId) => {
            const attributeId = attributeIdByValueId.get(valueId);
            if (!attributeId) return null;
            return {
              attributeId,
              valueId,
            };
          })
          .filter((value): value is { attributeId: number; valueId: number } => Boolean(value));

        const imageGroupKey = buildImageGroupKey(variantKey, selectedValuesForGrouping);
        const legacyImageGroupKey = buildLegacyImageGroupKey(variantKey, selectedValuesForGrouping);
        const resolvedImages = resolveImagesForGroup(
          imageGroupKey,
          legacyImageGroupKey,
          variantKey,
          imageGroupKey === 'product'
            ? (Array.isArray(defaultImages) ? defaultImages : [])
            : (Array.isArray(existing?.images) ? existing.images : []),
        );

        const preferredSellableLocationIds = (variantPreferredSellableLocations[variantKey] || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0);

        const basePriceFromState = variantBasePrices[variantKey] != null ? Number(variantBasePrices[variantKey]) : null;
        const costFromState = variantCosts[variantKey] != null ? Number(variantCosts[variantKey]) : null;
        const promoFromState = variantPromotionalPrices[variantKey] != null ? Number(variantPromotionalPrices[variantKey]) : null;

        return {
          variantId: existing?.id != null ? String(existing.id) : null,
          variantSku: resolveSubmittedVariantSku(
            variantKey,
            existing,
            values.sku,
            attributeValues,
          ),
          color: typeof existing?.color === 'string' ? existing.color : '',
          size: typeof existing?.size === 'string' ? existing.size : '',
          active: false,
          isHighlighted: false,
          preferredSellableLocationIds,
          stock: typeof variantStocks[variantKey] === 'number'
            ? variantStocks[variantKey]
            : (typeof existing?.stock === 'number' ? existing.stock : 0),
          basePrice: Number.isFinite(basePriceFromState)
            ? basePriceFromState
            : (typeof existing?.basePrice === 'number' ? existing.basePrice : (product?.basePrice ?? 0)),
          cost: Number.isFinite(costFromState)
            ? costFromState
            : (typeof existing?.cost === 'number' ? existing.cost : (product?.cost ?? null)),
          ncm: typeof variantNcms[variantKey] === 'string'
            ? variantNcms[variantKey]
            : (typeof existing?.ncm === 'string' ? existing.ncm : ''),
          barcode: typeof variantBarcodes[variantKey] === 'string'
            ? variantBarcodes[variantKey]
            : (typeof existing?.barcode === 'string' ? existing.barcode : ''),
          weightGrams: variantWeightGrams[variantKey]
            ? Number(variantWeightGrams[variantKey])
            : (typeof existing?.weightGrams === 'number' ? existing.weightGrams : null),
          priceOverride: Number.isFinite(promoFromState)
            ? promoFromState
            : (typeof existing?.priceOverride === 'number' ? existing.priceOverride : null),
          images: resolvedImages,
          attribute_values: attributeValues,
        };
      });

    const compactVariants = (() => {
      const byKey = new Map<string, (typeof compactVariantsBase)[number]>();
      const entries = [...compactVariantsBase, ...inactiveMissingVariants];

      entries.forEach((variant) => {
        const key = Array.isArray(variant.attribute_values)
          ? buildVariantKeyFromAttributeValues(
              variant.attribute_values
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
            )
          : '_default';

        const current = byKey.get(key);
        if (!current) {
          byKey.set(key, variant);
          return;
        }

        // Para a mesma combinação, prioriza sempre a versão ativa.
        if (current.active === false && variant.active !== false) {
          byKey.set(key, variant);
          return;
        }

        if (current.active !== false && variant.active === false) {
          return;
        }

        // Empate: mantém o mais recente.
        byKey.set(key, variant);
      });

      return Array.from(byKey.values());
    })();

    const allAttrs = attributes?.attributes || [];
    const colorAttrIds = new Set(
      allAttrs
        .filter((a) => ['color', 'colors', 'cor', 'cores'].includes(a.code.toLowerCase()))
        .map((a) => a.id)
    );
    const selectedColorValueIds = new Set(
      Object.entries(effectiveSelectedAttributeValuesByAttribute)
        .filter(([attrId]) => colorAttrIds.has(Number(attrId)))
        .flatMap(([, ids]) => ids)
    );
    const compactColors = colors
      .filter((color) => {
        const vid = normalizeColorAttributeValueId(color.attributeValueId);
        return typeof vid === 'number' && selectedColorValueIds.has(vid);
      })
      .map((color) => ({
        name: color.name,
        images: Array.isArray(color.images) ? color.images : [],
      }));

    const sizeAttrIds = new Set(
      allAttrs
        .filter((a) => ['size', 'sizes', 'tamanho', 'tamanhos'].includes(a.code.toLowerCase()))
        .map((a) => a.id)
    );
    const derivedSizes = Array.from(
      new Set(
        allAttrs
          .filter((a) => sizeAttrIds.has(a.id))
          .flatMap((a) => {
            const selectedIds = new Set(effectiveSelectedAttributeValuesByAttribute[a.id] || []);
            return (a.values || [])
              .filter((v) => selectedIds.has(v.id))
              .map((v) => (v.name || v.code || '').trim().toUpperCase())
              .filter(Boolean);
          })
      )
    );
    const firstVariantBasePrice = generatedVariants.find((variant) => typeof variant.basePrice === 'number')?.basePrice;
    const firstVariantCost = generatedVariants.find((variant) => typeof variant.cost === 'number')?.cost;
    const fallbackBasePrice = firstVariantBasePrice ?? product?.basePrice ?? 0;
    const fallbackCost = firstVariantCost ?? product?.cost ?? null;

    fd.append('basePrice', String(fallbackBasePrice));
    fd.append('cost', fallbackCost !== null ? String(fallbackCost) : '');
    const categoryIds = selectedCategoryIds.length > 0
      ? selectedCategoryIds
      : (values.categoryId ? [values.categoryId] : []);

    fd.append('categoryId', categoryIds[0] || '');
    fd.append('categoryIds', JSON.stringify(categoryIds));
    fd.append('isActive', values.isActive.toString());
    fd.append('isFeatured', values.isFeatured.toString());
    fd.append('tags', JSON.stringify(tags));
    fd.append('images', JSON.stringify(finalImages));
    fd.append('sizes', JSON.stringify(derivedSizes));
    fd.append('colors', JSON.stringify(compactColors));
    fd.append('attributeValuesByAttribute', JSON.stringify(effectiveSelectedAttributeValuesByAttribute));
    fd.append('imageGroupingType', imageGroupingType);
    fd.append('imageGroupingAttributeIds', JSON.stringify(selectedImageGroupingAttributeIds));
    fd.append('videoGroupingType', videoGroupingType);
    fd.append('videoGroupingAttributeIds', JSON.stringify(selectedVideoGroupingAttributeIds));

    const existingMeta = product?.meta && typeof product.meta === 'object'
      ? { ...(product.meta as Record<string, unknown>) }
      : {};
    const enabledProductFields = productCustomFieldDefs.filter((field) => field.enabled);
    const customFieldsPayload = enabledProductFields.reduce<Record<string, unknown>>((acc, field) => {
      if (field.type === 'MULTI_UPLOAD') {
        const rawList = productCustomFieldValues[field.id];
        const fileList = Array.isArray(rawList)
          ? rawList.map((entry) => String(entry).trim()).filter(Boolean)
          : [];

        if (fileList.length > 0) {
          acc[field.id] = fileList;
        }
        return acc;
      }

      const rawValue = String(productCustomFieldValues[field.id] || '').trim();

      if (rawValue.length === 0) {
        return acc;
      }

      if (field.type === 'NUMBER') {
        const numeric = Number(rawValue.replace(',', '.'));
        if (Number.isFinite(numeric)) {
          acc[field.id] = numeric;
        }
        return acc;
      }

      acc[field.id] = rawValue;
      return acc;
    }, {});

    existingMeta.custom_fields = customFieldsPayload;
    fd.append('meta', JSON.stringify(existingMeta));

    // Generate and add variants
    fd.append('variants', JSON.stringify(compactVariants));

    return fd;
  }

  async function handleSubmit(values: ProductFormValues) {
    try {
      await onSubmit(buildFormData(values));
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao salvar produto');
    }
  }

  const hasColors = colors.length > 0;
  const sizeAttributes = (attributes?.attributes || []).filter((attribute) =>
    ['size', 'sizes', 'tamanho', 'tamanhos'].includes(attribute.code.toLowerCase())
  );

  console.log('📏 Size attributes:', sizeAttributes);
  console.log('📦 All attributes:', attributes?.attributes);

  const storeSizeOptions = (() => {
    const orderedValues = sizeAttributes
      .flatMap((attribute) =>
        attribute.values.map((value) => ({
          label: (value.name || value.code || '').trim().toUpperCase(),
          sortOrder: Number(value.sort_order ?? 0),
          code: String(value.code || '').trim().toUpperCase(),
        }))
      )
      .filter((entry) => entry.label.length > 0)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.code.localeCompare(b.code);
      });

    const uniqueOrdered: string[] = [];
    const seen = new Set<string>();
    orderedValues.forEach((entry) => {
      if (seen.has(entry.label)) return;
      seen.add(entry.label);
      uniqueOrdered.push(entry.label);
    });

    return uniqueOrdered;
  })();

  console.log('📐 storeSizeOptions calculado:', storeSizeOptions);
  console.log('📋 sizes (selecionados no produto):', sizes);

  const availableSizes = Array.from(new Set([...storeSizeOptions, ...storeSizeSelections, ...sizes]));
  const availableSizesKey = availableSizes.join('|');

  useEffect(() => {
    setStoreSizesDisplayOrder(availableSizes);
  }, [availableSizesKey]);
  const imageColorVariants = colors.filter((color) => activeProductColorIds.includes(color.id));
  const generatedVariants = generateVariants();
  const generatedVariantKeys = useMemo(
    () => new Set(generatedVariants.map((variant) => variant.variantKey)),
    [generatedVariants]
  );
  const displayVariants = useMemo(() => {
    if (erpIntegrated) {
      return generatedVariants;
    }

    const existingVariantsData = Array.isArray((product as any)?.__variantsData)
      ? (product as any).__variantsData
      : [];

    if (!existingVariantsData.length) {
      return generatedVariants;
    }

    const valueById = new Map<number, { id: number; name: string; code: string; attributeId: number; attributeCode: string; attributeName: string }>();
    (attributes?.attributes || []).forEach((attribute) => {
      (attribute.values || []).forEach((value) => {
        valueById.set(value.id, {
          id: value.id,
          name: value.name || value.code || String(value.id),
          code: value.code || value.name || String(value.id),
          attributeId: attribute.id,
          attributeCode: attribute.code,
          attributeName: attribute.name,
        });
      });
    });

    const extras = existingVariantsData
      .map((entry: any) => {
        const attributeValueIds = Array.isArray(entry?.attributeValueIds)
          ? entry.attributeValueIds
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isInteger(value) && value > 0)
          : [];

        const rawCombinationKey = typeof entry?.combinationKey === 'string'
          ? entry.combinationKey.trim().toLowerCase()
          : '';

        const variantKey = attributeValueIds.length > 0
          ? buildVariantKeyFromAttributeValues(attributeValueIds)
          : (entry?.isSimpleProduct === true || rawCombinationKey === '_default')
            ? '_default'
            : '';

        if (!variantKey || generatedVariantKeys.has(variantKey)) {
          return null;
        }

        if (!disabledVariantKeys.includes(variantKey)) {
          return null;
        }

        const selectedValues = attributeValueIds
          .map((valueId: number) => {
            const value = valueById.get(valueId);
            if (!value) return null;
            return {
              attributeId: value.attributeId,
              attributeCode: value.attributeCode,
              attributeName: value.attributeName,
              valueId: value.id,
              valueName: value.name,
              valueCode: value.code,
            };
          })
          .filter((value): value is {
            attributeId: number;
            attributeCode: string;
            attributeName: string;
            valueId: number;
            valueName: string;
            valueCode: string;
          } => Boolean(value));

        const preferredSellableLocationIds = (variantPreferredSellableLocations[variantKey] || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0);

        return {
          id: variantIdsByKey[variantKey] || (entry?.id != null ? String(entry.id) : ''),
          variantKey,
          combinationLabel: selectedValues.length > 0
            ? selectedValues.map((value) => `${value.attributeName}: ${value.valueName}`).join(' • ')
            : 'Padrão',
          selectedValues,
          color: typeof entry?.color === 'string' ? entry.color : 'Único',
          size: typeof entry?.size === 'string' ? String(entry.size).toUpperCase() : 'ÚNICO',
          variantSku: resolveSubmittedVariantSku(
            variantKey,
            entry,
            form.getValues('sku'),
            attributeValueIds,
          ),
          stock: normalizeStockInputByMode(
            typeof variantStocks[variantKey] === 'number'
              ? variantStocks[variantKey]
              : (typeof entry?.stock === 'number' ? entry.stock : 0)
          ),
          priceOverride: variantPromotionalPrices[variantKey] != null
            ? Number(variantPromotionalPrices[variantKey])
            : (typeof entry?.priceOverride === 'number' ? entry.priceOverride : null),
          basePrice: variantBasePrices[variantKey] != null
            ? Number(variantBasePrices[variantKey])
            : (typeof entry?.basePrice === 'number' ? entry.basePrice : (product?.basePrice ?? 0)),
          cost: variantCosts[variantKey] != null
            ? Number(variantCosts[variantKey])
            : (typeof entry?.cost === 'number' ? entry.cost : (product?.cost ?? null)),
          ncm: typeof variantNcms[variantKey] === 'string'
            ? variantNcms[variantKey]
            : (typeof entry?.ncm === 'string' ? entry.ncm : ''),
          barcode: typeof variantBarcodes[variantKey] === 'string'
            ? variantBarcodes[variantKey]
            : (typeof entry?.barcode === 'string' ? entry.barcode : ''),
          weightGrams: variantWeightGrams[variantKey]
            ? Number(variantWeightGrams[variantKey])
            : (typeof entry?.weightGrams === 'number' ? entry.weightGrams : null),
          images: Array.isArray(variantImages[variantKey])
            ? variantImages[variantKey]
            : (Array.isArray(entry?.images) ? entry.images : []),
          attribute_values: attributeValueIds,
          active: false,
          isHighlighted: highlightedVariantKeys[variantKey] === true,
          preferredSellableLocationIds: preferredSellableLocationIds.length > 0 ? preferredSellableLocationIds : undefined,
        };
      })
      .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));

    return [...generatedVariants, ...extras];
  }, [
    generatedVariants,
    generatedVariantKeys,
    product,
    attributes?.attributes,
    disabledVariantKeys,
    variantIdsByKey,
    variantSkuOverrides,
    variantStocks,
    variantPromotionalPrices,
    variantBasePrices,
    variantCosts,
    variantNcms,
    variantBarcodes,
    variantWeightGrams,
    variantImages,
    highlightedVariantKeys,
    variantPreferredSellableLocations,
    form,
    erpIntegrated,
  ]);
  const selectedVariantForDrawer = useMemo(
    () => displayVariants.find((variant) => variant.variantKey === variantDrawerKey) || null,
    [displayVariants, variantDrawerKey]
  );
  const variantAttributeFilterGroups = useMemo(() => {
    const normalizeToken = (value: string) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const isDimensionLikeAttribute = (attributeCode: string) => {
      const code = normalizeToken(attributeCode);
      return ['dimensao-total', 'dimensao', 'tamanho', 'size', 'sizes'].includes(code);
    };

    const parseDimensionLabel = (label: string): { width: number; height: number; area: number } | null => {
      const normalized = String(label || '').toLowerCase().replace(/cm/g, '').replace(/\s+/g, '');
      const match = normalized.match(/(\d+(?:[\.,]\d+)?)x(\d+(?:[\.,]\d+)?)/i);
      if (!match) return null;

      const width = Number(match[1].replace(',', '.'));
      const height = Number(match[2].replace(',', '.'));
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

      return { width, height, area: width * height };
    };

    const attributeSortOrder = new Map<number, number>(
      (attributes?.attributes || []).map((attribute) => [attribute.id, attribute.sort_order ?? 0])
    );

    const attributeById = new Map<number, Attribute>(
      (attributes?.attributes || []).map((attribute) => [attribute.id, attribute])
    );

    const groups = new Map<
      number,
      {
        attributeId: number;
        attributeCode: string;
        attributeName: string;
        attributeSortOrder: number;
        options: Map<number, { valueId: number; label: string; optionSortOrder: number }>;
      }
    >();

    displayVariants.forEach((variant) => {
      variant.selectedValues.forEach((value) => {
        const attributeDef = attributeById.get(value.attributeId);
        const optionDef = attributeDef?.values?.find((item) => item.id === value.valueId);
        const existingGroup = groups.get(value.attributeId) || {
          attributeId: value.attributeId,
          attributeCode: value.attributeCode,
          attributeName: value.attributeName,
          attributeSortOrder: attributeSortOrder.get(value.attributeId) ?? 0,
          options: new Map<number, { valueId: number; label: string; optionSortOrder: number }>(),
        };

        if (!existingGroup.options.has(value.valueId)) {
          existingGroup.options.set(value.valueId, {
            valueId: value.valueId,
            label: value.valueName || value.valueCode,
            optionSortOrder: optionDef?.sort_order ?? 0,
          });
        }

        groups.set(value.attributeId, existingGroup);
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        options: Array.from(group.options.values()).sort((left, right) => {
          const bySortOrder = (left.optionSortOrder ?? 0) - (right.optionSortOrder ?? 0);
          if (bySortOrder !== 0) return bySortOrder;

          if (isDimensionLikeAttribute(group.attributeCode)) {
            const leftDimension = parseDimensionLabel(left.label);
            const rightDimension = parseDimensionLabel(right.label);

            if (leftDimension && rightDimension) {
              if (leftDimension.area !== rightDimension.area) {
                return leftDimension.area - rightDimension.area;
              }

              if (leftDimension.width !== rightDimension.width) {
                return leftDimension.width - rightDimension.width;
              }

              if (leftDimension.height !== rightDimension.height) {
                return leftDimension.height - rightDimension.height;
              }
            }
          }

          return left.label.localeCompare(right.label, 'pt-BR', { numeric: true, sensitivity: 'base' });
        }),
      }))
      .sort((left, right) => {
        const bySortOrder = left.attributeSortOrder - right.attributeSortOrder;
        if (bySortOrder !== 0) return bySortOrder;
        return left.attributeName.localeCompare(right.attributeName);
      });
  }, [displayVariants, attributes?.attributes]);

  const filteredVariants = useMemo(() => {
    if (!variantAttributeFilterGroups.length) {
      if (variantStatusFilter === 'all') {
        return displayVariants;
      }

      return displayVariants.filter((variant) => {
        const disabled = isVariantDisabled(variant.variantKey);
        return variantStatusFilter === 'disabled' ? disabled : !disabled;
      });
    }

    return displayVariants.filter((variant) =>
      variantAttributeFilterGroups.every((group) => {
        const selectedValueId = variantAttributeFilters[group.attributeId] || 'all';
        if (selectedValueId === 'all') return true;

        const numericValueId = Number(selectedValueId);
        if (!Number.isInteger(numericValueId)) return true;

        return variant.selectedValues.some(
          (selectedValue) =>
            selectedValue.attributeId === group.attributeId &&
            selectedValue.valueId === numericValueId
        );
      }) && (() => {
        if (variantStatusFilter === 'all') return true;
        const disabled = isVariantDisabled(variant.variantKey);
        return variantStatusFilter === 'disabled' ? disabled : !disabled;
      })()
    );
  }, [displayVariants, variantAttributeFilterGroups, variantAttributeFilters, variantStatusFilter, disabledVariantKeys]);

  const filteredVariantKeys = useMemo(
    () => filteredVariants.map((variant) => variant.variantKey),
    [filteredVariants]
  );

  useEffect(() => {
    if (!variantAttributeFilterGroups.length) {
      if (Object.keys(variantAttributeFilters).length > 0) {
        setVariantAttributeFilters({});
      }
      return;
    }

    setVariantAttributeFilters((prev) => {
      const validAttributeIds = new Set(variantAttributeFilterGroups.map((group) => group.attributeId));
      const next: Record<number, string> = {};
      let changed = false;

      Object.entries(prev).forEach(([attributeIdRaw, selectedValueId]) => {
        const attributeId = Number(attributeIdRaw);
        if (!validAttributeIds.has(attributeId)) {
          changed = true;
          return;
        }

        const group = variantAttributeFilterGroups.find((item) => item.attributeId === attributeId);
        if (!group) {
          changed = true;
          return;
        }

        if (selectedValueId === 'all') {
          next[attributeId] = 'all';
          return;
        }

        const hasValue = group.options.some((option) => String(option.valueId) === selectedValueId);
        if (!hasValue) {
          changed = true;
          next[attributeId] = 'all';
          return;
        }

        next[attributeId] = selectedValueId;
      });

      return changed ? next : prev;
    });
  }, [variantAttributeFilterGroups, variantAttributeFilters]);

  const activeVariantFilterCount = Object.values(variantAttributeFilters).filter(
    (value) => value && value !== 'all'
  ).length + (variantStatusFilter === 'all' ? 0 : 1);

  const isWmsManagedStock = stockModeConfig === 'WMS';

  const sellableLocations = useMemo(() => {
    return wmsLocations
      .filter((location) => location.active && String(location.type || '').toUpperCase() === 'SELLABLE')
      .sort((a, b) => {
        if (a.warehouse_id !== b.warehouse_id) return a.warehouse_id - b.warehouse_id;
        return a.code.localeCompare(b.code);
      });
  }, [wmsLocations]);

  const visibleTabs = useMemo(() => {
    const baseTabs = [
      { value: 'general', visible: true },
      { value: 'information', visible: true },
      { value: 'categories', visible: hasProductTabPermission.categories },
      { value: 'attributes', visible: true },
      { value: 'images', visible: hasProductTabPermission.images },
      { value: 'videos', visible: hasProductTabPermission.videos },
      { value: 'prices', visible: hasProductTabPermission.pricesView },
      { value: 'stock', visible: hasProductTabPermission.inventoryView },
      { value: 'ncm', visible: hasProductTabPermission.variants },
    ] as const;

    return baseTabs.filter((tab) => tab.visible).map((tab) => tab.value);
  }, [
    hasProductTabPermission.categories,
    hasProductTabPermission.images,
    hasProductTabPermission.videos,
    hasProductTabPermission.pricesView,
    hasProductTabPermission.inventoryView,
    hasProductTabPermission.variants,
  ]);

  const activeTabIndex = Math.max(0, visibleTabs.indexOf(activeTab as (typeof visibleTabs)[number]));

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(activeTab as (typeof visibleTabs)[number])) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

  const storeAttributes = useMemo(() => {
    return (attributes?.attributes || []).slice().sort((a, b) => {
      const bySortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (bySortOrder !== 0) return bySortOrder;
      return a.name.localeCompare(b.name);
    });
  }, [attributes?.attributes]);

  function getImageGroupingTypeLabel(type: ImageGroupingType): string {
    if (type === 'product') return 'Por Produto';
    if (type === 'attributes') return 'Por Atributos';
    return 'Por SKU Completo';
  }

  function hasExistingProductImages(): boolean {
    if (Array.isArray(defaultImages) && defaultImages.some((url) => String(url || '').trim().length > 0)) {
      return true;
    }

    return Object.values(variantImages).some(
      (images) => Array.isArray(images) && images.some((url) => String(url || '').trim().length > 0)
    );
  }

  function applyImageGroupingTypeChange(type: ImageGroupingType) {
    imageGroupingUserChangedRef.current = true;
    setImageGroupingType(type);
    if (type !== 'attributes') {
      setSelectedImageGroupingAttributeIds([]);
      return;
    }

    if (selectedImageGroupingAttributeIds.length === 0 && selectedProductAttributes.length > 0) {
      setSelectedImageGroupingAttributeIds([selectedProductAttributes[0].id]);
    }
  }

  function handleImageGroupingTypeChange(type: ImageGroupingType) {
    if (type === imageGroupingType) return;

    if (hasExistingProductImages()) {
      setPendingImageGroupingType(type);
      setImageGroupingChangeDialogOpen(true);
      return;
    }

    applyImageGroupingTypeChange(type);
  }

  function confirmImageGroupingTypeChange() {
    if (pendingImageGroupingType) {
      applyImageGroupingTypeChange(pendingImageGroupingType);
    }
    setPendingImageGroupingType(null);
    setImageGroupingChangeDialogOpen(false);
  }

  function cancelImageGroupingTypeChange() {
    setPendingImageGroupingType(null);
    setImageGroupingChangeDialogOpen(false);
  }

  function toggleImageGroupingAttribute(attributeId: number) {
    setSelectedImageGroupingAttributeIds((prev) =>
      prev.includes(attributeId)
        ? prev.filter((id) => id !== attributeId)
        : [...prev, attributeId]
    );
  }

  function handleVideoGroupingTypeChange(type: ImageGroupingType) {
    videoGroupingUserChangedRef.current = true;
    setVideoGroupingType(type);
    if (type !== 'attributes') {
      setSelectedVideoGroupingAttributeIds([]);
      return;
    }

    if (selectedVideoGroupingAttributeIds.length === 0 && selectedProductAttributes.length > 0) {
      setSelectedVideoGroupingAttributeIds([selectedProductAttributes[0].id]);
    }
  }

  function toggleVideoGroupingAttribute(attributeId: number) {
    setSelectedVideoGroupingAttributeIds((prev) =>
      prev.includes(attributeId)
        ? prev.filter((id) => id !== attributeId)
        : [...prev, attributeId]
    );
  }

  const imageGroupsForEditor = (() => {
    const baseSku = form.getValues('sku') || product?.sku || 'N/A';
    const fallbackVariantIds = Array.isArray((product as any)?.__allVariantIds)
      ? (product as any).__allVariantIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
    const toSkuToken = (valueName?: string, valueCode?: string) =>
      String(valueName || valueCode || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9\-_]/g, '');

    if (!generatedVariants.length) {
      return [{
        key: 'product',
        label: 'Produto',
        imageSku: baseSku,
        images: defaultImages,
        variantIds: fallbackVariantIds,
      }];
    }

    const groups = new Map<string, { key: string; label: string; imageSku: string; images: string[]; variantIds: number[] }>();

    generatedVariants.forEach((variant) => {
      const selectedValues = variant.selectedValues.map((value) => ({
        attributeId: value.attributeId,
        valueId: value.valueId,
      }));

      const key = buildImageGroupKey(variant.variantKey, selectedValues);
      const legacyKey = buildLegacyImageGroupKey(variant.variantKey, selectedValues);
      const variantId = Number(variant.id);

      if (groups.has(key)) {
        const existingGroup = groups.get(key);
        if (existingGroup && Number.isInteger(variantId) && variantId > 0 && !existingGroup.variantIds.includes(variantId)) {
          existingGroup.variantIds.push(variantId);
        }
        return;
      }

      let label = 'Produto';
      if (key.startsWith('sku:')) {
        label = variant.combinationLabel || variant.variantSku;
      } else if (key.startsWith('attr:')) {
        const attrsSet = new Set(selectedImageGroupingAttributeIds);
        const attrLabel = variant.selectedValues
          .filter((value) => attrsSet.has(value.attributeId))
          .map((value) => `${value.attributeName}: ${value.valueName || value.valueCode}`)
          .join(' • ');
        label = attrLabel || 'Produto';
      }

      let imageSku = baseSku;
      if (key.startsWith('sku:')) {
        imageSku = variant.variantSku || baseSku;
      } else if (key.startsWith('attr:')) {
        const attrsSet = new Set(selectedImageGroupingAttributeIds);
        const groupedSkuSuffix = variant.selectedValues
          .filter((value) => attrsSet.has(value.attributeId))
          .map((value) => toSkuToken(value.valueName, value.valueCode))
          .filter(Boolean)
          .join('-');

        imageSku = groupedSkuSuffix
          ? `${baseSku}-${groupedSkuSuffix}`
          : baseSku;
      }

      groups.set(key, {
        key,
        label,
        imageSku,
        variantIds: Number.isInteger(variantId) && variantId > 0 ? [variantId] : [],
        images: resolveImagesForGroup(key, legacyKey, variant.variantKey, []),
      });
    });

    return Array.from(groups.values());
  })();

  const variantIdsByImageGroupKey = useMemo(() => {
    const next: Record<string, number[]> = {};
    imageGroupsForEditor.forEach((group) => {
      next[group.key] = Array.isArray(group.variantIds)
        ? group.variantIds.filter((id) => Number.isInteger(id) && id > 0)
        : [];
    });
    return next;
  }, [imageGroupsForEditor]);

  const videoGroupsForEditor = (() => {
    const baseSku = form.getValues('sku') || product?.sku || 'N/A';
    const fallbackVariantIds = Array.isArray((product as any)?.__allVariantIds)
      ? (product as any).__allVariantIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
    const toSkuToken = (valueName?: string, valueCode?: string) =>
      String(valueName || valueCode || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9\-_]/g, '');

    if (!generatedVariants.length) {
      return [{
        key: 'product',
        label: 'Produto',
        videoSku: baseSku,
        variantIds: fallbackVariantIds,
      }];
    }

    const groups = new Map<string, { key: string; label: string; videoSku: string; variantIds: number[] }>();

    generatedVariants.forEach((variant) => {
      const selectedValues = variant.selectedValues.map((value) => ({
        attributeId: value.attributeId,
        valueId: value.valueId,
      }));

      const key = buildVideoGroupKey(variant.variantKey, selectedValues);
      const variantId = Number(variant.id);

      if (groups.has(key)) {
        const existingGroup = groups.get(key);
        if (existingGroup && Number.isInteger(variantId) && variantId > 0 && !existingGroup.variantIds.includes(variantId)) {
          existingGroup.variantIds.push(variantId);
        }
        return;
      }

      let label = 'Produto';
      if (key.startsWith('sku:')) {
        label = variant.combinationLabel || variant.variantSku;
      } else if (key.startsWith('attr:')) {
        const attrsSet = new Set(selectedVideoGroupingAttributeIds);
        const attrLabel = variant.selectedValues
          .filter((value) => attrsSet.has(value.attributeId))
          .map((value) => `${value.attributeName}: ${value.valueName || value.valueCode}`)
          .join(' • ');
        label = attrLabel || 'Produto';
      }

      let videoSku = baseSku;
      if (key.startsWith('sku:')) {
        videoSku = variant.variantSku || baseSku;
      } else if (key.startsWith('attr:')) {
        const attrsSet = new Set(selectedVideoGroupingAttributeIds);
        const groupedSkuSuffix = variant.selectedValues
          .filter((value) => attrsSet.has(value.attributeId))
          .map((value) => toSkuToken(value.valueName, value.valueCode))
          .filter(Boolean)
          .join('-');

        videoSku = groupedSkuSuffix
          ? `${baseSku}-${groupedSkuSuffix}`
          : baseSku;
      }

      groups.set(key, {
        key,
        label,
        videoSku,
        variantIds: Number.isInteger(variantId) && variantId > 0 ? [variantId] : [],
      });
    });

    return Array.from(groups.values());
  })();

  const videoGroupsSignature = videoGroupsForEditor
    .map((group) => `${group.key}:${group.variantIds.join(',')}`)
    .join('|');

  useEffect(() => {
    if (!product?.id) {
      setVariantVideos({});
      hydratedVideoGroupsKeyRef.current = null;
      return;
    }

    const rawVideoGroups = (product as any)?.__videoGroups;
    if (!Array.isArray(rawVideoGroups) || videoGroupsForEditor.length === 0) {
      if (hydratedVideoGroupsKeyRef.current !== null) {
        setVariantVideos({});
        hydratedVideoGroupsKeyRef.current = null;
      }
      return;
    }

    const hydrationKey = [
      String(product.id),
      videoGroupsSignature,
      String(rawVideoGroups.length),
      String(videoGroupingType),
      selectedVideoGroupingAttributeIds.join(','),
    ].join('::');
    if (hydratedVideoGroupsKeyRef.current === hydrationKey) {
      return;
    }

    const nextVideos: Record<string, FormVideo | null> = {};
    const variantsData = Array.isArray((product as any)?.__variantsData)
      ? (product as any).__variantsData
      : [];

    const attributeValueIdsByVariantId = new Map<number, number[]>();
    variantsData.forEach((entry: any) => {
      const variantId = Number(entry?.id);
      if (!Number.isInteger(variantId) || variantId <= 0) return;

      const attributeValueIds = Array.isArray(entry?.attributeValueIds)
        ? entry.attributeValueIds
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
        : [];

      if (attributeValueIds.length > 0) {
        attributeValueIdsByVariantId.set(
          variantId,
          Array.from(new Set(attributeValueIds)).sort((a, b) => a - b)
        );
      }
    });

    const valueToAttributeMap = new Map<number, number>();
    (attributes?.attributes || []).forEach((attribute) => {
      (attribute.values || []).forEach((value) => {
        valueToAttributeMap.set(value.id, attribute.id);
      });
    });

    const buildVideoGroupKeyFromAttributeValues = (attributeValueIds: number[]) => {
      if (!attributeValueIds.length) {
        return 'product';
      }

      if (videoGroupingType === 'product') {
        return 'product';
      }

      if (videoGroupingType === 'full_sku') {
        return `sku:${[...attributeValueIds].sort((a, b) => a - b).join('-')}`;
      }

      const selectedAttributeIds = selectedVideoGroupingAttributeIds;
      if (!selectedAttributeIds.length) {
        return 'product';
      }

      const attrsSet = new Set(selectedAttributeIds);
      const groupedValues = attributeValueIds
        .map((valueId) => ({ valueId, attributeId: valueToAttributeMap.get(valueId) }))
        .filter((item): item is { valueId: number; attributeId: number } => Number.isInteger(item.attributeId) && attrsSet.has(item.attributeId));

      if (!groupedValues.length) {
        return 'product';
      }

      return `attr:${groupedValues
        .sort((a, b) => a.attributeId - b.attributeId || a.valueId - b.valueId)
        .map((item) => item.valueId)
        .join('-')}`;
    };

    const normalizeGroupToken = (value: unknown) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-_]/g, '');

    videoGroupsForEditor.forEach((group) => {
      const matchedGroup = rawVideoGroups.find((candidate: any) => {
        const candidateVariantIds = Array.isArray(candidate?.variants)
          ? candidate.variants
              .map((variant: any) => Number(variant?.variant_id ?? variant?.id))
              .filter((value: number) => Number.isInteger(value) && value > 0)
          : [];

        const candidateImageKeyNormalized = normalizeGroupToken(
          candidate?.image_key ?? candidate?.variant_image_key ?? ''
        );
        const groupVideoSkuNormalized = normalizeGroupToken(group.videoSku);

        if (
          candidateImageKeyNormalized &&
          groupVideoSkuNormalized &&
          candidateImageKeyNormalized === groupVideoSkuNormalized
        ) {
          return true;
        }

        const candidateAttributeKey = (() => {
          if (!candidateVariantIds.length) {
            return null;
          }

          for (const variantId of candidateVariantIds) {
            const variantAttributeValueIds = attributeValueIdsByVariantId.get(variantId);
            if (!variantAttributeValueIds || variantAttributeValueIds.length === 0) {
              continue;
            }

            return buildVideoGroupKeyFromAttributeValues(variantAttributeValueIds);
          }

          return null;
        })();

        if (candidateAttributeKey && candidateAttributeKey === group.key) {
          return true;
        }

        if (group.variantIds.length === 0) {
          return candidateVariantIds.length === 0 || rawVideoGroups.length === 1;
        }

        return candidateVariantIds.some((value: number) => group.variantIds.includes(value));
      });

      const firstVideo = Array.isArray(matchedGroup?.videos) ? matchedGroup.videos[0] : null;
      const normalizedVideo = normalizeVideoRecord(firstVideo);
      if (normalizedVideo) {
        nextVideos[group.key] = normalizedVideo;
      }
    });

    setVariantVideos(nextVideos);
    hydratedVideoGroupsKeyRef.current = hydrationKey;
  }, [
    product?.id,
    videoGroupsSignature,
    attributes?.attributes,
    videoGroupingType,
    selectedVideoGroupingAttributeIds,
  ]);

  async function uploadImagesToGroup(
    groupKey: string,
    variantIds: number[],
    files: FileList,
    currentImages: string[] = []
  ) {
    setUploadingImageGroupKey(groupKey);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('imageType', 'productImage');
        formData.append('folder', `products/${form.getValues('sku') || 'new'}/groups/${encodeURIComponent(groupKey)}`);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha no upload');
        return result.url as string;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const mergedImages = [...(Array.isArray(currentImages) ? currentImages : []), ...uploadedUrls];

      if (product?.id) {
        const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');

        if (backendBase) {
          const baseDisplayOrder = Array.isArray(currentImages) ? currentImages.length : 0;

          const saveResponse = await fetch(`${backendBase}/products/${product.id}/images`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_key: groupKey,
              variant_ids: variantIds.length > 0 ? variantIds : undefined,
              images: uploadedUrls.map((url, index) => ({
                url,
                display_order: baseDisplayOrder + index,
                is_primary: baseDisplayOrder + index === 0,
              })),
            }),
          });

          if (!saveResponse.ok) {
            const errorText = await saveResponse.text().catch(() => '');
            throw new Error(errorText || 'Falha ao salvar imagens do grupo');
          }
        }
      }

      applyGroupImagesToLocalState(groupKey, mergedImages);
    } catch (error) {
      console.error('Upload group image error:', error);
      toast.error('Falha no upload da imagem');
    } finally {
      setUploadingImageGroupKey(null);
    }
  }

  function normalizeImageGroupToken(value: string) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');
  }

  async function fetchBestBackendImageGroup(groupKey: string, variantIds: number[]) {
    if (!product?.id) return null;

    const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');
    if (!backendBase) return null;

    const response = await fetch(`${backendBase}/products/${product.id}/image-groups`, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Falha ao carregar grupos de imagens');
    }

    const groups = await response.json();
    if (!Array.isArray(groups) || groups.length === 0) {
      return null;
    }

    const normalizedGroupKey = normalizeImageGroupToken(groupKey);
    const exactKeyMatch = groups.find((candidate: any) => {
      const key = normalizeImageGroupToken(String(candidate?.image_key || candidate?.variant_image_key || ''));
      return key.length > 0 && key === normalizedGroupKey;
    });

    if (exactKeyMatch) {
      return exactKeyMatch;
    }

    const validVariantIds = Array.isArray(variantIds)
      ? variantIds.filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (validVariantIds.length > 0) {
      let bestMatch: any = null;
      let bestScore = 0;

      for (const candidate of groups) {
        const candidateVariantIds = Array.isArray(candidate?.variants)
          ? candidate.variants
              .map((variant: any) => Number(variant?.variant_id ?? variant?.id))
              .filter((id: number) => Number.isInteger(id) && id > 0)
          : [];

        if (!candidateVariantIds.length) continue;

        const overlap = candidateVariantIds.filter((id: number) => validVariantIds.includes(id)).length;
        if (overlap > bestScore) {
          bestScore = overlap;
          bestMatch = candidate;
        }
      }

      if (bestMatch && bestScore > 0) {
        return bestMatch;
      }
    }

    if (groupKey === 'product') {
      if (groups.length === 1) {
        return groups[0];
      }

      return groups.reduce((best: any, candidate: any) => {
        const bestCount = Number(best?.variant_count ?? best?.variants?.length ?? 0);
        const candidateCount = Number(candidate?.variant_count ?? candidate?.variants?.length ?? 0);
        return candidateCount > bestCount ? candidate : best;
      }, groups[0]);
    }

    if (groups.length === 1) {
      return groups[0];
    }

    return null;
  }

  async function syncImageOrderForGroup(groupKey: string, variantIds: number[], currentImages?: string[]) {
    if (!product?.id) return;

    const backendGroup = await fetchBestBackendImageGroup(groupKey, variantIds);
    if (!backendGroup) return;

    const backendImages = Array.isArray(backendGroup?.images)
      ? [...backendGroup.images]
          .filter((image: any) => Number.isInteger(Number(image?.id)) && typeof image?.image_url === 'string')
          .sort((left: any, right: any) => {
            const byOrder = Number(left?.display_order ?? 0) - Number(right?.display_order ?? 0);
            if (byOrder !== 0) return byOrder;
            return Number(left?.id ?? 0) - Number(right?.id ?? 0);
          })
      : [];

    if (!backendImages.length) return;

    const localImages = Array.isArray(currentImages)
      ? currentImages
      : (groupKey === 'product'
        ? (Array.isArray(defaultImages) ? defaultImages : [])
        : (variantImages[groupKey] || []));

    if (!Array.isArray(localImages) || localImages.length === 0) return;

    const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');
    if (!backendBase) return;

    const idsByUrl = new Map<string, number[]>();
    backendImages.forEach((image: any) => {
      const url = String(image.image_url || '').trim();
      const id = Number(image.id);
      if (!url || !Number.isInteger(id) || id <= 0) return;
      const queue = idsByUrl.get(url) || [];
      queue.push(id);
      idsByUrl.set(url, queue);
    });

    const orderedIds: number[] = [];
    for (const url of localImages) {
      const queue = idsByUrl.get(String(url).trim()) || [];
      const id = queue.shift();
      if (!id) continue;
      orderedIds.push(id);
      idsByUrl.set(String(url).trim(), queue);
    }

    if (!orderedIds.length) return;

    const backendImageKey = String(backendGroup?.image_key || backendGroup?.variant_image_key || '').trim();
    if (!backendImageKey) return;

    const response = await fetch(`${backendBase}/products/${product.id}/image-groups/reorder`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_key: backendImageKey,
        ordered_image_ids: orderedIds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Falha ao sincronizar ordem das imagens');
    }
  }

  async function flushQueuedImageOrderSync(groupKey: string) {
    if (imageOrderSyncInFlightRef.current[groupKey]) return;

    const payload = queuedImageOrderSyncRef.current[groupKey];
    if (!payload) return;

    delete queuedImageOrderSyncRef.current[groupKey];
    imageOrderSyncInFlightRef.current[groupKey] = true;

    try {
      await syncImageOrderForGroup(groupKey, payload.variantIds, payload.images);
    } catch (error) {
      console.error('Sync group image order error:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao reordenar imagens do grupo');
    } finally {
      imageOrderSyncInFlightRef.current[groupKey] = false;
      if (queuedImageOrderSyncRef.current[groupKey]) {
        void flushQueuedImageOrderSync(groupKey);
      }
    }
  }

  function scheduleImageOrderSync(groupKey: string, variantIds: number[], images: string[]) {
    queuedImageOrderSyncRef.current[groupKey] = {
      variantIds,
      images,
    };

    void flushQueuedImageOrderSync(groupKey);
  }

  async function removeImageFromGroup(
    groupKey: string,
    variantIds: number[],
    currentImages: string[],
    imageIndex: number
  ) {
    const updatedImages = (Array.isArray(currentImages) ? currentImages : []).filter((_, idx) => idx !== imageIndex);

    applyGroupImagesToLocalState(groupKey, updatedImages);

    if (!product?.id) return;

    try {
      const backendGroup = await fetchBestBackendImageGroup(groupKey, variantIds);
      if (!backendGroup) return;

      const backendImages = Array.isArray(backendGroup?.images)
        ? [...backendGroup.images]
            .filter(
              (image: any) =>
                Number.isInteger(Number(image?.id)) && typeof image?.image_url === 'string'
            )
            .sort((left: any, right: any) => {
              const byOrder = Number(left?.display_order ?? 0) - Number(right?.display_order ?? 0);
              if (byOrder !== 0) return byOrder;
              return Number(left?.id ?? 0) - Number(right?.id ?? 0);
            })
        : [];

      const targetUrl = String((Array.isArray(currentImages) ? currentImages[imageIndex] : '') || '').trim();

      let target: any = backendImages[imageIndex];

      if (targetUrl) {
        const previousSameUrlCount = (Array.isArray(currentImages) ? currentImages : [])
          .slice(0, imageIndex)
          .reduce(
            (count, url) =>
              String(url || '').trim() === targetUrl ? count + 1 : count,
            0
          );

        const sameUrlCandidates = backendImages.filter(
          (image: any) => String(image?.image_url || '').trim() === targetUrl
        );

        if (sameUrlCandidates.length > previousSameUrlCount) {
          target = sameUrlCandidates[previousSameUrlCount];
        }
      }

      const imageId = Number(target?.id);
      if (!Number.isInteger(imageId) || imageId <= 0) {
        return;
      }

      const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');
      if (!backendBase) return;

      const response = await fetch(`${backendBase}/product-images/${imageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'Falha ao remover imagem do grupo');
      }

      await syncImageOrderForGroup(groupKey, variantIds, updatedImages);
    } catch (error) {
      console.error('Remove group image error:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao remover imagem do grupo');
    }
  }

  function getReorderedImages(images: string[], fromIndex: number, toIndex: number): string[] {
    if (!Array.isArray(images) || fromIndex < 0 || toIndex < 0) return images;
    if (fromIndex >= images.length || toIndex >= images.length || fromIndex === toIndex) return images;

    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function reorderImagesInGroup(
    groupKey: string,
    fromIndex: number,
    toIndex: number,
    currentImages?: string[]
  ): string[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      if (groupKey === 'product') {
        return defaultImages;
      }
      return Array.isArray(currentImages) ? currentImages : (variantImages[groupKey] || []);
    }

    if (groupKey === 'product') {
      const source = Array.isArray(defaultImages) ? defaultImages : [];
      const next = getReorderedImages(source, fromIndex, toIndex);
      setDefaultImages(next);
      return next;
    }

    const source = (Array.isArray(currentImages) && currentImages.length > 0)
      ? currentImages
      : (variantImages[groupKey] || []);

    const next = getReorderedImages(source, fromIndex, toIndex);
    setVariantImages((prev) => ({
      ...prev,
      [groupKey]: next,
    }));

    return next;
  }

  function buildImageDragId(groupKey: string, imageUrl: string, imageIndex: number) {
    return `${groupKey}::${imageIndex}::${imageUrl}`;
  }

  function handleImageGroupSortEnd(
    groupKey: string,
    variantIds: number[],
    currentImages: string[],
    event: DragEndEvent
  ) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const source = Array.isArray(currentImages)
      ? currentImages
      : (groupKey === 'product' ? defaultImages : (variantImages[groupKey] || []));
    if (!Array.isArray(source) || source.length <= 1) return;

    const ids = source.map((imageUrl, idx) => buildImageDragId(groupKey, imageUrl, idx));
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const reorderedImages = reorderImagesInGroup(groupKey, fromIndex, toIndex, source);

    if (product?.id) {
      scheduleImageOrderSync(groupKey, variantIds, reorderedImages);
    }
  }

  function normalizeVideoRecord(raw: any): FormVideo | null {
    if (!raw || typeof raw !== 'object') return null;

    const hlsUrl = String(raw.hls_url || raw.hlsUrl || '').trim();
    const mp4Url = String(raw.mp4_url || raw.mp4Url || raw.preview_url || raw.previewUrl || '').trim();
    const fallbackUrl = String(raw.url || raw.original_url || raw.originalUrl || '').trim();
    const url = hlsUrl || mp4Url || fallbackUrl;

    if (!url) return null;

    return {
      id: Number.isInteger(Number(raw.id)) ? Number(raw.id) : undefined,
      url,
      hlsUrl: hlsUrl || undefined,
      mp4Url: mp4Url || undefined,
      previewUrl: String(raw.preview_url || raw.previewUrl || '').trim() || undefined,
      thumbUrl: String(raw.thumb_url || raw.thumbUrl || '').trim() || undefined,
      externalId: String(raw.external_id || raw.externalId || '').trim() || undefined,
      name: String(raw.name || '').trim() || undefined,
      storagePath: String(raw.storage_path || raw.storagePath || '').trim() || undefined,
    };
  }

  function getPlayableVideoUrl(video: FormVideo | null | undefined) {
    if (!video) return '';
    return video.mp4Url || video.previewUrl || video.hlsUrl || video.url;
  }

  async function uploadVideoToGroup(groupKey: string, variantIds: number[], file: File) {
    if (!product?.id) {
      toast.error('Salve o produto antes de enviar vídeos');
      return;
    }

    const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');
    if (!backendBase) {
      toast.error('NEXT_PUBLIC_RUST_URL não configurado');
      return;
    }

    setUploadingVideoGroupKey(groupKey);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await fetch('/api/upload/video', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult?.error || 'Falha no upload do vídeo');
      }

      const saveResponse = await fetch(`${backendBase}/products/${product.id}/videos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant_image_key: groupKey,
          variant_ids: variantIds.length > 0 ? variantIds : undefined,
          videos: [
            {
              url: String(uploadResult?.url || uploadResult?.hlsUrl || '').trim(),
              name: file.name,
              storage_path: uploadResult?.videoGuid ? `bunny-stream/${uploadResult.videoGuid}` : undefined,
              preview_url: String(uploadResult?.mp4_480pUrl || uploadResult?.mp4_360pUrl || '').trim() || undefined,
              original_url: String(uploadResult?.url || '').trim() || undefined,
              hls_url: String(uploadResult?.hlsUrl || uploadResult?.url || '').trim() || undefined,
              mp4_url: String(uploadResult?.mp4_480pUrl || uploadResult?.mp4_360pUrl || '').trim() || undefined,
              external_id: String(uploadResult?.videoGuid || '').trim() || undefined,
            },
          ],
        }),
      });

      const saveResult = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveResult?.error || 'Falha ao salvar vídeo do produto');
      }

      const normalizedVideo = normalizeVideoRecord(saveResult);
      if (!normalizedVideo) {
        throw new Error('Vídeo salvo sem URL válida');
      }

      setVariantVideos((prev) => ({
        ...prev,
        [groupKey]: normalizedVideo,
      }));

      toast.success('Vídeo salvo com sucesso');
    } catch (error) {
      console.error('Upload group video error:', error);
      toast.error(error instanceof Error ? error.message : 'Falha no upload do vídeo');
    } finally {
      setUploadingVideoGroupKey(null);
    }
  }

  async function removeVideoFromGroup(groupKey: string, video: FormVideo | null | undefined) {
    if (!video?.id) {
      setVariantVideos((prev) => ({
        ...prev,
        [groupKey]: null,
      }));
      return;
    }

    const backendBase = process.env.NEXT_PUBLIC_RUST_URL?.replace(/\/$/, '');
    if (!backendBase) {
      toast.error('NEXT_PUBLIC_RUST_URL não configurado');
      return;
    }

    try {
      const response = await fetch(`${backendBase}/product-variant-videos/${video.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'Falha ao remover vídeo');
      }

      setVariantVideos((prev) => ({
        ...prev,
        [groupKey]: null,
      }));
      toast.success('Vídeo removido');
    } catch (error) {
      console.error('Remove group video error:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao remover vídeo');
    }
  }

  const [orderedStoreAttributes, setOrderedStoreAttributes] = useState<Attribute[]>([]);
  const [draggedAttributeId, setDraggedAttributeId] = useState<number | null>(null);
  const [dragOverAttributeId, setDragOverAttributeId] = useState<number | null>(null);

  useEffect(() => {
    setOrderedStoreAttributes((prev) => {
      if (!storeAttributes.length) {
        return prev.length ? [] : prev;
      }
      if (!prev.length) return storeAttributes;

      const latestById = new Map(storeAttributes.map((attribute) => [attribute.id, attribute]));
      const next: Attribute[] = [];

      // Preserva a ordem atual para atributos que ainda existem.
      prev.forEach((attribute) => {
        const latest = latestById.get(attribute.id);
        if (latest) {
          next.push(latest);
          latestById.delete(attribute.id);
        }
      });

      // Acrescenta atributos novos ao final, mantendo a ordem externa para os novos.
      storeAttributes.forEach((attribute) => {
        if (latestById.has(attribute.id)) {
          next.push(attribute);
          latestById.delete(attribute.id);
        }
      });

      if (next.length === prev.length && next.every((attribute, index) => attribute === prev[index])) {
        return prev;
      }

      return next;
    });
  }, [storeAttributes]);

  const selectedProductAttributes = orderedStoreAttributes.filter((attribute) => (attribute.values?.length || 0) > 0);

  const selectedManagedAttribute = selectedManagedAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedManagedAttributeId) || null
    : null;

  const selectedColorManagerAttribute = selectedColorManagerAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedColorManagerAttributeId) || null
    : null;

  const selectedSizeManagerAttribute = selectedSizeManagerAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedSizeManagerAttributeId) || null
    : orderedStoreAttributes.find((attribute) => isSizeAttribute(attribute)) || null;

  const managedSizeValues = useMemo(() => {
    const sourceAttributes = selectedSizeManagerAttributeId
      ? orderedStoreAttributes.filter((attribute) => attribute.id === selectedSizeManagerAttributeId)
      : orderedStoreAttributes.filter((attribute) => isSizeAttribute(attribute));

    return sourceAttributes
      .flatMap((attribute) =>
        (attribute.values || []).map((value) => ({
          id: value.id,
          name: (value.name || value.code || "").trim(),
          code: value.code,
          sortOrder: Number(value.sort_order ?? 0),
        }))
      )
      .filter((entry) => entry.name.length > 0)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true });
      });
  }, [orderedStoreAttributes, selectedSizeManagerAttributeId]);

  useEffect(() => {
    const nextDrafts: Record<number, string> = {};
    managedSizeValues.forEach((value) => {
      nextDrafts[value.id] = value.name;
    });
    setSizeValueNameDrafts(nextDrafts);
  }, [managedSizeValues]);

  const selectedAttributeForValuePicker = attributeValuePickerAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === attributeValuePickerAttributeId) || null
    : null;

  const valuePickerSearchNormalized = attributeValuePickerSearch.trim().toLowerCase();
  const filteredValuePickerOptions = (selectedAttributeForValuePicker?.values || []).filter((value) => {
    if (!valuePickerSearchNormalized) return true;
    const label = String(value.name || value.code || '').toLowerCase();
    return label.includes(valuePickerSearchNormalized);
  });

  useEffect(() => {
    if (!attributeValuePickerAttributeId) return;
    const exists = orderedStoreAttributes.some((attribute) => attribute.id === attributeValuePickerAttributeId);
    if (!exists) {
      setAttributeValuePickerAttributeId(null);
      setAttributeValuePickerSearch('');
    }
  }, [attributeValuePickerAttributeId, orderedStoreAttributes]);

  useEffect(() => {
    if (!erpIntegrated) return;
    setAttributeValuePickerAttributeId(null);
    setAttributeValuePickerSearch('');
  }, [erpIntegrated]);

  const nextAttributeSortOrder = orderedStoreAttributes.reduce((maxSortOrder, currentAttribute) => {
    const currentSortOrder = Number(currentAttribute.sort_order ?? 0);
    return Math.max(maxSortOrder, currentSortOrder);
  }, -1) + 1;

  function isColorAttribute(attribute: Attribute) {
    const code = String(attribute.code || "").trim().toLowerCase();
    return ["color", "colors", "cor", "cores"].includes(code);
  }

  function isSizeAttribute(attribute: Attribute) {
    const code = String(attribute.code || "").trim().toLowerCase();
    return ["size", "sizes", "tamanho", "tamanhos"].includes(code);
  }

  function openAttributeManager(attribute: Attribute) {
    if (isColorAttribute(attribute)) {
      setSelectedColorManagerAttributeId(attribute.id);
      setIsStoreColorsDrawerOpen(true);
      return;
    }

    if (isSizeAttribute(attribute)) {
      setSelectedSizeManagerAttributeId(attribute.id);
      setIsStoreSizesDrawerOpen(true);
      return;
    }

    setGenericAttributeDrawerMode("manage");
    setSelectedManagedAttributeId(attribute.id);
    setIsGenericAttributeDrawerOpen(true);
  }

  function openSelectedAttributeManager() {
    if (erpIntegrated && attributeManagerSelection === "new") {
      toast.error(ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE);
      return;
    }

    if (attributeManagerSelection === "color") {
      const firstColorAttribute = orderedStoreAttributes.find((attribute) => isColorAttribute(attribute));
      setSelectedColorManagerAttributeId(firstColorAttribute?.id ?? null);
      setIsStoreColorsDrawerOpen(true);
      return;
    }

    if (attributeManagerSelection === "size") {
      const firstSizeAttribute = orderedStoreAttributes.find((attribute) => isSizeAttribute(attribute));
      setSelectedSizeManagerAttributeId(firstSizeAttribute?.id ?? null);
      setIsStoreSizesDrawerOpen(true);
      return;
    }

    setGenericAttributeDrawerMode("create");
    setSelectedManagedAttributeId(null);
    setGenericCreateResetKey((prev) => prev + 1);
    setIsGenericAttributeDrawerOpen(true);
  }

  function handleAttributeManagerSelectionChange(value: "color" | "size" | "new") {
    if (erpIntegrated && value === "new") {
      toast.error('Atributos devem ser criados pelo ERP integrado');
      return;
    }

    setAttributeManagerSelection(value);

    if (value === "new") {
      setGenericAttributeDrawerMode("create");
      setSelectedManagedAttributeId(null);
    }
  }

  async function persistAttributeOrder(reordered: Attribute[], previousOrder: Attribute[]) {
    const updates = await Promise.all(
      reordered.map((attribute, sortOrder) =>
        updateStoreAttributeSortOrder({
          attributeId: attribute.id,
          sortOrder,
        })
      )
    );

    if (updates.some((result) => !result.success)) {
      toast.error('Falha ao ordenar atributo');
      setOrderedStoreAttributes(previousOrder);
      return;
    }

    toast.success('Ordem dos atributos atualizada');
  }

  function reorderAttributes(fromAttributeId: number, toAttributeId: number) {
    if (erpIntegrated) return;
    if (!fromAttributeId || !toAttributeId || fromAttributeId === toAttributeId) return;

    const fromIndex = orderedStoreAttributes.findIndex((attribute) => attribute.id === fromAttributeId);
    const toIndex = orderedStoreAttributes.findIndex((attribute) => attribute.id === toAttributeId);
    if (fromIndex === -1 || toIndex === -1) return;

    const previousOrder = [...orderedStoreAttributes];
    const reordered = [...orderedStoreAttributes];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const reorderedWithSort = reordered.map((attribute, index) => ({
      ...attribute,
      sort_order: index,
    }));

    setOrderedStoreAttributes(reorderedWithSort);
    void persistAttributeOrder(reorderedWithSort, previousOrder);
  }

  function handleAttributeDragStart(event: React.DragEvent<HTMLElement>, attributeId: number) {
    setDraggedAttributeId(attributeId);
    event.dataTransfer.setData('text/plain', String(attributeId));
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleAttributeDragOver(event: React.DragEvent<HTMLDivElement>, targetAttributeId: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedAttributeId && draggedAttributeId !== targetAttributeId) {
      setDragOverAttributeId(targetAttributeId);
    }
  }

  function handleAttributeDragLeave() {
    setDragOverAttributeId(null);
  }

  function handleAttributeDrop(event: React.DragEvent<HTMLDivElement>, targetAttributeId: number) {
    event.preventDefault();
    const transferRaw = event.dataTransfer.getData('text/plain');
    const transferId = Number(transferRaw);
    const sourceAttributeId = Number.isInteger(transferId) && transferId > 0 ? transferId : draggedAttributeId;

    if (!sourceAttributeId || sourceAttributeId === targetAttributeId) {
      setDragOverAttributeId(null);
      setDraggedAttributeId(null);
      return;
    }

    reorderAttributes(sourceAttributeId, targetAttributeId);
    setDragOverAttributeId(null);
    setDraggedAttributeId(null);
  }

  function handleAttributeDragEnd() {
    setDragOverAttributeId(null);
    setDraggedAttributeId(null);
  }

  function openDeleteAttributeDialog(attribute: Attribute) {
    if (erpIntegrated) {
      toast.error(ERP_BLOCKS_MANUAL_ATTRIBUTE_CREATION_MESSAGE);
      return;
    }

    setAttributeToDelete(attribute);
    setDeleteAttributeDialogOpen(true);
  }

  async function confirmDeleteAttribute() {
    if (!attributeToDelete) return;

    setIsDeletingAttribute(true);
    const result = await deleteStoreAttribute(attributeToDelete.id);
    setIsDeletingAttribute(false);

    if (!result.success) {
      toast.error('Falha ao remover atributo', {
        description: result.error || 'Não foi possível remover o atributo.',
      });
      return;
    }

    if (selectedManagedAttributeId === attributeToDelete.id) {
      setSelectedManagedAttributeId(null);
      setIsGenericAttributeDrawerOpen(false);
    }

    const removedName = attributeToDelete.name;
    setDeleteAttributeDialogOpen(false);
    setAttributeToDelete(null);
    await onRefreshAttributes?.();

    toast.success('Atributo removido', {
      description: `"${removedName}" foi removido com sucesso.`,
    });
  }

  const buildCategoryTree = (cats: Category[]) => {
    const tree: (Category & { children: Category[] })[] = [];
    const map = new Map<string, Category & { children: Category[] }>();

    cats.forEach(c => map.set(c.id, { ...c, children: [] }));
    cats.forEach(c => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(map.get(c.id)!);
      } else {
        tree.push(map.get(c.id)!);
      }
    });

    return tree;
  };

  const getAncestorIds = (categoryId: string, cats: Category[]): string[] => {
    const cat = cats.find(c => c.id === categoryId);
    if (!cat || !cat.parentId) return [];
    return [cat.parentId, ...getAncestorIds(cat.parentId, cats)];
  };

  const renderCategoryNode = (node: Category & { children: Category[] }, level = 0, field: any) => {
    const checked = selectedCategoryIds.includes(node.id);
    return (
      <div key={node.id} className={`flex flex-col gap-2 ${level === 0 ? 'break-inside-avoid mb-2' : ''}`}>
        <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -ml-1.5 rounded-md transition-colors w-full" style={{ paddingLeft: `${max(0, level * 20 + 6)}px` }}>
          <Checkbox
            checked={checked}
            onCheckedChange={(isChecked) => {
              const isSelected = isChecked === true;
              let next = [...selectedCategoryIds];
              if (isSelected) {
                const ancestors = getAncestorIds(node.id, categories);
                next = Array.from(new Set([...next, node.id, ...ancestors]));
              } else {
                next = next.filter(id => id !== node.id);
              }
              setSelectedCategoryIds(next);
              field.onChange(next[0] || "");
            }}
          />
          <span className="min-w-0 wrap-break-word text-sm font-medium">{node.name}</span>
        </label>
        {node.children.length > 0 && (
          <div className="flex flex-col gap-1 w-full relative">
            {/* Linha guia visual para arvore */}
            <div className="absolute left-2.25 top-0 bottom-4 w-px bg-border" style={{ marginLeft: `${level * 20}px` }}></div>
            {node.children.map(child => renderCategoryNode(child as any, level + 1, field))}
          </div>
        )}
      </div>
    );
  };

  // Util helper for padding
  const max = (a: number, b: number) => a > b ? a : b;

  const categoryTree = buildCategoryTree(categories);

  const enabledProductCustomFields = useMemo(
    () => productCustomFieldDefs
      .filter((field) => field.enabled)
      .sort((left, right) => left.order - right.order),
    [productCustomFieldDefs],
  );

  function getProductCustomFieldStringValue(fieldId: string) {
    const rawValue = productCustomFieldValues[fieldId];
    if (Array.isArray(rawValue)) return '';
    return String(rawValue || '');
  }

  function renderProductCustomFieldControl(field: ProductCustomField) {
    if (field.type === 'MULTI_UPLOAD') {
      return (
        <MultiUploadInput
          label=""
          value={Array.isArray(productCustomFieldValues[field.id]) ? productCustomFieldValues[field.id] : []}
          onChange={(value) => setProductCustomFieldValues((prev) => ({
            ...prev,
            [field.id]: value,
          }))}
          helperText={field.placeholder || ''}
          maxFiles={20}
        />
      );
    }

    if (field.type === 'RICH_TEXT') {
      return (
        <RichEditor
          value={getProductCustomFieldStringValue(field.id)}
          onChange={(value) => setProductCustomFieldValues((prev) => ({
            ...prev,
            [field.id]: value,
          }))}
          placeholder={field.placeholder || 'Digite aqui...'}
        />
      );
    }

    if (field.type === 'LONG_TEXT') {
      return (
        <textarea
          value={getProductCustomFieldStringValue(field.id)}
          onChange={(event) => setProductCustomFieldValues((prev) => ({
            ...prev,
            [field.id]: event.target.value,
          }))}
          placeholder={field.placeholder || ''}
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      );
    }

    if (field.type === 'SELECT') {
      return (
        <Select
          value={getProductCustomFieldStringValue(field.id)}
          onValueChange={(value) => setProductCustomFieldValues((prev) => ({
            ...prev,
            [field.id]: value,
          }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || 'Selecione'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((option) => (
              <SelectItem key={`${field.id}-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={field.type === 'NUMBER' ? 'number' : (field.type === 'URL' ? 'url' : 'text')}
        value={getProductCustomFieldStringValue(field.id)}
        onChange={(event) => setProductCustomFieldValues((prev) => ({
          ...prev,
          [field.id]: event.target.value,
        }))}
        placeholder={field.placeholder || ''}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit(handleSubmit)} className="flex flex-col min-h-full">
        <div className="flex-1 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="relative grid w-full"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleTabs.length)}, minmax(0, 1fr))` }}
          >
          <span
            className="absolute inset-y-0.75 left-0.75 rounded-md bg-background shadow-sm transition-transform duration-300 ease-out pointer-events-none z-0"
            style={{
              width: `calc(${100 / Math.max(1, visibleTabs.length)}% - 6px)`,
              transform: `translateX(calc(${activeTabIndex * 100}% + ${activeTabIndex * 6}px))`,
            }}
          />
          <TabsTrigger value="general" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="information" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <span className="hidden sm:inline">Informações</span>
          </TabsTrigger>
          {hasProductTabPermission.categories && (
            <TabsTrigger value="categories" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Categorias</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="attributes" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Atributos</span>
          </TabsTrigger>
          {hasProductTabPermission.images && (
            <TabsTrigger value="images" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Imagens</span>
            </TabsTrigger>
          )}
          {hasProductTabPermission.videos && (
            <TabsTrigger value="videos" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Vídeos</span>
            </TabsTrigger>
          )}
          {hasProductTabPermission.pricesView && (
            <TabsTrigger value="prices" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Preços</span>
            </TabsTrigger>
          )}
          {hasProductTabPermission.inventoryView && (
            <TabsTrigger value="stock" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
          )}
          {hasProductTabPermission.variants && (
            <TabsTrigger value="ncm" className="flex items-center gap-2 relative z-10 cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
              <span className="hidden sm:inline">Variantes</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informacoes Gerais</CardTitle>
              <CardDescription>
                Dados principais do produto, precos e categoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          className="cursor-pointer"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="mt-0! cursor-pointer">Produto Ativo</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          className="cursor-pointer"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="mt-0! cursor-pointer">Produto em Destaque</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Produto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Vestido Midi Floral" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: VEST-001"
                          {...field}
                          disabled={erpIntegrated}
                          readOnly={erpIntegrated}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      {erpIntegrated ? (
                        <FormDescription>
                          Com ERP integrado, o SKU do produto é gerenciado pelo ERP.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Descricao</FormLabel>
                    <FormControl>
                      <RichEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Descreva o produto..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="materials"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Composicao / Tecido</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 100% Algodao" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="measures"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medidas</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Comprimento 120cm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="measurementTableId"
                  render={({ field }) => {
                    const selectedMeasurementTableName = field.value
                      ? (measurementTables.find((table) => table.id === field.value)?.name
                          || product?.measurementTableName
                          || `Tabela #${field.value}`)
                      : '';

                    const measurementTableButtonLabel = field.value
                      ? truncateMeasurementTableLabel(selectedMeasurementTableName)
                      : (isLoadingMeasurementTables ? 'Carregando...' : 'Selecione uma tabela');

                    return (
                    <FormItem className="min-w-0">
                      <FormLabel>Tabela de Medidas</FormLabel>
                      <div className="flex items-center gap-2 flex-nowrap">
                        <div className="min-w-0 flex-1">
                          <Popover
                            open={isMeasurementTablePopoverOpen}
                            onOpenChange={(open) => {
                              setIsMeasurementTablePopoverOpen(open);
                              if (open) {
                                void loadMeasurementTables(measurementTableSearch, 10);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className="w-full min-w-0 justify-between overflow-hidden"
                                  title={field.value ? selectedMeasurementTableName : 'Selecione uma tabela'}
                                >
                                  <span className="block min-w-0 max-w-[14ch] flex-1 truncate text-left xl:max-w-[18ch]">
                                    {measurementTableButtonLabel}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-105 p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Buscar tabela de medidas..."
                                  value={measurementTableSearch}
                                  onValueChange={(value) => setMeasurementTableSearch(value)}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {isLoadingMeasurementTables ? 'Buscando...' : 'Nenhuma tabela encontrada'}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {measurementTables.map((table) => (
                                      <CommandItem
                                        key={table.id}
                                        value={`${table.id}-${table.name}`}
                                        onSelect={() => {
                                          field.onChange(table.id);
                                          setIsMeasurementTablePopoverOpen(false);
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${field.value === table.id ? 'opacity-100' : 'opacity-0'}`} />
                                        {table.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="cursor-pointer shrink-0"
                          onClick={handleOpenCreateMeasurementTableDrawer}
                          title="Criar nova tabela de medidas"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {field.value ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="cursor-pointer shrink-0"
                            onClick={() => handleOpenEditMeasurementTableDrawer(String(field.value))}
                            title="Editar tabela de medidas"
                          >
                            <Ruler className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <FormMessage />
                    </FormItem>
                    );
                  }}
                />
                <div className="space-y-2">
                  <Label>Peso (g)</Label>
                  <IntegerInput
                    label=""
                    value={(() => {
                      const defaultVal = variantWeightGrams['_default'];
                      if (defaultVal != null && defaultVal !== '') return Number(defaultVal);
                      const firstVal = Object.values(variantWeightGrams).find((v) => v != null && v !== '');
                      return firstVal != null ? Number(firstVal) : null;
                    })()}
                    onChange={(value) => {
                      const strVal = value != null ? String(value) : '';
                      setVariantWeightGrams((prev) => {
                        const updated: Record<string, string> = {};
                        const keys = Object.keys(prev);
                        if (keys.length === 0) {
                          return { _default: strVal };
                        }
                        keys.forEach((k) => { updated[k] = strVal; });
                        return updated;
                      });
                    }}
                    placeholder="0"
                    min={0}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label>Tags / Estilos</Label>
                <div className="flex gap-4 mt-4">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Adicionar tag..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag} className="cursor-pointer">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-4 mt-4">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" className="cursor-pointer" onClick={() => setTags(tags.filter(t => t !== tag))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="information" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
              <CardDescription>
                Campos customizados do produto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {enabledProductCustomFields.length > 0 ? (
                enabledProductCustomFields.map((field) => (
                  <div key={`information-product-field-${field.id}`} className="space-y-2">
                    <Label>{field.label}{field.required ? ' *' : ''}</Label>
                    {renderProductCustomFieldControl(field)}
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum campo customizado configurado.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        {hasProductTabPermission.categories && (
        <TabsContent value="categories" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categorias</CardTitle>
              <CardDescription>
                Selecione as categorias às quais este produto pertence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 rounded-md border p-4 overflow-x-hidden">
                        {categoryTree.map((root) => renderCategoryNode(root as any, 0, field))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Attributes Tab */}
        <TabsContent value="attributes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Atributos do Produto</CardTitle>
                  <CardDescription>
                    {erpIntegrated
                      ? 'Com ERP integrado, a seleção de valores neste produto é feita pelo ERP. Novos atributos devem ser criados no ERP; você ainda pode gerenciar os atributos da loja.'
                      : 'Selecione os valores de cada atributo cadastrado para este produto.'}
                  </CardDescription>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Select
                    value={attributeManagerSelection}
                    onValueChange={handleAttributeManagerSelectionChange}
                  >
                    <SelectTrigger className="w-full sm:w-55">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">Cor</SelectItem>
                      <SelectItem value="size">Tamanho</SelectItem>
                      {!erpIntegrated ? <SelectItem value="new">Novo Atributo</SelectItem> : null}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={openSelectedAttributeManager}
                    disabled={erpIntegrated && attributeManagerSelection === "new"}
                  >
                    Gerenciar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {storeAttributes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atributo cadastrado para a loja.</p>
              ) : (
                <div className="space-y-2">
                  {orderedStoreAttributes.map((attribute) => {
                    const selectedCount = (selectedAttributeValuesByAttribute[attribute.id] || []).length;
                    return (
                    <div
                      key={attribute.id}
                      onDragOver={(event) => handleAttributeDragOver(event, attribute.id)}
                      onDragLeave={handleAttributeDragLeave}
                      onDrop={(event) => handleAttributeDrop(event, attribute.id)}
                      className={`rounded-md border px-3 py-3 transition-all ${
                        draggedAttributeId === attribute.id
                          ? 'opacity-60'
                          : dragOverAttributeId === attribute.id
                            ? 'ring-2 ring-primary/60'
                            : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium truncate">{attribute.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            code: {attribute.code} • selecionados: {selectedCount} • valores: {attribute.values?.length || 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!erpIntegrated ? (
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => handleAttributeDragStart(event, attribute.id)}
                              onDragEnd={handleAttributeDragEnd}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors cursor-move hover:text-foreground"
                              aria-label={`Reordenar atributo ${attribute.name}`}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => openAttributeManager(attribute)}
                          >
                            Gerenciar
                          </Button>
                          {!erpIntegrated ? (
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
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3">
                        {attribute.values?.length ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {(selectedAttributeValuesByAttribute[attribute.id] || []).map((valueId) => {
                                const value = attribute.values?.find((entry) => entry.id === valueId);
                                if (!value) return null;

                                const isDraggedValue =
                                  draggedSelectedAttributeValue?.attributeId === attribute.id &&
                                  draggedSelectedAttributeValue?.valueId === value.id;
                                const isDragOverValue =
                                  dragOverSelectedAttributeValue?.attributeId === attribute.id &&
                                  dragOverSelectedAttributeValue?.valueId === value.id;

                                return (
                                  <Badge
                                    key={value.id}
                                    variant="secondary"
                                    draggable={!erpIntegrated}
                                    onDragStart={erpIntegrated ? undefined : (event) => handleSelectedAttributeValueDragStart(event, attribute.id, value.id)}
                                    onDragOver={erpIntegrated ? undefined : (event) => handleSelectedAttributeValueDragOver(event, attribute.id, value.id)}
                                    onDrop={erpIntegrated ? undefined : (event) => handleSelectedAttributeValueDrop(event, attribute.id, value.id)}
                                    onDragEnd={erpIntegrated ? undefined : handleSelectedAttributeValueDragEnd}
                                    className={`h-9 px-2 text-sm gap-1 ${erpIntegrated ? 'pr-2' : 'pr-1 cursor-move'} transition-all ${
                                      isDraggedValue ? 'opacity-60 ring-2 ring-primary' : isDragOverValue ? 'ring-2 ring-primary/60' : ''
                                    }`}
                                  >
                                    {!erpIntegrated ? <GripVertical className="h-3.5 w-3.5 opacity-70" /> : null}
                                    <span>{value.name || value.code}</span>
                                    {!erpIntegrated ? (
                                      <button
                                        type="button"
                                        className="cursor-pointer rounded-sm p-0.5 hover:bg-black/5"
                                        onClick={() => toggleAttributeValue(attribute, value.id)}
                                        aria-label={`Remover ${value.name || value.code}`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </Badge>
                                );
                              })}

                              {!erpIntegrated ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-sm cursor-pointer border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setAttributeValuePickerAttributeId(attribute.id);
                                    setAttributeValuePickerSearch('');
                                  }}
                                >
                                  <ChevronsUpDown className="h-4 w-4 mr-1" />
                                  Selecionar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhum valor cadastrado para este atributo.</p>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <AlertDialog
          open={deleteAttributeDialogOpen}
          onOpenChange={(open) => {
            if (isDeletingAttribute) return;
            setDeleteAttributeDialogOpen(open);
            if (!open) {
              setAttributeToDelete(null);
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
                {isDeletingAttribute ? 'Removendo...' : 'Remover'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Images Tab */}
        {hasProductTabPermission.images && (
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
                onValueChange={(value) => handleImageGroupingTypeChange(value as 'product' | 'attributes' | 'full_sku')}
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

              {imageGroupingType === 'attributes' && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium mb-2">Atributos para agrupamento</p>
                  {selectedProductAttributes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Selecione valores de atributos na aba Atributos para habilitar esta opção.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProductAttributes.map((attribute) => (
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

          <AlertDialog
            open={imageGroupingChangeDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                cancelImageGroupingTypeChange();
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alterar nível das imagens?</AlertDialogTitle>
                <AlertDialogDescription>
                  Este produto já possui imagens cadastradas. Ao mudar de{' '}
                  <strong>{getImageGroupingTypeLabel(imageGroupingType)}</strong> para{' '}
                  <strong>
                    {pendingImageGroupingType
                      ? getImageGroupingTypeLabel(pendingImageGroupingType)
                      : 'outro nível'}
                  </strong>
                  , as imagens podem ser reorganizadas ou consolidadas de forma diferente.
                  Revise a galeria antes de salvar para evitar duplicações ou perda de fotos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer" onClick={cancelImageGroupingTypeChange}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction className="cursor-pointer" onClick={confirmImageGroupingTypeChange}>
                  Continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="min-w-0 space-y-1.5 md:max-w-[42%]">
                  <CardTitle className="text-lg">Imagens do Produto</CardTitle>
                  <CardDescription>
                    {imageGroupingType === 'product'
                      ? 'Todas as variantes compartilham as mesmas imagens.'
                      : imageGroupingType === 'attributes'
                        ? 'As imagens são agrupadas pelos atributos selecionados.'
                        : 'Cada combinação de SKU possui seu próprio grupo de imagens.'}
                  </CardDescription>
                </div>
                <div className="px-0 py-0 text-xs text-muted-foreground space-y-1.5 md:w-[52%] md:text-right">
                  <p className="font-medium text-foreground">
                    Você pode adicionar fotos no formato PNG, JPG, JPEG ou GIF.
                  </p>
                  <p>
                    A dimensão recomendada para o upload da foto é de 683x1024px.
                  </p>
                  <p>
                    O tamanho recomendado para o upload da foto é de 1MB e GIF até 5MB.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {imageGroupsForEditor.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{group.label}</div>
                    </div>

                    <DndContext
                      sensors={imageDragSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleImageGroupSortEnd(group.key, group.variantIds, group.images || [], event)}
                    >
                      <SortableContext
                        items={(group.images || []).map((img, idx) => buildImageDragId(group.key, img, idx))}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                          {(group.images || []).map((img, idx) => (
                            <SortableImageCard
                              key={buildImageDragId(group.key, img, idx)}
                              id={buildImageDragId(group.key, img, idx)}
                              img={img}
                              label={group.label}
                              idx={idx}
                              onRemove={() => removeImageFromGroup(group.key, group.variantIds, group.images || [], idx)}
                              aspectStyle={imageAspectStyle}
                            />
                          ))}

                          <button
                            type="button"
                            onClick={() => imageGroupFileInputRefs.current[group.key]?.click()}
                            disabled={uploadingImageGroupKey === group.key}
                            className={`${imageAspectStyle ? '' : 'aspect-3/4'} rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer`}
                            style={imageAspectStyle}
                          >
                            {uploadingImageGroupKey === group.key ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-8 w-8 mb-2" />
                                <span className="text-sm">Adicionar</span>
                              </>
                            )}
                          </button>

                          <input
                            ref={(el) => { imageGroupFileInputRefs.current[group.key] = el; }}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && uploadImagesToGroup(group.key, group.variantIds, e.target.files, group.images || [])}
                          />
                        </div>
                      </SortableContext>
                    </DndContext>

                    {!!group.images?.length && (
                      <p className="text-xs text-muted-foreground">
                        Arraste as imagens para reordenar. A primeira imagem será a principal.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            </Card>
        </TabsContent>
        )}

        {hasProductTabPermission.videos && (
        <TabsContent value="videos" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nível dos Vídeos</CardTitle>
              <CardDescription>
                Defina em qual nível os vídeos serão agrupados no produto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={videoGroupingType}
                onValueChange={(value) => handleVideoGroupingTypeChange(value as 'product' | 'attributes' | 'full_sku')}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <Label htmlFor="video-grouping-product" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value="product" id="video-grouping-product" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Por Produto</div>
                    <div className="text-xs text-muted-foreground">Todas as variantes compartilham o mesmo vídeo.</div>
                  </div>
                </Label>

                <Label htmlFor="video-grouping-attributes" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value="attributes" id="video-grouping-attributes" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Por Atributos</div>
                    <div className="text-xs text-muted-foreground">Agrupa por atributos selecionados (ex: cor).</div>
                  </div>
                </Label>

                <Label htmlFor="video-grouping-full-sku" className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value="full_sku" id="video-grouping-full-sku" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Por SKU Completo</div>
                    <div className="text-xs text-muted-foreground">Cada combinação de SKU terá vídeo próprio.</div>
                  </div>
                </Label>
              </RadioGroup>

              {videoGroupingType === 'attributes' && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium mb-2">Atributos para agrupamento</p>
                  {selectedProductAttributes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Selecione valores de atributos na aba Atributos para habilitar esta opção.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProductAttributes.map((attribute) => (
                        <label key={`video-attr-${attribute.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedVideoGroupingAttributeIds.includes(attribute.id)}
                            onCheckedChange={() => toggleVideoGroupingAttribute(attribute.id)}
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
              <CardTitle className="text-lg">Vídeos do Produto</CardTitle>
              <CardDescription>
                {videoGroupingType === 'product'
                  ? 'Todas as variantes compartilham o mesmo vídeo.'
                  : videoGroupingType === 'attributes'
                    ? 'Os vídeos são agrupados pelos atributos selecionados.'
                    : 'Cada combinação de SKU possui seu próprio grupo de vídeo.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!product?.id ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  Salve o produto primeiro para vincular vídeos aos grupos de variantes.
                </div>
              ) : (
                <div className="space-y-6">
                  {videoGroupsForEditor.map((group) => {
                    const groupVideo = variantVideos[group.key] || null;
                    const playableUrl = getPlayableVideoUrl(groupVideo);

                    return (
                      <div key={`video-${group.key}`} className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{group.label}</div>
                          <div className="text-xs text-muted-foreground">1 vídeo por grupo.</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
                          {groupVideo && playableUrl ? (
                            <div className="space-y-3">
                              <div className="relative overflow-hidden rounded-lg border bg-black/90 aspect-3/4" style={videoAspectStyle}>
                                <video
                                  src={playableUrl}
                                  controls
                                  preload="metadata"
                                  poster={groupVideo.thumbUrl}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="cursor-pointer"
                                  disabled={uploadingVideoGroupKey === group.key}
                                  onClick={() => videoGroupFileInputRefs.current[group.key]?.click()}
                                >
                                  {uploadingVideoGroupKey === group.key ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4 mr-2" />
                                  )}
                                  Substituir vídeo
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  className="cursor-pointer"
                                  onClick={() => removeVideoFromGroup(group.key, groupVideo)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => videoGroupFileInputRefs.current[group.key]?.click()}
                              disabled={uploadingVideoGroupKey === group.key}
                              className={`w-full ${videoAspectStyle ? '' : 'aspect-3/4'} rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer`}
                              style={videoAspectStyle}
                            >
                              {uploadingVideoGroupKey === group.key ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 mb-2" />
                                  <span className="text-sm">Adicionar vídeo</span>
                                  <span className="text-xs mt-1">MP4, WebM, OGG ou MOV</span>
                                </>
                              )}
                            </button>
                          )}

                        </div>

                        <input
                          ref={(el) => { videoGroupFileInputRefs.current[group.key] = el; }}
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void uploadVideoToGroup(group.key, group.variantIds, file);
                            }
                            e.currentTarget.value = '';
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Stock Tab */}
        {hasProductTabPermission.inventoryView && (
        <TabsContent value="stock" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estoque por Variante</CardTitle>
              <CardDescription>
                {stockModeConfig === 'BINARY'
                  ? 'Modo 0 ou 1: cada variante fica Disponível ou Indisponível.'
                  : stockModeConfig === 'INFINITO'
                    ? 'Modo infinito: cada variante fica Disponível ou Indisponível com estoque ilimitado.'
                    : stockModeConfig === 'FANTASY'
                      ? 'Modo fantasia: cada variante fica Disponível ou Indisponível.'
                      : stockModeConfig === 'WMS'
                        ? 'Modo WMS: quantidade é gerenciada nas posições de estoque (Entrada/Movimentação de Estoque).'
                        : 'Modo real: use os campos fixos de estoque e reserva da própria variante.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasProductTabPermission.inventoryEdit && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-4">
                  Você não tem permissão para editar estoque. Os campos abaixo estão em modo somente leitura.
                </div>
              )}
              {isWmsManagedStock && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground mb-4">
                  Neste modo, use as telas de Estoque para entrada, movimentação e ajuste de quantidades.
                </div>
              )}
              {!product && (
                <div className="text-sm text-muted-foreground mb-4">
                  Para salvar por variante, primeiro crie o produto.
                </div>
              )}
              {displayVariants.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {activeVariantFilterCount === 0
                        ? `${displayVariants.length} variantes`
                        : `${filteredVariants.length} de ${displayVariants.length} variantes`}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {variantAttributeFilterGroups.map((group) => {
                        const selectedValue = variantAttributeFilters[group.attributeId] || 'all';
                        return (
                          <div key={group.attributeId} className="flex items-center">
                            <Select
                              value={selectedValue}
                              onValueChange={(value) =>
                                setVariantAttributeFilters((prev) => ({
                                  ...prev,
                                  [group.attributeId]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-auto min-w-max">
                                <SelectValue placeholder={group.attributeName} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{group.attributeName}: Todos</SelectItem>
                                {group.options.map((option) => (
                                  <SelectItem key={`${group.attributeId}-${option.valueId}`} value={String(option.valueId)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      <div className="flex items-center">
                        <Select
                          value={variantStatusFilter}
                          onValueChange={(value) => setVariantStatusFilter(value as 'all' | 'active' | 'disabled')}
                        >
                          <SelectTrigger className="h-8 w-auto min-w-max">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Status: Todos</SelectItem>
                            <SelectItem value="active">Status: Ativas</SelectItem>
                            <SelectItem value="disabled">Status: Desativadas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        title="Limpar filtros"
                        disabled={activeVariantFilterCount === 0}
                        onClick={() => {
                          setVariantAttributeFilters({});
                          setVariantStatusFilter('active');
                        }}
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Atributos</th>
                          <th className="text-right p-3 font-medium">
                            {stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? 'Disponível' : 'Estoque'}
                          </th>
                          {isWmsManagedStock && (
                            <th className="text-right p-3 font-medium">Localização do Estoque</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVariants.map((variant, idx) => {
                          const key = variant.variantKey;
                          const variantDisabled = isVariantDisabled(key);
                          const colorSelection = variant.selectedValues.find((value) =>
                            ['color', 'colors', 'cor', 'cores'].includes(String(value.attributeCode || '').trim().toLowerCase())
                          );
                          const variantColor = colorSelection
                            ? colors.find((c) => c.attributeValueId === colorSelection.valueId)
                            : undefined;
                          return (
                            <tr key={idx} className={`border-t ${variantDisabled ? 'opacity-60' : ''}`}>
                              <td className="p-3 align-top">
                                <div className="flex items-start gap-3">
                                  {variantColor && (
                                    <div
                                      className="w-4 h-4 rounded-full border shrink-0 mt-1"
                                      style={getColorDotStyle(variantColor)}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="leading-5">{variant.combinationLabel || 'Único'}</div>
                                    <button
                                      type="button"
                                      className="font-mono text-xs text-muted-foreground mt-1 hover:text-foreground underline underline-offset-2 cursor-pointer text-left"
                                      onClick={() => setVariantDrawerKey(key)}
                                    >
                                      sku: {variant.variantSku}
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  {stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? (
                                    <Switch
                                      checked={normalizeStockInputByMode(variantStocks[key] ?? 0) > 0}
                                      onCheckedChange={(checked) =>
                                        setVariantStocks({
                                          ...variantStocks,
                                          [key]: checked ? 1 : 0,
                                        })
                                      }
                                      disabled={variantDisabled || !hasProductTabPermission.inventoryEdit}
                                    />
                                  ) : isWmsManagedStock ? (
                                    <span className="text-xs text-muted-foreground">Gerenciado no estoque</span>
                                  ) : (
                                    <IntegerInput
                                      label=""
                                      value={normalizeStockInputByMode(variantStocks[key] ?? 0)}
                                      onChange={(value) => setVariantStocks({
                                        ...variantStocks,
                                        [key]: normalizeStockInputByMode(value ?? 0)
                                      })}
                                      placeholder="0"
                                      fullWidth={false}
                                      className="w-20"
                                      min={0}
                                      max={stockModeConfig === 'FANTASY' ? stockVariantMaxQty : undefined}
                                      disabled={variantDisabled || !hasProductTabPermission.inventoryEdit}
                                    />
                                  )}
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && stockModeConfig !== 'BINARY' && stockModeConfig !== 'INFINITO' && !isWmsManagedStock && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar estoque para as demais variações"
                                        onClick={() => applyVariantStockToAll(key)}
                                        disabled={variantDisabled || !hasProductTabPermission.inventoryEdit}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {isWmsManagedStock && (
                                <td className="p-3 text-right align-top">
                                  <div className="flex items-center justify-end gap-1">
                                    {(() => {
                                      const selectedIds = variantPreferredSellableLocations[key] || [];
                                      const selectedLocations = sellableLocations.filter((loc) =>
                                        selectedIds.includes(String(loc.id))
                                      );
                                      const displayText =
                                        selectedLocations.length === 0
                                          ? 'Sem vínculo'
                                          : selectedLocations.length === 1
                                            ? selectedLocations[0].code
                                            : `${selectedLocations.map((l) => l.code).join(', ')}`;
                                      return (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-8 w-64 ml-auto justify-between truncate"
                                              disabled={variantDisabled}
                                              title={displayText}
                                            >
                                              <span className="truncate text-left">{displayText}</span>
                                              <X className="h-3 w-3 shrink-0" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-3" align="end">
                                            <div className="space-y-2">
                                              <div className="text-sm font-medium">Localizações do Estoque</div>
                                              <div className="max-h-64 overflow-y-auto space-y-2">
                                                {sellableLocations.length === 0 ? (
                                                  <div className="text-xs text-muted-foreground py-2">
                                                    Nenhuma localização de estoque disponível
                                                  </div>
                                                ) : (
                                                  sellableLocations.map((location) => {
                                                    const warehouse = wmsWarehouses.find((item) => item.id === location.warehouse_id);
                                                    const warehouseLabel = warehouse
                                                      ? `${warehouse.code} - ${warehouse.name}`
                                                      : `Warehouse ${location.warehouse_id}`;
                                                    const isChecked = (variantPreferredSellableLocations[key] || []).includes(String(location.id));

                                                    return (
                                                      <div key={location.id} className="flex items-center gap-2">
                                                        <Checkbox
                                                          id={`sellable-${key}-${location.id}`}
                                                          checked={isChecked}
                                                          disabled={!hasProductTabPermission.inventoryEdit}
                                                          onCheckedChange={(checked) => {
                                                            if (!hasProductTabPermission.inventoryEdit) return;
                                                            setVariantPreferredSellableLocations((prev) => {
                                                              const current = prev[key] || [];
                                                              const next = { ...prev };
                                                              if (checked) {
                                                                next[key] = [...current, String(location.id)];
                                                              } else {
                                                                next[key] = current.filter((id) => id !== String(location.id));
                                                                if (next[key].length === 0) {
                                                                  delete next[key];
                                                                }
                                                              }
                                                              return next;
                                                            });
                                                          }}
                                                        />
                                                        <label
                                                          htmlFor={`sellable-${key}-${location.id}`}
                                                          className="text-xs cursor-pointer flex-1 min-w-0"
                                                        >
                                                          <div className="font-medium">{location.code}</div>
                                                          <div className="text-muted-foreground truncate">{warehouseLabel}</div>
                                                        </label>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                              {(variantPreferredSellableLocations[key]?.length || 0) > 0 && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="w-full text-xs h-7"
                                                  disabled={!hasProductTabPermission.inventoryEdit}
                                                  onClick={() => {
                                                    setVariantPreferredSellableLocations((prev) => {
                                                      const next = { ...prev };
                                                      delete next[key];
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  Limpar seleção
                                                </Button>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })()}
                                    <div className="w-8 shrink-0">
                                      {idx === 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 cursor-pointer"
                                          title="Aplicar localização para as demais variações"
                                          onClick={() => applyVariantSellableLocationsToAll(key)}
                                          disabled={variantDisabled || !hasProductTabPermission.inventoryEdit}
                                        >
                                          <ArrowDown className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {filteredVariants.length === 0 && (
                          <tr className="border-t">
                            <td colSpan={isWmsManagedStock ? 3 : 2} className="p-4 text-center text-muted-foreground">
                              Nenhuma variante encontrada para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">Produto simples — sem variantes. Configure o estoque abaixo ou selecione atributos na aba Atributos.</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? 'Disponível' : 'Estoque'}</Label>
                      {stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? (
                        <div className="pt-1">
                          <Switch
                            checked={(variantStocks['_default'] ?? 0) > 0}
                            onCheckedChange={(checked) => setVariantStocks((prev) => ({ ...prev, _default: checked ? 1 : 0 }))}
                            disabled={!hasProductTabPermission.inventoryEdit}
                          />
                        </div>
                      ) : (
                        <IntegerInput
                          label=""
                          value={variantStocks['_default'] ?? 0}
                          onChange={(value) => setVariantStocks((prev) => ({ ...prev, _default: value ?? 0 }))}
                          disabled={!hasProductTabPermission.inventoryEdit}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* NCM Tab */}
        {hasProductTabPermission.variants && (
        <TabsContent value="ncm" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Variantes</CardTitle>
              <CardDescription>
                Edite SKU, NCM e código de barras por variante. Você pode aplicar NCM e código de barras para as variantes filtradas.
                {erpIntegrated ? (
                  <> Com ERP integrado, os SKUs das variantes são gerenciados pelo ERP.</>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!product && (
                <div className="text-sm text-muted-foreground mb-4">
                  Para salvar por variante, primeiro crie o produto.
                </div>
              )}
              {displayVariants.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {activeVariantFilterCount === 0
                        ? `${displayVariants.length} variantes`
                        : `${filteredVariants.length} de ${displayVariants.length} variantes`}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {variantAttributeFilterGroups.map((group) => {
                        const selectedValue = variantAttributeFilters[group.attributeId] || 'all';
                        return (
                          <div key={group.attributeId} className="flex items-center">
                            <Select
                              value={selectedValue}
                              onValueChange={(value) =>
                                setVariantAttributeFilters((prev) => ({
                                  ...prev,
                                  [group.attributeId]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-auto min-w-max">
                                <SelectValue placeholder={group.attributeName} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{group.attributeName}: Todos</SelectItem>
                                {group.options.map((option) => (
                                  <SelectItem key={`${group.attributeId}-${option.valueId}`} value={String(option.valueId)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      <div className="flex items-center">
                        <Select
                          value={variantStatusFilter}
                          onValueChange={(value) => setVariantStatusFilter(value as 'all' | 'active' | 'disabled')}
                        >
                          <SelectTrigger className="h-8 w-auto min-w-max">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Status: Todos</SelectItem>
                            <SelectItem value="active">Status: Ativas</SelectItem>
                            <SelectItem value="disabled">Status: Desativadas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        title="Limpar filtros"
                        disabled={activeVariantFilterCount === 0}
                        onClick={() => {
                          setVariantAttributeFilters({});
                          setVariantStatusFilter('active');
                        }}
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Atributos</th>
                          <th className="p-3 font-medium">SKU</th>
                          <th className="text-right p-3 font-medium">NCM</th>
                          <th className="text-right p-3 font-medium">Código de barras</th>
                          <th className="text-right p-3 font-medium">Peso (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVariants.map((variant, idx) => {
                          const key = variant.variantKey;
                          const variantDisabled = isVariantDisabled(key);
                          const colorSelection = variant.selectedValues.find((value) =>
                            ['color', 'colors', 'cor', 'cores'].includes(String(value.attributeCode || '').trim().toLowerCase())
                          );
                          const variantColor = colorSelection
                            ? colors.find((c) => c.attributeValueId === colorSelection.valueId)
                            : undefined;
                          return (
                            <tr key={idx} className={`border-t ${variantDisabled ? 'opacity-60' : ''}`}>
                              <td className="p-3 align-top">
                                <div className="flex items-start gap-3">
                                  {variantColor && (
                                    <div
                                      className="w-4 h-4 rounded-full border shrink-0 mt-1"
                                      style={getColorDotStyle(variantColor)}
                                    />
                                  )}
                                  <div className="shrink-0 pt-0.5">
                                    <Switch
                                      checked={!variantDisabled}
                                      onCheckedChange={() => toggleVariantDisabled(key)}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="leading-5">{variant.combinationLabel || 'Único'}</div>
                                    {variantDisabled && (
                                      <div className="text-[11px] text-destructive mt-1">Variante desativada</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 align-top">
                                <Input
                                  value={erpIntegrated
                                    ? (variant.variantSku || '')
                                    : displayVariantSku(key, {
                                        variantId: variant.id ? String(variant.id) : undefined,
                                        attributeValueIds: variant.attribute_values,
                                        color: variant.color,
                                        size: variant.size,
                                      }, variant.variantSku)}
                                  onChange={(e) =>
                                    !erpIntegrated && setVariantSkuOverrides((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  placeholder={erpIntegrated
                                    ? (variant.variantSku || '')
                                    : variant.variantSku}
                                  className="w-40 font-mono text-xs bg-muted/40"
                                  disabled={erpIntegrated || variantDisabled}
                                  readOnly={erpIntegrated}
                                />
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    value={variantNcms[key] ?? ''}
                                    onChange={(e) =>
                                      setVariantNcms((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 6109.10.00"
                                    className="w-36"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar NCM para as demais variações"
                                        onClick={() => applyVariantNcmToAll(key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    value={variantBarcodes[key] ?? ''}
                                    onChange={(e) =>
                                      setVariantBarcodes((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 7891234567890"
                                    className="w-44"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar código de barras para as demais variações"
                                        onClick={() => applyVariantBarcodeToAll(key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <IntegerInput
                                    label=""
                                    value={variantWeightGrams[key] ? Number(variantWeightGrams[key]) : null}
                                    onChange={(value) => setVariantWeightGrams((prev) => ({
                                      ...prev,
                                      [key]: value != null ? String(value) : '',
                                    }))}
                                    placeholder="0"
                                    min={0}
                                    fullWidth={false}
                                    className="w-20"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar peso para as demais variações"
                                        onClick={() => applyVariantWeightToAll(key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredVariants.length === 0 && (
                          <tr className="border-t">
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              Nenhuma variante encontrada para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Variante</th>
                        <th className="p-3 font-medium">SKU</th>
                        <th className="text-right p-3 font-medium">NCM</th>
                        <th className="text-right p-3 font-medium">Código de barras</th>
                        <th className="text-right p-3 font-medium">Peso (g)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-3 align-top">
                          <div className="leading-5 text-muted-foreground">Produto simples</div>
                        </td>
                        <td className="p-3 align-top">
                          <Input
                            value={erpIntegrated
                              ? (generatedVariants.find((variant) => variant.variantKey === '_default')?.variantSku || '')
                              : displayVariantSku('_default', {
                                  variantId: variantIdsByKey['_default'],
                                }, form.getValues('sku') || '')}
                            onChange={(e) =>
                              !erpIntegrated && setVariantSkuOverrides((prev) => ({
                                ...prev,
                                '_default': e.target.value,
                              }))
                            }
                            placeholder={erpIntegrated
                              ? (generatedVariants.find((variant) => variant.variantKey === '_default')?.variantSku || '')
                              : displayVariantSku('_default', {
                                  variantId: variantIdsByKey['_default'],
                                }, form.getValues('sku') || '')}
                            className="w-40 font-mono text-xs"
                            disabled={erpIntegrated}
                            readOnly={erpIntegrated}
                          />
                        </td>
                        <td className="p-3 text-right align-top">
                          <Input
                            value={variantNcms['_default'] ?? ''}
                            onChange={(e) =>
                              setVariantNcms((prev) => ({
                                ...prev,
                                '_default': e.target.value,
                              }))
                            }
                            placeholder="Ex: 6109.10.00"
                            className="w-36"
                          />
                        </td>
                        <td className="p-3 text-right align-top">
                          <Input
                            value={variantBarcodes['_default'] ?? ''}
                            onChange={(e) =>
                              setVariantBarcodes((prev) => ({
                                ...prev,
                                '_default': e.target.value,
                              }))
                            }
                            placeholder="Ex: 7891234567890"
                            className="w-44"
                          />
                        </td>
                        <td className="p-3 text-right align-top">
                          <IntegerInput
                            label=""
                            value={variantWeightGrams['_default'] ? Number(variantWeightGrams['_default']) : null}
                            onChange={(value) => setVariantWeightGrams((prev) => ({
                              ...prev,
                              '_default': value != null ? String(value) : '',
                            }))}
                            placeholder="0"
                            min={0}
                            fullWidth={false}
                            className="w-20"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Prices Tab */}
        {hasProductTabPermission.pricesView && (
        <TabsContent value="prices" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preços por Variante</CardTitle>
              <CardDescription>
                Defina preços base, custo e promocional para cada combinação de atributos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasProductTabPermission.pricesEdit && (
                <div className="text-sm text-muted-foreground mb-4">
                  Você pode visualizar os preços, mas não tem permissão para editar.
                </div>
              )}
              <fieldset disabled={!hasProductTabPermission.pricesEdit}>
              {!product && (
                <div className="text-sm text-muted-foreground mb-4">
                  Para salvar por variante, primeiro crie o produto.
                </div>
              )}
              {displayVariants.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {activeVariantFilterCount === 0
                        ? `${displayVariants.length} variantes`
                        : `${filteredVariants.length} de ${displayVariants.length} variantes`}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {variantAttributeFilterGroups.map((group) => {
                        const selectedValue = variantAttributeFilters[group.attributeId] || 'all';
                        return (
                          <div key={group.attributeId} className="flex items-center">
                            <Select
                              value={selectedValue}
                              onValueChange={(value) =>
                                setVariantAttributeFilters((prev) => ({
                                  ...prev,
                                  [group.attributeId]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-auto min-w-max">
                                <SelectValue placeholder={group.attributeName} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{group.attributeName}: Todos</SelectItem>
                                {group.options.map((option) => (
                                  <SelectItem key={`${group.attributeId}-${option.valueId}`} value={String(option.valueId)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      <div className="flex items-center">
                        <Select
                          value={variantStatusFilter}
                          onValueChange={(value) => setVariantStatusFilter(value as 'all' | 'active' | 'disabled')}
                        >
                          <SelectTrigger className="h-8 w-auto min-w-max">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Status: Todos</SelectItem>
                            <SelectItem value="active">Status: Ativas</SelectItem>
                            <SelectItem value="disabled">Status: Desativadas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        title="Limpar filtros"
                        disabled={activeVariantFilterCount === 0}
                        onClick={() => {
                          setVariantAttributeFilters({});
                          setVariantStatusFilter('active');
                        }}
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Atributos</th>
                          <th className="text-right p-3 font-medium">Preço de Custo</th>
                          <th className="text-right p-3 font-medium">Preço de Venda</th>
                          <th className="text-right p-3 font-medium">Preço Promocional</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVariants.map((variant, idx) => {
                          const key = variant.variantKey;
                          const variantDisabled = isVariantDisabled(key);
                          const colorSelection = variant.selectedValues.find((value) =>
                            ['color', 'colors', 'cor', 'cores'].includes(String(value.attributeCode || '').trim().toLowerCase())
                          );
                          const variantColor = colorSelection
                            ? colors.find((c) => c.attributeValueId === colorSelection.valueId)
                            : undefined;
                          return (
                            <tr key={idx} className={`border-t ${variantDisabled ? 'opacity-60' : ''}`}>
                              <td className="p-3 align-top">
                                <div className="flex items-start gap-3">
                                  {variantColor && (
                                    <div
                                      className="w-4 h-4 rounded-full border shrink-0 mt-1"
                                      style={getColorDotStyle(variantColor)}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="leading-5">{variant.combinationLabel || 'Único'}</div>
                                    <button
                                      type="button"
                                      className="font-mono text-xs text-muted-foreground mt-1 hover:text-foreground underline underline-offset-2 cursor-pointer text-left"
                                      onClick={() => setVariantDrawerKey(key)}
                                    >
                                      sku: {variant.variantSku}
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <CurrencyInput
                                    value={variantCosts[key] ? Number(variantCosts[key]) : null}
                                    onChange={(value) => setVariantCosts({
                                      ...variantCosts,
                                      [key]: value == null ? "" : value.toString()
                                    })}
                                    placeholder={product?.cost?.toString() || "0,00"}
                                    fullWidth={false}
                                    className="w-28"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar custo para as demais variações"
                                        onClick={() => applyVariantPriceToAll('cost', key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <CurrencyInput
                                    value={variantBasePrices[key] ? Number(variantBasePrices[key]) : null}
                                    onChange={(value) => setVariantBasePrices({
                                      ...variantBasePrices,
                                      [key]: value == null ? "" : value.toString()
                                    })}
                                    placeholder={product?.basePrice?.toString() || "0,00"}
                                    fullWidth={false}
                                    className="w-28"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar preço de venda para as demais variações"
                                        onClick={() => applyVariantPriceToAll('base', key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <CurrencyInput
                                    value={variantPromotionalPrices[key] ? Number(variantPromotionalPrices[key]) : null}
                                    onChange={(value) => setVariantPromotionalPrices({
                                      ...variantPromotionalPrices,
                                      [key]: value == null ? "" : value.toString()
                                    })}
                                    placeholder="0,00"
                                    fullWidth={false}
                                    className="w-28"
                                    disabled={variantDisabled}
                                  />
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar preço promocional para as demais variações"
                                        onClick={() => applyVariantPriceToAll('promo', key, filteredVariantKeys)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredVariants.length === 0 && (
                          <tr className="border-t">
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                              Nenhuma variante encontrada para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Preço de Custo</Label>
                      <CurrencyInput
                        value={variantCosts['_default'] != null && variantCosts['_default'] !== '' ? Number(variantCosts['_default']) : null}
                        onChange={(value) => setVariantCosts((prev) => ({ ...prev, _default: value == null ? '' : String(value) }))}
                        placeholder={product?.cost?.toString() || '0,00'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço de Venda</Label>
                      <CurrencyInput
                        value={variantBasePrices['_default'] != null && variantBasePrices['_default'] !== '' ? Number(variantBasePrices['_default']) : null}
                        onChange={(value) => setVariantBasePrices((prev) => ({ ...prev, _default: value == null ? '' : String(value) }))}
                        placeholder={product?.basePrice?.toString() || '0,00'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço Promocional</Label>
                      <CurrencyInput
                        value={variantPromotionalPrices['_default'] != null && variantPromotionalPrices['_default'] !== '' ? Number(variantPromotionalPrices['_default']) : null}
                        onChange={(value) => setVariantPromotionalPrices((prev) => ({ ...prev, _default: value == null ? '' : String(value) }))}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
              )}
              </fieldset>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
      </div>

      {/* Form Actions - Sticky Footer */}
      <div className="sticky bottom-0 bg-background border-t p-4 flex justify-end gap-2 -mx-6 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="cursor-pointer">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || (!product && erpIntegrated)} className="cursor-pointer">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            product ? "Salvar Alteracoes" : "Criar Produto"
          )}
        </Button>
      </div>

      <Drawer
        open={isMeasurementTableDrawerOpen}
        onOpenChange={handleMeasurementTableDrawerOpenChange}
        direction="right"
      >
        <DrawerContent className="w-full sm:w-[65vw] sm:max-w-none flex flex-col">
          <div className="flex items-start justify-between gap-4 p-4 border-b shrink-0">
            <div>
              <DrawerTitle>{editingMeasurementTableId ? 'Editar tabela de medidas' : 'Nova tabela de medidas'}</DrawerTitle>
              <DrawerDescription>
                {editingMeasurementTableId
                  ? 'Atualize o nome e a estrutura da tabela selecionada.'
                  : 'Defina o nome e monte a estrutura dinâmica da tabela.'}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          <div className="px-4 pt-4 pb-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={newMeasurementTableName}
                onChange={(event) => setNewMeasurementTableName(event.target.value)}
                placeholder="Ex: Blazer"
              />
            </div>

            <div className="space-y-2">
              <Label>Estrutura da tabela</Label>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {normalizeMeasurementGrid(newMeasurementTableGrid).map((row, rowIndex) => (
                      <tr key={`measurement-row-${rowIndex}`} className="border-t first:border-t-0">
                        {row.map((cell, colIndex) => (
                          <td key={`measurement-cell-${rowIndex}-${colIndex}`} className="border-r last:border-r-0 p-1">
                            {rowIndex === 0 ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={cell}
                                  onChange={(event) =>
                                    updateMeasurementGridCell(rowIndex, colIndex, event.target.value)
                                  }
                                  placeholder={`Coluna ${colIndex + 1}`}
                                  className="h-9"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 cursor-pointer"
                                  onClick={() => removeMeasurementGridColumn(colIndex)}
                                  disabled={(normalizeMeasurementGrid(newMeasurementTableGrid)[0]?.length || 2) <= 2}
                                  title="Remover coluna"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Input
                                value={cell}
                                onChange={(event) =>
                                  updateMeasurementGridCell(rowIndex, colIndex, event.target.value)
                                }
                                placeholder={`Valor ${colIndex + 1}`}
                                className="h-9"
                              />
                            )}
                          </td>
                        ))}
                        <td className="w-10 p-1 border-l text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => removeMeasurementGridRow(rowIndex)}
                            disabled={rowIndex === 0}
                            title="Remover linha"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={addMeasurementGridColumn} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Coluna
                </Button>
                <Button type="button" variant="outline" onClick={addMeasurementGridRow} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Linha
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-4 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => handleMeasurementTableDrawerOpenChange(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateMeasurementTable()}
              disabled={isCreatingMeasurementTable}
              className="cursor-pointer"
            >
              {isCreatingMeasurementTable ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editingMeasurementTableId ? 'Salvar alterações' : 'Salvar tabela'
              )}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(selectedVariantForDrawer)}
        onOpenChange={(open) => {
          if (!open) {
            setVariantDrawerKey(null);
          }
        }}
        direction="right"
      >
        <DrawerContent className="w-full sm:w-[50vw] sm:max-w-none">
          {selectedVariantForDrawer && (
            <>
              <div className="flex items-start justify-between gap-4 p-4 border-b">
                <div>
                  <DrawerTitle>Editar SKU</DrawerTitle>
                  <DrawerDescription>{selectedVariantForDrawer.combinationLabel || 'Único'}</DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </DrawerClose>
              </div>

              <div className="px-4 pt-4 pb-4 space-y-4 overflow-y-auto">
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Status da variante</div>
                      <div className="text-xs text-muted-foreground">Quando desativada, preços e estoque ficam bloqueados.</div>
                    </div>
                    <Switch
                      checked={!isVariantDisabled(selectedVariantForDrawer.variantKey)}
                      onCheckedChange={() => toggleVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={erpIntegrated
                      ? (selectedVariantForDrawer.variantSku || '')
                      : displayVariantSku(
                          selectedVariantForDrawer.variantKey,
                          {
                            variantId: selectedVariantForDrawer.id ? String(selectedVariantForDrawer.id) : undefined,
                            attributeValueIds: selectedVariantForDrawer.attribute_values,
                            color: selectedVariantForDrawer.color,
                            size: selectedVariantForDrawer.size,
                          },
                          selectedVariantForDrawer.variantSku,
                        )}
                    onChange={(e) =>
                      !erpIntegrated && setVariantSkuOverrides((prev) => ({
                        ...prev,
                        [selectedVariantForDrawer.variantKey]: e.target.value,
                      }))
                    }
                    placeholder={erpIntegrated
                      ? (selectedVariantForDrawer.variantSku || '')
                      : displayVariantSku(
                          selectedVariantForDrawer.variantKey,
                          {
                            variantId: selectedVariantForDrawer.id ? String(selectedVariantForDrawer.id) : undefined,
                            attributeValueIds: selectedVariantForDrawer.attribute_values,
                            color: selectedVariantForDrawer.color,
                            size: selectedVariantForDrawer.size,
                          },
                          selectedVariantForDrawer.variantSku,
                        )}
                    className="font-mono text-sm"
                    disabled={erpIntegrated}
                    readOnly={erpIntegrated}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Atributos</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {selectedVariantForDrawer.combinationLabel || 'Único'}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Preço de Custo</Label>
                    <CurrencyInput
                      value={variantCosts[selectedVariantForDrawer.variantKey] ? Number(variantCosts[selectedVariantForDrawer.variantKey]) : null}
                      onChange={(value) => setVariantCosts({
                        ...variantCosts,
                        [selectedVariantForDrawer.variantKey]: value == null ? "" : value.toString()
                      })}
                      placeholder={product?.cost?.toString() || "0,00"}
                      disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço de Venda</Label>
                    <CurrencyInput
                      value={variantBasePrices[selectedVariantForDrawer.variantKey] ? Number(variantBasePrices[selectedVariantForDrawer.variantKey]) : null}
                      onChange={(value) => setVariantBasePrices({
                        ...variantBasePrices,
                        [selectedVariantForDrawer.variantKey]: value == null ? "" : value.toString()
                      })}
                      placeholder={product?.basePrice?.toString() || "0,00"}
                      disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço Promocional</Label>
                    <CurrencyInput
                      value={variantPromotionalPrices[selectedVariantForDrawer.variantKey] ? Number(variantPromotionalPrices[selectedVariantForDrawer.variantKey]) : null}
                      onChange={(value) => setVariantPromotionalPrices({
                        ...variantPromotionalPrices,
                        [selectedVariantForDrawer.variantKey]: value == null ? "" : value.toString()
                      })}
                      placeholder="0,00"
                      disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>NCM</Label>
                    <Input
                      value={variantNcms[selectedVariantForDrawer.variantKey] ?? ''}
                      onChange={(e) =>
                        setVariantNcms((prev) => ({
                          ...prev,
                          [selectedVariantForDrawer.variantKey]: e.target.value,
                        }))
                      }
                      placeholder="Ex: 6109.10.00"
                      disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Código de barras</Label>
                    <Input
                      value={variantBarcodes[selectedVariantForDrawer.variantKey] ?? ''}
                      onChange={(e) =>
                        setVariantBarcodes((prev) => ({
                          ...prev,
                          [selectedVariantForDrawer.variantKey]: e.target.value,
                        }))
                      }
                      placeholder="Ex: 7891234567890"
                      disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? 'Disponível' : 'Estoque'}</Label>
                    {stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' || stockModeConfig === 'FANTASY' ? (
                      <div className="pt-1">
                        <Switch
                          checked={normalizeStockInputByMode(variantStocks[selectedVariantForDrawer.variantKey] ?? 0) > 0}
                          onCheckedChange={(checked) => setVariantStocks({
                            ...variantStocks,
                            [selectedVariantForDrawer.variantKey]: checked ? 1 : 0
                          })}
                          disabled={isVariantDisabled(selectedVariantForDrawer.variantKey) || !hasProductTabPermission.inventoryEdit}
                        />
                      </div>
                    ) : (
                      <IntegerInput
                        label=""
                        value={normalizeStockInputByMode(variantStocks[selectedVariantForDrawer.variantKey] ?? 0)}
                        onChange={(value) => setVariantStocks({
                          ...variantStocks,
                          [selectedVariantForDrawer.variantKey]: normalizeStockInputByMode(value ?? 0)
                        })}
                        min={0}
                        max={stockModeConfig === 'FANTASY' ? stockVariantMaxQty : undefined}
                        disabled={isVariantDisabled(selectedVariantForDrawer.variantKey) || !hasProductTabPermission.inventoryEdit}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(selectedAttributeForValuePicker)}
        onOpenChange={(open) => {
          if (!open) {
            setAttributeValuePickerAttributeId(null);
            setAttributeValuePickerSearch('');
          }
        }}
        direction="right"
      >
        <DrawerContent className="flex flex-col data-[vaul-drawer-direction=right]:w-[34.3rem]! data-[vaul-drawer-direction=right]:max-w-[92vw]! data-[vaul-drawer-direction=right]:h-dvh!">
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Selecionar valores do atributo</DrawerTitle>
              <DrawerDescription>
                {selectedAttributeForValuePicker
                  ? `${selectedAttributeForValuePicker.name} • selecionados: ${(selectedAttributeValuesByAttribute[selectedAttributeForValuePicker.id] || []).length} de ${selectedAttributeForValuePicker.values?.length || 0}`
                  : 'Selecione os valores desejados.'}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-4 pt-4 pb-4">
            {selectedAttributeForValuePicker ? (
              <Command shouldFilter={false} className="h-full flex flex-col">
                <CommandInput
                  placeholder="Buscar valor..."
                  value={attributeValuePickerSearch}
                  onValueChange={setAttributeValuePickerSearch}
                />
                <CommandList className="flex-1 min-h-0 max-h-none overflow-y-auto">
                  <CommandEmpty>Nenhum valor encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredValuePickerOptions.map((value) => {
                      const selected = isAttributeValueSelected(selectedAttributeForValuePicker, value.id);
                      return (
                        <CommandItem
                          key={value.id}
                          value={`${value.id}-${value.name || value.code}`}
                          onSelect={() => toggleAttributeValue(selectedAttributeForValuePicker, value.id)}
                          className="cursor-pointer"
                        >
                          <Check className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                          <span>{value.name || value.code}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <p className="text-sm text-muted-foreground">Atributo não encontrado.</p>
            )}
          </div>

          <div className="border-t bg-background p-4">
            <DrawerClose asChild>
              <Button
                type="button"
                className="w-full cursor-pointer bg-black text-white hover:bg-black/90"
              >
                Fechar
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isStoreColorsDrawerOpen}
        onOpenChange={(open) => {
          setIsStoreColorsDrawerOpen(open);
          if (!open) {
            setSelectedColorManagerAttributeId(null);
          }
        }}
        direction="right"
      >
        <DrawerContent>
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Gerenciar cores da loja</DrawerTitle>
              <DrawerDescription>
                Defina e atualize as cores do atributo selecionado sem vínculo com o produto atual.
                {selectedColorManagerAttribute?.code ? ` Codigo: ${selectedColorManagerAttribute.code}.` : ''}
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
              attributes={attributes}
              storeId={storeId}
              colorAttributeId={selectedColorManagerAttributeId}
              isErpIntegrated={erpIntegrated}
              onRefreshAttributes={onRefreshAttributes}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isStoreSizesDrawerOpen}
        onOpenChange={(open) => {
          setIsStoreSizesDrawerOpen(open);
          if (!open) {
            setSelectedSizeManagerAttributeId(null);
          }
        }}
        direction="right"
      >
        <DrawerContent>
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Gerenciar tamanhos da loja</DrawerTitle>
              <DrawerDescription>
                Edite o nome do atributo e dos tamanhos. O código interno de cada valor não pode ser alterado.
                {selectedSizeManagerAttribute?.code ? ` Codigo: ${selectedSizeManagerAttribute.code}.` : ''}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          <div className="px-4 pt-4 pb-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tamanhos da Loja</CardTitle>
                <CardDescription>
                  Catálogo de tamanhos da loja. Adicione, ordene com as setas e remova tamanhos do catálogo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSizeManagerAttribute ? (
                  <StoreAttributeNameField
                    attributeId={selectedSizeManagerAttribute.id}
                    attributeName={selectedSizeManagerAttribute.name}
                    attributeCode={selectedSizeManagerAttribute.code}
                    onRefreshAttributes={onRefreshAttributes}
                    disabled={erpIntegrated}
                  />
                ) : null}

                <div className={erpIntegrated ? "hidden" : undefined}>
                  <div className="flex gap-2">
                    <Input
                      value={newStoreSize}
                      onChange={(event) => setNewStoreSize(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleCreateStoreSize();
                        }
                      }}
                      placeholder="Novo tamanho da loja"
                      disabled={isAddingStoreSize || isSavingStoreSizesOrder}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleCreateStoreSize()}
                      disabled={!normalizeStoreSizeLabel(newStoreSize) || isAddingStoreSize || isSavingStoreSizesOrder}
                    >
                      {isAddingStoreSize ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span className="ml-2">Adicionar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {managedSizeValues.map((sizeValue, index) => {
                    const draftName = sizeValueNameDrafts[sizeValue.id] ?? sizeValue.name;
                    const isDirty = draftName.trim() !== sizeValue.name.trim();

                    return (
                      <div
                        key={sizeValue.id}
                        className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <GripVertical className="h-4 w-4 shrink-0 opacity-50" />
                          <Input
                            value={draftName}
                            onChange={(event) =>
                              setSizeValueNameDrafts((prev) => ({
                                ...prev,
                                [sizeValue.id]: event.target.value,
                              }))
                            }
                            className="h-8 max-w-[220px] text-sm font-medium"
                            disabled={isSavingStoreSizesOrder || savingSizeValueId === sizeValue.id}
                          />
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            ({sizeValue.code})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            disabled={!isDirty || isSavingStoreSizesOrder || savingSizeValueId === sizeValue.id}
                            onClick={() => void saveManagedSizeValueName(sizeValue.id, sizeValue.name)}
                            aria-label={`Salvar ${sizeValue.name}`}
                          >
                            {savingSizeValueId === sizeValue.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveManagedSizeValue(sizeValue.id, 'up')}
                            disabled={isSavingStoreSizesOrder || index === 0 || savingSizeValueId === sizeValue.id}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveManagedSizeValue(sizeValue.id, 'down')}
                            disabled={
                              isSavingStoreSizesOrder
                              || index === managedSizeValues.length - 1
                              || savingSizeValueId === sizeValue.id
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void removeStoreSize(normalizeStoreSizeLabel(sizeValue.name))}
                            disabled={isSavingStoreSizesOrder || savingSizeValueId === sizeValue.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Edite o nome e salve. Use as setas para reordenar os valores do atributo de tamanho.
                </p>

                {managedSizeValues.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Ruler className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum tamanho cadastrado na loja</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isGenericAttributeDrawerOpen}
        onOpenChange={(open) => {
          setIsGenericAttributeDrawerOpen(open);
          if (!open) {
            setSelectedManagedAttributeId(null);
            setGenericAttributeDrawerMode("manage");
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
              key={genericAttributeDrawerMode === "create" ? `create-${genericCreateResetKey}` : `manage-${selectedManagedAttribute?.id ?? 'none'}`}
              attribute={genericAttributeDrawerMode === "manage" ? selectedManagedAttribute : null}
              nextAttributeSortOrder={nextAttributeSortOrder}
              mode={genericAttributeDrawerMode === "manage" ? "manage-values" : "create-attribute"}
              canCreateAttributes={!erpIntegrated}
              storeId={storeId}
              onAttributeCreated={(createdAttribute) => {
                setGenericAttributeDrawerMode("manage");
                setSelectedManagedAttributeId(createdAttribute.id);
                setIsGenericAttributeDrawerOpen(true);
              }}
              onRefreshAttributes={onRefreshAttributes}
            />
          </div>
        </DrawerContent>
      </Drawer>
      </form>
    </Form>
  );
}
