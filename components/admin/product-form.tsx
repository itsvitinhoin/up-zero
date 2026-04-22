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
  ImageIcon,
  Layers,
  DollarSign,
  ArrowDown,
  ArrowUp,
  FilterX
} from "lucide-react";
import type { Product, Category, ProductColor, ProductVariant, StockMode } from "@/lib/types";
import { INFINITE_STOCK_MAX_QTY } from "@/lib/stock-mode";
import type { AttributesContextType } from "@/components/admin/attributes-provider";
import { StoreColorsManager } from "./store-colors-manager";
import { GenericAttributeValuesManager } from "./generic-attribute-values-manager";
import { createColorValue, createSizeValue, deleteAttributeValue, updateAttributeValueMeta, updateAttributeValueSortOrder } from "@/lib/actions/attribute-values";
import { deleteStoreAttribute, updateStoreAttributeSortOrder } from "@/lib/actions/attributes";
import { getSiteSettingsAction } from "@/lib/actions/settings";
import { toast } from "sonner";
import type { Attribute } from "@/lib/actions/attributes";

// Validation schema
const productFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").min(3, "Nome deve ter no mínimo 3 caracteres"),
  sku: z.string().min(1, "SKU é obrigatório"),
  description: z.string().optional(),
  materials: z.string().optional(),
  measures: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

// Standard sizes for fashion
const STANDARD_SIZES = ["PP", "P", "M", "G", "GG", "XG", "XXG", "34", "36", "38", "40", "42", "44", "46", "48", "50"];

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
  onSubmit: (formData: FormData) => Promise<void>;
  onSaveColorImages?: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  onRefreshAttributes?: () => Promise<void>;
}

export function ProductForm({
  product,
  categories,
  attributes,
  storeId,
  onSubmit,
  onSaveColorImages,
  onCancel,
  onRefreshAttributes,
}: ProductFormProps) {
  type ImageGroupingType = 'product' | 'attributes' | 'full_sku';
  const [activeTab, setActiveTab] = useState("general");
  const [isStoreColorsDrawerOpen, setIsStoreColorsDrawerOpen] = useState(false);
  const [isStoreSizesDrawerOpen, setIsStoreSizesDrawerOpen] = useState(false);
  const [isGenericAttributeDrawerOpen, setIsGenericAttributeDrawerOpen] = useState(false);
  const [genericAttributeDrawerMode, setGenericAttributeDrawerMode] = useState<"create" | "manage">("manage");
  const [genericCreateResetKey, setGenericCreateResetKey] = useState(0);
  const [selectedManagedAttributeId, setSelectedManagedAttributeId] = useState<number | null>(null);
  const [selectedColorManagerAttributeId, setSelectedColorManagerAttributeId] = useState<number | null>(null);
  const [attributeManagerSelection, setAttributeManagerSelection] = useState<"color" | "size" | "new">("color");
  const [deleteAttributeDialogOpen, setDeleteAttributeDialogOpen] = useState(false);
  const [attributeToDelete, setAttributeToDelete] = useState<Attribute | null>(null);
  const [isDeletingAttribute, setIsDeletingAttribute] = useState(false);
  const [imageGroupingType, setImageGroupingType] = useState<ImageGroupingType>('attributes');
  const [selectedImageGroupingAttributeIds, setSelectedImageGroupingAttributeIds] = useState<number[]>([]);
  const imageGroupingUserChangedRef = useRef(false);
  const [variantAttributeFilters, setVariantAttributeFilters] = useState<Record<number, string>>({});
  const [variantDrawerKey, setVariantDrawerKey] = useState<string | null>(null);
  const [disabledVariantKeys, setDisabledVariantKeys] = useState<string[]>([]);
  const [variantStatusFilter, setVariantStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [stockModeConfig, setStockModeConfig] = useState<StockMode>('FANTASY');
  const [stockVariantMaxQty, setStockVariantMaxQty] = useState(999);
  // Form validation with react-hook-form
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      sku: product?.sku || "",
      description: product?.description || "",
      materials: product?.materials || "",
      measures: product?.measures || "",
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
  
  // Colors with images
  const [colors, setColors] = useState<FormColor[]>(
    (product?.colors || []).map((c, i) => ({ 
      id: c.id || `color-${i}`,
      name: c.name,
      hex: c.hex,
      images: c.images || []
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
    const storeColorValue = typeof color.attributeValueId === 'number'
      ? storeColorValues.find((value) => value.id === color.attributeValueId)
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
      const key = typeof color.attributeValueId === 'number'
        ? `id:${color.attributeValueId}`
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
      const existingColorIds = new Set(colors.map(c => c.attributeValueId).filter(Boolean));
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
        if (!color.attributeValueId) return true;
        // Remover cores que foram deletadas da loja
        return storeColorIds.has(color.attributeValueId);
      })
    );

    setActiveProductColorIds(prev => {
      const storeColorIds = new Set(attributes?.colorAttribute?.values?.map(v => v.id) || []);
      return prev.filter(colorId => {
        // Manter cores que não têm attributeValueId (cores do produto)
        const hasNoAttrId = !colors.some(c => c.id === colorId && c.attributeValueId);
        if (hasNoAttrId) return true;
        // Para cores com attributeValueId, verificar se ainda existem na loja
        const color = colors.find(c => c.id === colorId);
        if (!color?.attributeValueId) return true;
        return storeColorIds.has(color.attributeValueId);
      });
    });
  }, [attributes?.colorAttribute?.values?.map(v => v.id).join(',') || '']);

  // Sincronizar estados quando o produto mudar
  useEffect(() => {
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
      attributeValueId: c.attributeValueId,
    }));

    // Adicionar cores da loja que não estão no produto
    const productColorValueIds = new Set(productColors.map(c => c.attributeValueId).filter(Boolean));
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
      const newVariantImages: Record<string, string[]> = {};
      const newHighlightedVariantKeys: Record<string, boolean> = {};
      const newDisabledVariantKeys: string[] = [];
      const newVariantSkuOverrides: Record<string, string> = {};
      const selectedValuesByAttribute: Record<number, Set<number>> = {};

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
        const isActiveVariant = v.active !== false;

        const key = attributeValueIds.length > 0
          ? buildVariantKeyFromAttributeValues(attributeValueIds)
          : `${v.color}-${v.size}`;

        if (Array.isArray(v.images) && v.images.length > 0) {
          const normalizedImages = v.images
            .filter((url: unknown): url is string => typeof url === 'string')
            .map((url: string) => url.trim())
            .filter((url: string) => url.length > 0);

          if (normalizedImages.length > 0 && !newVariantImages[key]) {
            newVariantImages[key] = normalizedImages;
          }
        }

        if (isActiveVariant) {
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

        if (v.active === false) {
          const variantSize = String(v.size || '').trim().toUpperCase();
          const shouldPreserveDisabledState = !variantSize || effectiveSizes.includes(variantSize);
          if (shouldPreserveDisabledState) {
            newDisabledVariantKeys.push(key);
          }
        }

        if (v.sku) {
          newVariantSkuOverrides[key] = v.sku;
        }

        if (v.isHighlighted === true) {
          newHighlightedVariantKeys[key] = true;
        }
      });

      setVariantStocks(newStocks);
      setVariantBasePrices(newBasePrices);
      setVariantSkuOverrides(newVariantSkuOverrides);
      setVariantCosts(newCosts);
      setVariantPromotionalPrices(newPromoPrices);
      setVariantImages(newVariantImages);
      setHighlightedVariantKeys(newHighlightedVariantKeys);
      setDisabledVariantKeys(Array.from(new Set(newDisabledVariantKeys)));

      if (Object.keys(selectedValuesByAttribute).length > 0) {
        setSelectedAttributeValuesByAttribute((prev) => {
          const merged: Record<number, number[]> = { ...prev };
          Object.entries(selectedValuesByAttribute).forEach(([attributeId, valueSet]) => {
            const current = new Set(merged[Number(attributeId)] || []);
            valueSet.forEach((valueId) => current.add(valueId));
            merged[Number(attributeId)] = Array.from(current);
          });
          return merged;
        });
      }
    } else {
      setDisabledVariantKeys([]);
      setVariantSkuOverrides({});
      setHighlightedVariantKeys({});
    }
  }, [product?.id, form]);

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
  const [storeSizesDisplayOrder, setStoreSizesDisplayOrder] = useState<string[]>(product?.sizes || []);
  const [draggedStoreSize, setDraggedStoreSize] = useState<string | null>(null);
  const [dragOverStoreSize, setDragOverStoreSize] = useState<string | null>(null);
  const [isSavingStoreSizesOrder, setIsSavingStoreSizesOrder] = useState(false);
  const [selectedAttributeValuesByAttribute, setSelectedAttributeValuesByAttribute] = useState<Record<number, number[]>>({});

  useEffect(() => {
    const allAttributes = attributes?.attributes || [];
    if (!allAttributes.length) {
      setSelectedAttributeValuesByAttribute({});
      return;
    }

    const nextMap: Record<number, number[]> = {};
    const activeColorValueIds = new Set(
      colors
        .filter((color) => activeProductColorIds.includes(color.id) && typeof color.attributeValueId === 'number')
        .map((color) => color.attributeValueId as number)
    );

    const activeSizeNames = new Set(sizes.map((size) => size.trim().toUpperCase()));

    allAttributes.forEach((attribute) => {
      const code = String(attribute.code || '').trim().toLowerCase();

      if (['color', 'colors', 'cor', 'cores'].includes(code)) {
        const selectedIds = attribute.values
          .filter((value) => activeColorValueIds.has(value.id))
          .map((value) => value.id);
        nextMap[attribute.id] = selectedIds;
        return;
      }

      if (['size', 'sizes', 'tamanho', 'tamanhos'].includes(code)) {
        const selectedIds = attribute.values
          .filter((value) => {
            const name = (value.name || value.code || '').trim().toUpperCase();
            return activeSizeNames.has(name);
          })
          .map((value) => value.id);
        nextMap[attribute.id] = selectedIds;
        return;
      }

      nextMap[attribute.id] = [];
    });

    setSelectedAttributeValuesByAttribute((prev) => {
      const merged: Record<number, number[]> = {};

      allAttributes.forEach((attribute) => {
        const validValueIds = new Set(attribute.values.map((value) => value.id));
        const previousIds = (prev[attribute.id] || []).filter((id) => validValueIds.has(id));
        const derivedIds = nextMap[attribute.id] || [];

        // Apenas adicionar chaves com valores selecionados (nunca chaves vazias)
        if (derivedIds.length > 0) {
          merged[attribute.id] = derivedIds;
        } else if (previousIds.length > 0) {
          merged[attribute.id] = previousIds;
        }
        // Se ambos são vazios, não cria entrada no merged (remove chaves órfãs)
      });

      return merged;
    });
  }, [attributes?.attributes, colors, activeProductColorIds, sizes]);

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
  const [highlightedVariantKeys, setHighlightedVariantKeys] = useState<Record<string, boolean>>({});
  const [variantImages, setVariantImages] = useState<Record<string, string[]>>({});
  const [uploadingImageGroupKey, setUploadingImageGroupKey] = useState<string | null>(null);

  function buildVariantKeyFromAttributeValues(attributeValueIds: number[]) {
    if (!attributeValueIds.length) return 'default';
    return [...attributeValueIds].sort((a, b) => a - b).join('|');
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

  useEffect(() => {
    let cancelled = false;

    const loadStockSettings = async () => {
      const result = await getSiteSettingsAction();
      if (!result.success || !result.data || cancelled) return;

      setStockModeConfig(result.data.stockMode || 'FANTASY');
      setStockVariantMaxQty(Math.max(1, Number(result.data.variantMaxQty || 999)));
    };

    void loadStockSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function normalizeStockInputByMode(rawValue: number | null | undefined): number {
    const numericValue = Math.max(0, Math.floor(Number(rawValue || 0)));

    if (stockModeConfig === 'BINARY') {
      return numericValue > 0 ? 1 : 0;
    }

    if (stockModeConfig === 'INFINITO') {
      return numericValue > 0 ? INFINITE_STOCK_MAX_QTY : 0;
    }

    if (stockModeConfig === 'FANTASY') {
      return Math.min(numericValue, stockVariantMaxQty);
    }

    return numericValue;
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

  // Generate variants from selected attribute values (ordered by attribute sort_order)
  function generateVariants(selectedMapOverride?: Record<number, number[]>) {
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
        attribute_values: number[];
        images: string[];
        active: boolean;
        isHighlighted: boolean;
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

        const selectedIdSet = new Set(selectedIds);
        const values = attribute.values
          .filter((value) => selectedIdSet.has(value.id))
          .sort((a, b) => {
            const bySortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
            if (bySortOrder !== 0) return bySortOrder;
            return (a.name || a.code || '').localeCompare(b.name || b.code || '');
          });

        if (!values.length) return null;

        return { attribute, values };
      })
      .filter((group): group is { attribute: Attribute; values: Attribute['values'] } => Boolean(group));

    if (!selectedAttributeGroups.length) {
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

      const hasImageGroupOverride = Object.prototype.hasOwnProperty.call(variantImages, imageGroupKey);
      const hasLegacyGroupOverride = Object.prototype.hasOwnProperty.call(variantImages, legacyImageGroupKey);
      const hasVariantOverride = Object.prototype.hasOwnProperty.call(variantImages, variantKey);

      const variantSpecificImages = hasImageGroupOverride
        ? (variantImages[imageGroupKey] || [])
        : hasLegacyGroupOverride
          ? (variantImages[legacyImageGroupKey] || [])
          : hasVariantOverride
            ? (variantImages[variantKey] || [])
            : imageGroupKey === 'product'
              ? defaultImages
              : (colorObj?.images || []);

      const skuSuffix = combination
        .map((item) => String(item.value.code || item.value.name || '').trim().toUpperCase())
        .filter(Boolean)
        .join('-');

      newVariants.push({
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
        variantSku: variantSkuOverrides[variantKey]
          ?? (skuSuffix
          ? `${form.getValues('sku')}-${skuSuffix}`
          : form.getValues('sku')),
        stock: normalizeStockInputByMode(variantStocks[variantKey] || 0),
        priceOverride: promotionalPrice,
        basePrice,
        cost,
        images: variantSpecificImages,
        attribute_values: attributeValueIds,
        active: !isVariantDisabled(variantKey),
        isHighlighted: highlightedVariantKeys[variantKey] === true,
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

    setStoreSizesDisplayOrder((prev) => {
      const fromIndex = prev.indexOf(fromSize);
      const toIndex = prev.indexOf(toSize);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      const selectedSet = new Set(storeSizeSelections);
      const reorderedSelected = next.filter((size) => selectedSet.has(size));
      setStoreSizeSelections(reorderedSelected);
      setSizes(reorderedSelected);

      void persistStoreSizesOrder(next);
      return next;
    });
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

  async function toggleStoreSize(size: string) {
    const sizeAttributesFromStore = (attributes?.attributes || []).filter((attribute) =>
      ['size', 'sizes', 'tamanho', 'tamanhos'].includes(String(attribute.code || '').trim().toLowerCase())
    );

    const isRemoving = storeSizeSelections.includes(size);
    
    setStoreSizeSelections((prev) =>
      isRemoving ? prev.filter((s) => s !== size) : [...prev, size]
    );

    setSizes((prev) =>
      isRemoving ? prev.filter((s) => s !== size) : [...prev, size]
    );

    if (isRemoving) {
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
    }

    if (isRemoving) {
      // Remover do backend
      const sizeValue = sizeAttributesFromStore
        .flatMap((attribute) => attribute.values || [])
        .find((v) => {
          const valueName = (v.name || v.code || '').trim().toUpperCase();
          return valueName === size;
        });

      if (sizeValue) {
        const result = await deleteAttributeValue(sizeValue.id);
        if (result.success) {
          onRefreshAttributes?.();
          toast('Tamanho removido', {
            description: 'O tamanho foi removido do catálogo.',
          });
        } else {
          toast.error('Falha ao remover', {
            description: 'Não foi possível remover o tamanho.',
          });
        }
      }
    } else {
      const matchingSizeValueIds = sizeAttributesFromStore
        .flatMap((attribute) => attribute.values || [])
        .filter((value) => {
          const valueName = (value.name || value.code || '').trim().toUpperCase();
          return valueName === size;
        })
        .map((value) => Number(value.id))
        .filter((id) => Number.isInteger(id));

      // Se a variante desse tamanho estava marcada como inativa anteriormente,
      // limpa o estado local de desativação para permitir reativar ao salvar.
      if (matchingSizeValueIds.length > 0) {
        const sizeValueIdsSet = new Set(matchingSizeValueIds);
        setDisabledVariantKeys((prev) =>
          prev.filter((key) => {
            const ids = key
              .split('|')
              .map((part) => Number(part))
              .filter((id) => Number.isInteger(id));
            return !ids.some((id) => sizeValueIdsSet.has(id));
          })
        );
      }

      // Adicionar ao backend
      if (storeId) {
        const existingSizeCodes = sizeAttributesFromStore
          .flatMap((attribute) => attribute.values || [])
          .map((v) => String(v.code || '').trim())
          .filter(Boolean);
        const sizeCode = generateUniqueCode(size, existingSizeCodes);

        if (!existingSizeCodes.includes(sizeCode)) {
          const result = await createSizeValue(size, storeId);
          if (result.success) {
            onRefreshAttributes?.();
            toast('Tamanho adicionado', {
              description: 'O tamanho foi adicionado ao catálogo.',
            });
          } else {
            toast.error('Falha ao adicionar', {
              description: 'Não foi possível adicionar o tamanho.',
            });
          }
        }
      }
    }
  }

  function isAttributeValueSelected(attributeId: number, valueId: number) {
    return (selectedAttributeValuesByAttribute[attributeId] || []).includes(valueId);
  }

  function toggleAttributeValue(attribute: Attribute, valueId: number) {
    const code = String(attribute.code || '').trim().toLowerCase();
    const selectedValue = attribute.values.find((value) => value.id === valueId);
    if (!selectedValue) return;

    setSelectedAttributeValuesByAttribute((prev) => {
      const current = prev[attribute.id] || [];
      const isSelected = current.includes(valueId);
      const next = isSelected
        ? current.filter((id) => id !== valueId)
        : [...current, valueId];

      return {
        ...prev,
        [attribute.id]: next,
      };
    });

    if (['color', 'colors', 'cor', 'cores'].includes(code)) {
      const existingColor = colors.find((color) => color.attributeValueId === valueId);
      if (existingColor) {
        setActiveProductColorIds((prev) =>
          prev.includes(existingColor.id)
            ? prev.filter((id) => id !== existingColor.id)
            : [...prev, existingColor.id]
        );
      } else {
        const newColorId = `store-color-${valueId}-${Date.now()}`;
        const newColor: FormColor = {
          id: newColorId,
          name: selectedValue.name,
          hex: resolveHexFromStoreColor(selectedValue.name, selectedValue.meta?.rgb),
          images: [],
          attributeValueId: valueId,
        };

        setColors((prev) => dedupeColors([...prev, newColor]));
        setActiveProductColorIds((prev) => [...prev, newColorId]);
      }
      return;
    }

    if (['size', 'sizes', 'tamanho', 'tamanhos'].includes(code)) {
      const normalizedSize = (selectedValue.name || selectedValue.code || '').trim().toUpperCase();
      if (!normalizedSize) return;

      setSizes((prev) =>
        prev.includes(normalizedSize)
          ? prev.filter((size) => size !== normalizedSize)
          : [...prev, normalizedSize]
      );
    }
  }

  // Handle form submit
  function buildFormData(values: ProductFormValues, overrideColors?: FormColor[]) {
    // Imagens globais do produto (fallback para produtos sem imagens por variante)
    let finalImages = defaultImages;
    const selectedColors = colors.filter(c => activeProductColorIds.includes(c.id));
    const colorsSnapshot = overrideColors || selectedColors;

    const fd = new FormData();
    fd.append('name', values.name);
    fd.append('slug', values.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    fd.append('sku', values.sku);
    fd.append('description', values.description || '');
    fd.append('materials', values.materials || '');
    fd.append('measures', values.measures || '');
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

      const activeColorValueIds = new Set(
        colorsSnapshot
          .filter((color) => activeProductColorIds.includes(color.id) && typeof color.attributeValueId === 'number')
          .map((color) => color.attributeValueId as number)
      );
      const activeSizeNames = new Set(sizes.map((size) => String(size).trim().toUpperCase()));

      allAttributes.forEach((attribute) => {
        const code = String(attribute.code || '').trim().toLowerCase();

        if (['color', 'colors', 'cor', 'cores'].includes(code)) {
          nextMap[attribute.id] = (attribute.values || [])
            .filter((value) => activeColorValueIds.has(value.id))
            .map((value) => value.id);
          return;
        }

        if (['size', 'sizes', 'tamanho', 'tamanhos'].includes(code)) {
          nextMap[attribute.id] = (attribute.values || [])
            .filter((value) => {
              const normalized = (value.name || value.code || '').trim().toUpperCase();
              return activeSizeNames.has(normalized);
            })
            .map((value) => value.id);
        }
      });

      // Remover chaves com arrays vazios (para não enviar ao backend)
      Object.keys(nextMap).forEach((key) => {
        const attrId = Number(key);
        if (Array.isArray(nextMap[attrId]) && nextMap[attrId].length === 0) {
          delete nextMap[attrId];
        }
      });

      return nextMap;
    })();

    const generatedVariants = generateVariants(effectiveSelectedAttributeValuesByAttribute);
    const compactVariants = generatedVariants.map((variant) => ({
      variantSku: variant.variantSku,
      color: variant.color,
      size: variant.size,
      active: variant.active !== false,
      isHighlighted: variant.isHighlighted === true,
      stock: typeof variant.stock === 'number' ? variant.stock : 0,
      basePrice: typeof variant.basePrice === 'number' ? variant.basePrice : null,
      cost: typeof variant.cost === 'number' ? variant.cost : null,
      priceOverride: typeof variant.priceOverride === 'number' ? variant.priceOverride : null,
      images: Array.isArray(variant.images) ? variant.images : [],
      attribute_values: Array.isArray(variant.attribute_values) ? variant.attribute_values : [],
    }));
    const compactColors = colorsSnapshot.map((color) => ({
      name: color.name,
      images: Array.isArray(color.images) ? color.images : [],
    }));
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
    fd.append('sizes', JSON.stringify(sizes));
    fd.append('colors', JSON.stringify(compactColors));
    fd.append('attributeValuesByAttribute', JSON.stringify(effectiveSelectedAttributeValuesByAttribute));
    fd.append('imageGroupingType', imageGroupingType);
    fd.append('imageGroupingAttributeIds', JSON.stringify(selectedImageGroupingAttributeIds));

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

  const availableSizes = Array.from(new Set([...storeSizeOptions, ...STANDARD_SIZES]));
  const availableSizesKey = availableSizes.join('|');

  useEffect(() => {
    setStoreSizesDisplayOrder((prev) => {
      if (!prev.length) {
        return availableSizes;
      }

      const availableSet = new Set(availableSizes);
      const preserved = prev.filter((size) => availableSet.has(size));
      const additions = availableSizes.filter((size) => !preserved.includes(size));
      return [...preserved, ...additions];
    });
  }, [availableSizesKey]);
  const imageColorVariants = colors.filter((color) => activeProductColorIds.includes(color.id));
  const generatedVariants = generateVariants();
  const selectedVariantForDrawer = useMemo(
    () => generatedVariants.find((variant) => variant.variantKey === variantDrawerKey) || null,
    [generatedVariants, variantDrawerKey]
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

    generatedVariants.forEach((variant) => {
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
  }, [generatedVariants, attributes?.attributes]);

  const filteredVariants = useMemo(() => {
    if (!variantAttributeFilterGroups.length) {
      if (variantStatusFilter === 'all') {
        return generatedVariants;
      }

      return generatedVariants.filter((variant) => {
        const disabled = isVariantDisabled(variant.variantKey);
        return variantStatusFilter === 'disabled' ? disabled : !disabled;
      });
    }

    return generatedVariants.filter((variant) =>
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
  }, [generatedVariants, variantAttributeFilterGroups, variantAttributeFilters, variantStatusFilter, disabledVariantKeys]);

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

  const totalStock = generatedVariants.reduce((sum, variant) => {
    const key = variant.variantKey;
    const normalizedStock = normalizeStockInputByMode(variantStocks[key] ?? 0);

    if (stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO') {
      return sum + (normalizedStock > 0 ? 1 : 0);
    }

    return sum + normalizedStock;
  }, 0);
  const tabs = ["general", "attributes", "images", "prices", "stock"] as const;
  const activeTabIndex = Math.max(0, tabs.indexOf(activeTab as (typeof tabs)[number]));

  const storeAttributes = (attributes?.attributes || []).slice().sort((a, b) => {
    const bySortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (bySortOrder !== 0) return bySortOrder;
    return a.name.localeCompare(b.name);
  });

  function handleImageGroupingTypeChange(type: ImageGroupingType) {
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

  function toggleImageGroupingAttribute(attributeId: number) {
    setSelectedImageGroupingAttributeIds((prev) =>
      prev.includes(attributeId)
        ? prev.filter((id) => id !== attributeId)
        : [...prev, attributeId]
    );
  }

  const imageGroupsForEditor = (() => {
    const baseSku = form.getValues('sku') || product?.sku || 'N/A';
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
      }];
    }

    const groups = new Map<string, { key: string; label: string; imageSku: string; images: string[] }>();

    generatedVariants.forEach((variant) => {
      const selectedValues = variant.selectedValues.map((value) => ({
        attributeId: value.attributeId,
        valueId: value.valueId,
      }));

      const key = buildImageGroupKey(variant.variantKey, selectedValues);
      const legacyKey = buildLegacyImageGroupKey(variant.variantKey, selectedValues);

      if (groups.has(key)) {
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
        images: key === 'product'
          ? defaultImages
          : (variantImages[key] || variantImages[legacyKey] || variantImages[variant.variantKey] || []),
      });
    });

    return Array.from(groups.values());
  })();

  async function uploadImagesToGroup(groupKey: string, files: FileList) {
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

      if (groupKey === 'product') {
        setDefaultImages((prev) => [...prev, ...uploadedUrls]);
      } else {
        setVariantImages((prev) => ({
          ...prev,
          [groupKey]: [...(prev[groupKey] || []), ...uploadedUrls],
        }));
      }
    } catch (error) {
      console.error('Upload group image error:', error);
      toast.error('Falha no upload da imagem');
    } finally {
      setUploadingImageGroupKey(null);
    }
  }

  function removeImageFromGroup(groupKey: string, currentImages: string[], imageIndex: number) {
    const updatedImages = (Array.isArray(currentImages) ? currentImages : []).filter((_, idx) => idx !== imageIndex);

    if (groupKey === 'product') {
      setDefaultImages(updatedImages);
      return;
    }

    setVariantImages((prev) => ({
      ...prev,
      [groupKey]: updatedImages,
    }));
  }

  const [orderedStoreAttributes, setOrderedStoreAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    setOrderedStoreAttributes(storeAttributes);
  }, [attributes?.attributes]);

  const selectedProductAttributes = orderedStoreAttributes.filter((attribute) => (attribute.values?.length || 0) > 0);

  const selectedManagedAttribute = selectedManagedAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedManagedAttributeId) || null
    : null;

  const selectedColorManagerAttribute = selectedColorManagerAttributeId
    ? orderedStoreAttributes.find((attribute) => attribute.id === selectedColorManagerAttributeId) || null
    : null;

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
      setIsStoreSizesDrawerOpen(true);
      return;
    }

    setGenericAttributeDrawerMode("manage");
    setSelectedManagedAttributeId(attribute.id);
    setIsGenericAttributeDrawerOpen(true);
  }

  function openSelectedAttributeManager() {
    if (attributeManagerSelection === "color") {
      const firstColorAttribute = orderedStoreAttributes.find((attribute) => isColorAttribute(attribute));
      setSelectedColorManagerAttributeId(firstColorAttribute?.id ?? null);
      setIsStoreColorsDrawerOpen(true);
      return;
    }

    if (attributeManagerSelection === "size") {
      setIsStoreSizesDrawerOpen(true);
      return;
    }

    setGenericAttributeDrawerMode("create");
    setSelectedManagedAttributeId(null);
    setGenericCreateResetKey((prev) => prev + 1);
    setIsGenericAttributeDrawerOpen(true);
  }

  function handleAttributeManagerSelectionChange(value: "color" | "size" | "new") {
    setAttributeManagerSelection(value);

    if (value === "new") {
      setGenericAttributeDrawerMode("create");
      setSelectedManagedAttributeId(null);
    }
  }

  async function moveAttribute(attributeId: number, direction: 'up' | 'down') {
    const index = orderedStoreAttributes.findIndex((attribute) => attribute.id === attributeId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedStoreAttributes.length) return;

    const reordered = [...orderedStoreAttributes];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setOrderedStoreAttributes(reordered);

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
      await onRefreshAttributes?.();
      return;
    }

    await onRefreshAttributes?.();
    toast.success('Ordem dos atributos atualizada');
  }

  function openDeleteAttributeDialog(attribute: Attribute) {
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
          <span className="min-w-0 break-words text-sm font-medium">{node.name}</span>
        </label>
        {node.children.length > 0 && (
          <div className="flex flex-col gap-1 w-full relative">
            {/* Linha guia visual para arvore */}
            <div className="absolute left-[9px] top-0 bottom-4 w-px bg-border" style={{ marginLeft: `${level * 20}px` }}></div>
            {node.children.map(child => renderCategoryNode(child as any, level + 1, field))}
          </div>
        )}
      </div>
    );
  };
  
  // Util helper for padding
  const max = (a: number, b: number) => a > b ? a : b;

  const categoryTree = buildCategoryTree(categories);

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit(handleSubmit)} className="flex flex-col min-h-full">
        <div className="flex-1 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="relative grid w-full grid-cols-5 rounded-[24px] bg-muted/60 p-1">
          <span
            className="absolute inset-y-0.75 left-0.75 rounded-md bg-background shadow-sm transition-transform duration-300 ease-out pointer-events-none z-0"
            style={{
              width: `calc(${100 / tabs.length}% - 6px)`,
              transform: `translateX(calc(${activeTabIndex * 100}% + ${activeTabIndex * 6}px))`,
            }}
          />
          <TabsTrigger value="general" className="relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="attributes" className="relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Atributos</span>
            {(activeProductColorIds.length > 0 || sizes.length > 0) && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-5 rounded-full px-1.5 bg-primary text-primary-foreground"
              >
                {activeProductColorIds.length + sizes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="images" className="relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Imagens</span>
          </TabsTrigger>
          <TabsTrigger value="prices" className="relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Preços</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-2xl cursor-pointer data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-transparent">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Estoque</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 rounded-full px-1.5 bg-primary text-primary-foreground"
            >
              {totalStock}
            </Badge>
          </TabsTrigger>
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
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
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

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3 overflow-x-hidden">
                          {categoryTree.map((root) => renderCategoryNode(root as any, 0, field))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

        {/* Attributes Tab */}
        <TabsContent value="attributes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Atributos do Produto</CardTitle>
                  <CardDescription>
                    Selecione os valores de cada atributo cadastrado para este produto.
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
                      <SelectItem value="new">Novo Atributo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={openSelectedAttributeManager}
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
                  {orderedStoreAttributes.map((attribute, index) => {
                    const selectedCount = (selectedAttributeValuesByAttribute[attribute.id] || []).length;
                    return (
                    <div
                      key={attribute.id}
                      className="rounded-md border px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium truncate">{attribute.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            code: {attribute.code} • selecionados: {selectedCount} • valores: {attribute.values?.length || 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="cursor-pointer"
                            disabled={index === 0}
                            onClick={() => moveAttribute(attribute.id, 'up')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="cursor-pointer"
                              disabled={index === orderedStoreAttributes.length - 1}
                            onClick={() => moveAttribute(attribute.id, 'down')}
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
                        {attribute.values?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {attribute.values.map((value) => {
                              const isSelected = isAttributeValueSelected(attribute.id, value.id);
                              return (
                                <button
                                  key={value.id}
                                  type="button"
                                  onClick={() => toggleAttributeValue(attribute, value.id)}
                                  className={`h-8 px-3 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-black text-white border-black hover:bg-black/90 dark:bg-black dark:border-black'
                                      : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
                                  }`}
                                >
                                  {value.name || value.code}
                                </button>
                              );
                            })}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imagens do Produto</CardTitle>
              <CardDescription>
                {imageGroupingType === 'product'
                  ? 'Todas as variantes compartilham as mesmas imagens.'
                  : imageGroupingType === 'attributes'
                    ? 'As imagens são agrupadas pelos atributos selecionados.'
                    : 'Cada combinação de SKU possui seu próprio grupo de imagens.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {imageGroupsForEditor.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{group.label}</div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                      {(group.images || []).map((img, idx) => (
                        <div key={`${group.key}-${idx}`} className="relative aspect-3/4 rounded-lg border overflow-hidden group">
                          <Image
                            src={img || "/placeholder.svg"}
                            alt={`${group.label} ${idx + 1}`}
                            fill
                            sizes="(max-width: 640px) 25vw, 12vw"
                            className="object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-8 w-8 bg-gray-500/40 hover:bg-gray-500/55 text-white cursor-pointer"
                            onClick={() => removeImageFromGroup(group.key, group.images || [], idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {idx === 0 && (
                            <Badge className="absolute bottom-2 left-2">Principal</Badge>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => imageGroupFileInputRefs.current[group.key]?.click()}
                        disabled={uploadingImageGroupKey === group.key}
                        className="aspect-3/4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
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
                        onChange={(e) => e.target.files && uploadImagesToGroup(group.key, e.target.files)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            </Card>
        </TabsContent>

        {/* Stock Tab */}
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
                      ? `Modo fantasia: limite máximo de ${stockVariantMaxQty} por variante.`
                      : 'Modo real: controle com quantidade numérica por variante.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!product && (
                <div className="text-sm text-muted-foreground mb-4">
                  Para salvar por variante, primeiro crie o produto.
                </div>
              )}
              {generatedVariants.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {activeVariantFilterCount === 0
                        ? `${generatedVariants.length} variantes`
                        : `${filteredVariants.length} de ${generatedVariants.length} variantes`}
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
                          setVariantStatusFilter('all');
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
                            {stockModeConfig === 'BINARY' ? 'Disponível' : 'Estoque'}
                          </th>
                          <th className="text-right p-3 font-medium">Destaque</th>
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
                                  {stockModeConfig === 'BINARY' || stockModeConfig === 'INFINITO' ? (
                                    <Switch
                                      checked={normalizeStockInputByMode(variantStocks[key] ?? 0) > 0}
                                      onCheckedChange={(checked) =>
                                        setVariantStocks({
                                          ...variantStocks,
                                          [key]: checked ? 1 : 0,
                                        })
                                      }
                                      disabled={variantDisabled}
                                    />
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
                                      disabled={variantDisabled}
                                    />
                                  )}
                                  <div className="w-8 shrink-0">
                                    {idx === 0 && stockModeConfig !== 'BINARY' && stockModeConfig !== 'INFINITO' && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 cursor-pointer"
                                        title="Aplicar estoque para as demais variações"
                                        onClick={() => applyVariantStockToAll(key)}
                                        disabled={variantDisabled}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end">
                                  <Switch
                                    checked={highlightedVariantKeys[key] === true}
                                    onCheckedChange={(checked) =>
                                      setHighlightedVariantKeys((prev) => ({
                                        ...prev,
                                        [key]: checked,
                                      }))
                                    }
                                    disabled={variantDisabled}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredVariants.length === 0 && (
                          <tr className="border-t">
                            <td colSpan={3} className="p-4 text-center text-muted-foreground">
                              Nenhuma variante encontrada para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma variante configurada</p>
                  <p className="text-sm">Selecione valores de atributos para criar variantes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prices Tab */}
        <TabsContent value="prices" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preços por Variante</CardTitle>
              <CardDescription>
                Defina preços base, custo e promocional para cada combinação de atributos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!product && (
                <div className="text-sm text-muted-foreground mb-4">
                  Para salvar por variante, primeiro crie o produto.
                </div>
              )}
              {generatedVariants.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {activeVariantFilterCount === 0
                        ? `${generatedVariants.length} variantes`
                        : `${filteredVariants.length} de ${generatedVariants.length} variantes`}
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
                          setVariantStatusFilter('all');
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
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma variante configurada</p>
                  <p className="text-sm">Selecione valores de atributos para criar variantes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Form Actions - Sticky Footer */}
      <div className="sticky bottom-0 bg-background border-t p-4 flex justify-end gap-2 -mx-6 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="cursor-pointer">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
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
                  <Input value={`sku: ${selectedVariantForDrawer.variantSku}`} readOnly disabled />
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
                    <Label>{stockModeConfig === 'BINARY' ? 'Disponível' : 'Estoque'}</Label>
                    {stockModeConfig === 'BINARY' ? (
                      <div className="pt-1">
                        <Switch
                          checked={normalizeStockInputByMode(variantStocks[selectedVariantForDrawer.variantKey] ?? 0) > 0}
                          onCheckedChange={(checked) => setVariantStocks({
                            ...variantStocks,
                            [selectedVariantForDrawer.variantKey]: checked ? 1 : 0
                          })}
                          disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
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
                        disabled={isVariantDisabled(selectedVariantForDrawer.variantKey)}
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
              onRefreshAttributes={onRefreshAttributes}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isStoreSizesDrawerOpen}
        onOpenChange={setIsStoreSizesDrawerOpen}
        direction="right"
      >
        <DrawerContent>
          <div className="flex items-start justify-between gap-4 p-4 border-b">
            <div>
              <DrawerTitle>Gerenciar tamanhos da loja</DrawerTitle>
              <DrawerDescription>
                Catálogo de tamanhos da loja. Clique para selecionar no produto.
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
                  Catálogo de tamanhos da loja. Clique para selecionar no produto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {storeSizesDisplayOrder.map((size: string) => (
                    <button
                      key={size}
                      type="button"
                      draggable
                      onDragStart={() => handleStoreSizeDragStart(size)}
                      onDragOver={(event) => handleStoreSizeDragOver(event, size)}
                      onDragLeave={handleStoreSizeDragLeave}
                      onDrop={(event) => handleStoreSizeDrop(event, size)}
                      onDragEnd={handleStoreSizeDragEnd}
                      onClick={() => toggleStoreSize(size)}
                      className={`h-8 px-3 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                        storeSizeSelections.includes(size)
                          ? 'bg-zinc-900 text-zinc-100 border-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 dark:hover:bg-zinc-200'
                          : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
                      } ${draggedStoreSize === size ? 'opacity-60' : ''} ${dragOverStoreSize === size ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      disabled={isSavingStoreSizesOrder}
                    >
                      <span className="mr-1 inline-flex align-middle opacity-60">
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                      {size}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Arraste os itens para reordenar os valores do atributo de tamanho.
                </p>

                {storeSizeSelections.length > 0 && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm text-muted-foreground">
                      Tamanhos selecionados: {storeSizeSelections.join(', ')}
                    </Label>
                  </div>
                )}

                {storeSizeSelections.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Ruler className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Selecione os tamanhos disponiveis</p>
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
