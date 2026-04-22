"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Plus, MoreHorizontal, Search, Pencil, Trash2, Package, Eye, CheckCircle2, XCircle, Star, Layers, X, Download, FilterX } from "lucide-react";
import { getProductsAction, createProductAction, updateProductAction, deleteProductAction } from "@/lib/actions/products";
import { getCategoriesAction } from "@/lib/actions/categories";
import { getAttributesWithValuesByStore, getStoreIdFromToken } from "@/lib/actions/attributes";
import { ProductForm } from "@/components/admin/product-form";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import {
  AdminHero,
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
  AdminToolbar,
  DesktopOnly,
  MobileCardList,
} from "@/components/admin/admin-mobile-ui";
import { usePaginationMeta } from "@/hooks/use-paginated-list";
import { useAttributes } from "@/components/admin/attributes-provider";
import type { Product, Category } from "@/lib/types";
import type { Attribute } from "@/lib/actions/attributes";
import Image from "next/image";
import { toast } from "sonner";

interface AdminProductsPageClientProps {
  initialProducts?: any[];
  initialCategories?: any[];
  initialPagination?: {
    total: number;
    page: number;
    limit: number;
    search: string;
    category: string;
    status: string;
  };
  initialSummary?: {
    total: number;
    active: number;
    inactive: number;
    featured: number;
  };
}

// ─── Mock data — exibido quando o backend não retorna dados ──────────────────
const MOCK_PRODUCTS_DATA = [
  { id: 'mock-p1', name: 'Vestido Floral Midi', slug: 'vestido-floral-midi', sku: 'VFM-001', description: 'Vestido midi com estampa floral delicada', basePrice: 289.90, cost: 120.00, isActive: true, isFeatured: true, categoryId: 'cat-1', tags: ['vestido'], images: [], sizes: ['P', 'M', 'G', 'GG'], colors: [{ name: 'Rosa', hex: '#FFB6C1' }, { name: 'Azul', hex: '#ADD8E6' }], createdAt: new Date('2024-03-15'), updatedAt: new Date() },
  { id: 'mock-p2', name: 'Blusa Crepe Premium', slug: 'blusa-crepe-premium', sku: 'BCP-002', description: 'Blusa de crepe premium com decote V', basePrice: 179.90, cost: 75.00, isActive: true, isFeatured: false, categoryId: 'cat-2', tags: ['blusa'], images: [], sizes: ['PP', 'P', 'M', 'G'], colors: [{ name: 'Branco', hex: '#FFFFFF' }, { name: 'Preto', hex: '#000000' }, { name: 'Bege', hex: '#F5F5DC' }], createdAt: new Date('2024-04-10'), updatedAt: new Date() },
  { id: 'mock-p3', name: 'Calça Alfaiataria', slug: 'calca-alfaiataria', sku: 'CA-003', description: 'Calça de alfaiataria elegante', basePrice: 349.90, cost: 150.00, isActive: true, isFeatured: true, categoryId: 'cat-1', tags: ['calca'], images: [], sizes: ['36', '38', '40', '42', '44'], colors: [{ name: 'Preto', hex: '#000000' }, { name: 'Cáqui', hex: '#C3B091' }], createdAt: new Date('2024-05-20'), updatedAt: new Date() },
  { id: 'mock-p4', name: 'Conjunto Twin Set', slug: 'conjunto-twin-set', sku: 'CTS-004', description: 'Conjunto de tricô twin set', basePrice: 459.90, cost: 190.00, isActive: true, isFeatured: false, categoryId: 'cat-3', tags: ['conjunto'], images: [], sizes: ['P', 'M', 'G'], colors: [{ name: 'Verde', hex: '#90EE90' }, { name: 'Lilás', hex: '#DDA0DD' }], createdAt: new Date('2024-06-15'), updatedAt: new Date() },
  { id: 'mock-p5', name: 'Saia Midi Plissada', slug: 'saia-midi-plissada', sku: 'SMP-005', description: 'Saia midi plissada versátil', basePrice: 219.90, cost: 95.00, isActive: false, isFeatured: false, categoryId: 'cat-1', tags: ['saia'], images: [], sizes: ['P', 'M', 'G', 'GG'], colors: [{ name: 'Vinho', hex: '#722F37' }, { name: 'Mostarda', hex: '#FFDB58' }], createdAt: new Date('2024-07-01'), updatedAt: new Date() },
  { id: 'mock-p6', name: 'Blazer Oversized', slug: 'blazer-oversized', sku: 'BO-006', description: 'Blazer oversized moderno', basePrice: 399.90, cost: 165.00, isActive: true, isFeatured: true, categoryId: 'cat-2', tags: ['blazer'], images: [], sizes: ['PP', 'P', 'M', 'G', 'GG'], colors: [{ name: 'Off White', hex: '#FAF9F6' }, { name: 'Cinza', hex: '#808080' }, { name: 'Caramelo', hex: '#C68642' }], createdAt: new Date('2024-08-10'), updatedAt: new Date() },
]

const MOCK_PRODUCTS_SUMMARY = { total: 6, active: 5, inactive: 1, featured: 3 }
// ─────────────────────────────────────────────────────────────────────────────

const AdminProductsPageClient = ({
  initialProducts = [],
  initialCategories = [],
  initialPagination,
  initialSummary,
}: AdminProductsPageClientProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>(
    (initialProducts as Product[]).length > 0 ? (initialProducts as Product[]) : (MOCK_PRODUCTS_DATA as unknown as Product[])
  );
  const [categories, setCategories] = useState<Category[]>(initialCategories as Category[]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState(initialPagination?.search ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialPagination?.category ?? "all");
  const [selectedStatus, setSelectedStatus] = useState<string>(initialPagination?.status ?? "all");
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [summary, setSummary] = useState(initialSummary ?? MOCK_PRODUCTS_SUMMARY);
  
  const { attributes: contextAttributes, storeId } = useAttributes();
  // Estado local para permitir atualização quando criar novos atributos
  const [attributes, setAttributes] = useState<Attribute[]>(contextAttributes);

  useEffect(() => {
    const p = initialProducts as Product[];
    setProducts(p.length > 0 ? p : (MOCK_PRODUCTS_DATA as unknown as Product[]));
  }, [initialProducts]);

  useEffect(() => {
    setSearch(initialPagination?.search ?? "");
  }, [initialPagination?.search]);

  useEffect(() => {
    setSelectedCategory(initialPagination?.category ?? "all");
    setSelectedStatus(initialPagination?.status ?? "all");
  }, [initialPagination?.category, initialPagination?.status]);

  useEffect(() => {
    setCategories(initialCategories as Category[]);
  }, [initialCategories]);

  useEffect(() => {
    setSummary(initialSummary ?? null);
  }, [initialSummary]);

  async function loadData() {
    setIsLoading(true);
    const [productsResult, categoriesResult] = await Promise.all([
      getProductsAction(),
      getCategoriesAction(),
    ]);
    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data);
    }
    if (categoriesResult.success && categoriesResult.data) {
      setCategories(categoriesResult.data);
    }
    setIsLoading(false);
  }

  async function refreshAttributes() {
    if (!storeId) return;
    const result = await getAttributesWithValuesByStore(storeId);
    if (result.success && result.data) {
      setAttributes(result.data);
    }
  }

  async function openEditSheet(product: Product) {
    try {
      // Buscar dados completos do produto do Rust
      const base = process.env.NEXT_PUBLIC_RUST_URL;
      if (!base) {
        setEditingProduct(product);
        setIsCreating(false);
        setIsSheetOpen(true);
        return;
      }

      // UNIFIED LOAD: 1 call instead of 3 (product + variants + image_groups)
      const fullUrl = `${base}/products/${product.id}/full`;
      console.log('Fetching full product data from:', fullUrl);
      
      const fullDataRes = await fetch(fullUrl, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!fullDataRes.ok) {
        const errorText = await fullDataRes.text();
        console.error('Erro ao buscar dados completos do produto:', fullDataRes.status, errorText);
        throw new Error('Falha ao buscar dados do produto');
      }

      const fullData = await fullDataRes.json();
      console.log('Full data received:', fullData);

      // The backend returns ProductFullResponse where product is ProductWithCategories
      // ProductWithCategories uses #[serde(flatten)] so all Product fields + category_ids are at same level
      const productInfo = fullData.product || {};
      const categoryIds = productInfo.category_ids || [];
      const variants = fullData.variants || [];
      const imageGroups = fullData.image_groups || [];
      
      if (!productInfo || !productInfo.id) {
        console.error('Estrutura de produto inválida:', fullData);
        throw new Error('Dados do produto incompletos');
      }

      const imagesByVariantId = new Map<number, string[]>();
      imageGroups.forEach((group: any) => {
        const urls = Array.isArray(group?.images)
          ? group.images
              .map((img: any) => img?.image_url)
              .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
          : [];

        if (!Array.isArray(group?.variants) || urls.length === 0) return;
        group.variants.forEach((variantRef: any) => {
          const variantId = Number(variantRef?.variant_id ?? variantRef?.id);
          if (!Number.isInteger(variantId) || variantId <= 0) return;
          imagesByVariantId.set(variantId, urls);
        });
      });

      // Mapear dados do Rust para o formato local
      const firstVariant = variants.length > 0 ? (variants[0].variant || variants[0]) : null;
      
      const fullProduct: Product = {
        id: String(productInfo.id),
        name: productInfo.name,
        slug: productInfo.slug || String(productInfo.code || productInfo.name || '').toLowerCase().replace(/\s+/g, '-'),
        sku: productInfo.code,
        description: productInfo.description || '',
        materials: productInfo.composition || '',
        measures: productInfo.location || '',
        basePrice: firstVariant ? (firstVariant.price_cents || 0) / 100 : 0,
        cost: firstVariant && firstVariant.cost_cents ? firstVariant.cost_cents / 100 : null,
        isActive: productInfo.active,
        isFeatured: false,
        categoryId: categoryIds.length > 0 ? String(categoryIds[0]) : '',
        categoryIds: categoryIds.map((id: unknown) => String(id)).filter(Boolean),
        tags: Array.isArray(productInfo.tags) ? productInfo.tags : [],
        images: Array.from(new Set(Array.from(imagesByVariantId.values()).flat())),
        sizes: [],
        colors: [],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };

      // Extrair cores e tamanhos das variantes
      const colorsMap = new Map<string, any>();
      const sizesSet = new Set<string>();
      const variantsData: any[] = [];


      const isColorAttribute = (code?: string, name?: string) => {
        const codeNorm = (code || '').trim().toLowerCase();
        const nameNorm = (name || '').trim().toLowerCase();
        return ['color', 'colors', 'cor', 'cores'].includes(codeNorm) ||
          nameNorm.includes('cor') ||
          nameNorm.includes('color');
      };

      const isSizeAttribute = (code?: string, name?: string) => {
        const codeNorm = (code || '').trim().toLowerCase();
        const nameNorm = (name || '').trim().toLowerCase();
        return ['size', 'sizes', 'tamanho', 'tamanhos'].includes(codeNorm) ||
          nameNorm.includes('tamanho') ||
          nameNorm.includes('size');
      };

      variants.forEach((v: any) => {
        let colorName = '';
        let sizeName = '';
        
        const attributeValues = v.attribute_values || [];
        const variantInfo = v.variant || v;
        const isActiveVariant = variantInfo.active !== false;
        const attributeValueIds: number[] = [];
        
        attributeValues.forEach((attr: any) => {
          const attrCode = attr.attribute_code || attr.attribute?.code;
          const attrName = attr.attribute_name || attr.attribute?.name;
          const valueName = attr.value_name || attr.value?.name || '';
          const valueCode = attr.value_code || attr.value?.code || valueName;
          const valueId = attr.value_id || attr.value?.id;

          const numericValueId = Number(valueId);
          if (Number.isInteger(numericValueId)) {
            attributeValueIds.push(numericValueId);
          }

          if (isColorAttribute(attrCode, attrName)) {
            colorName = valueName;
            if (valueCode && !colorsMap.has(valueCode)) {
              const colorAttributeMeta = attributes
                .find((attribute) => ['color', 'colors', 'cor', 'cores'].includes((attribute.code || '').toLowerCase()))
                ?.values?.find((value) => value.id === valueId)?.meta as { rgb?: string; imageUrl?: string } | undefined;

              colorsMap.set(valueCode, {
                id: valueId ? `color-${valueId}` : `color-${valueCode}`,
                name: valueName,
                hex: typeof colorAttributeMeta?.rgb === 'string' && colorAttributeMeta.rgb.startsWith('#')
                  ? colorAttributeMeta.rgb
                  : '#000000',
                images: [],
                attributeValueId: valueId,
              });
            }
          } else if (isSizeAttribute(attrCode, attrName)) {
            sizeName = String(valueName).toUpperCase();
            if (isActiveVariant) {
              sizesSet.add(sizeName);
            }
          }
        });

        // Armazenar dados da variante para popular preços/estoque
        if (attributeValueIds.length > 0 || colorName || sizeName) {
          const variantId = Number(variantInfo.id);
          const variantImages = Number.isInteger(variantId) ? (imagesByVariantId.get(variantId) || []) : [];

          if (variantImages.length > 0 && colorName) {
            for (const [key, colorData] of colorsMap.entries()) {
              if (colorData.name !== colorName) continue;

              if (!Array.isArray(colorData.images) || colorData.images.length === 0) {
                colorsMap.set(key, {
                  ...colorData,
                  images: variantImages,
                });
              }
              break;
            }
          }

          variantsData.push({
            color: colorName,
            size: sizeName,
            attributeValueIds,
            active: variantInfo.active !== false,
            isHighlighted: variantInfo.is_highlighted === true,
            stock: variantInfo.stock_qty || 0,
            basePrice: (variantInfo.price_cents || 0) / 100,
            cost: variantInfo.cost_cents ? variantInfo.cost_cents / 100 : null,
            priceOverride: variantInfo.promo_cents ? variantInfo.promo_cents / 100 : null,
            images: variantImages,
            sku: variantInfo.sku || null,
          });
        }
      });

      fullProduct.colors = Array.from(colorsMap.values());
      fullProduct.sizes = Array.from(sizesSet);

      console.log('🧩 Edit parser - variants recebidas:', variants.length);
      console.log('🧩 Edit parser - colors extraídas:', fullProduct.colors);
      console.log('🧩 Edit parser - sizes extraídos:', fullProduct.sizes);
      
      // Adicionar metadados de variantes para o formulário usar
      (fullProduct as any).__variantsData = variantsData;

      if (productInfo.image_grouping_rule) {
        try {
          const parsedImageGroupingRule = typeof productInfo.image_grouping_rule === 'string'
            ? JSON.parse(productInfo.image_grouping_rule)
            : productInfo.image_grouping_rule;
          (fullProduct as any).__imageGroupingRule = parsedImageGroupingRule;
        } catch (error) {
          console.error('Erro ao parsear image_grouping_rule:', error);
        }
      }

      setEditingProduct(fullProduct);
      setIsCreating(false);
      setIsSheetOpen(true);
    } catch (error) {
      console.error('Erro ao carregar produto para edição:', error);
      toast.error('Erro ao carregar dados do produto');
      setEditingProduct(product);
      setIsCreating(false);
      setIsSheetOpen(true);
    }
  }

  function closeSheet() {
    setIsSheetOpen(false);
    setEditingProduct(null);
    setIsCreating(false);
  }

  async function handleSubmit(formData: FormData) {
    const result = editingProduct
      ? await updateProductAction(editingProduct.id, formData)
      : await createProductAction(formData)

    if (!result.success) {
      toast.error(result.error || 'Falha ao salvar produto')
      return
    }

    closeSheet();

    router.refresh();
    
    toast.success(editingProduct ? 'Produto atualizado com sucesso' : 'Produto criado com sucesso')
  }

  async function handleSaveColorImages(formData: FormData) {
    if (!editingProduct) return;

    const result = await updateProductAction(editingProduct.id, formData);
    if (!result.success) {
      toast.error(result.error || 'Falha ao salvar imagens')
      return
    }

    // Atualizar apenas o produto editado
    router.refresh();
    
    toast.success('Imagens salvas com sucesso')
  }


  async function handleDelete(id: string) {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!productToDelete) return;

    const result = await deleteProductAction(productToDelete);
    if (!result.success) {
      toast.error(result.error || 'Falha ao excluir produto')
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      return
    }

    // Remover produto da lista local sem recarregar
    const deletedProduct = products.find((p) => p.id === productToDelete) || null;

    setProducts(prev => prev.filter(p => p.id !== productToDelete));
    setSummary((prev) => {
      if (!prev || !deletedProduct) return prev;

      const nextTotal = Math.max(0, prev.total - 1);
      const nextActive = deletedProduct.isActive ? Math.max(0, prev.active - 1) : prev.active;
      const nextInactive = !deletedProduct.isActive ? Math.max(0, prev.inactive - 1) : prev.inactive;
      const nextFeatured = deletedProduct.isFeatured ? Math.max(0, prev.featured - 1) : prev.featured;

      return {
        total: nextTotal,
        active: nextActive,
        inactive: nextInactive,
        featured: nextFeatured,
      };
    });
    
    toast.success('Produto excluído com sucesso')
    setDeleteDialogOpen(false);
    setProductToDelete(null);
  }

  const pageSize = initialPagination?.limit ?? 20;
  const currentPage = Math.max(1, initialPagination?.page ?? 1);
  const totalItems = Math.max(0, initialPagination?.total ?? 0);
  const { totalPages, safeCurrentPage, pageStart, pageEnd } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems,
    currentPageItemCount: products.length,
  });

  function navigateWithParams(nextPage: number, nextSearch: string, nextCategory: string, nextStatus: string) {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    if (nextSearch.trim().length > 0) {
      params.set('q', nextSearch.trim());
    }
    if (nextCategory !== 'all') {
      params.set('category', nextCategory);
    }
    if (nextStatus !== 'all') {
      params.set('status', nextStatus);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function handleExportExcel() {
    try {
      setIsLoading(true);

      // Solicita à API todos os produtos paginados antes de gerar o arquivo.
      const response = await fetch('/api/export/products/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fetchAll: true,
          search,
          category: selectedCategory,
          status: selectedStatus,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ao exportar: ${response.statusText}`);
      }

      // Baixar arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      link.download = filenameMatch?.[1] || `produtos-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Produtos exportados com sucesso');
    } catch (error) {
      console.error('Erro ao exportar produtos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar produtos');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const currentSearch = (initialPagination?.search ?? '').trim();
    const nextSearch = search.trim();

    if (nextSearch === currentSearch) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (nextSearch.length > 0) {
        params.set('q', nextSearch);
      }
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (selectedStatus !== 'all') {
        params.set('status', selectedStatus);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedStatus, initialPagination?.search, pathname, router]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const normalizeSizeLabel = (value?: string) => String(value || '').trim().toUpperCase();

  const sizeAttributesFromStore = attributes.filter((attribute) => {
    const code = String(attribute.code || '').trim().toLowerCase();
    return ['size', 'sizes', 'tamanho', 'tamanhos'].includes(code);
  });

  const storeSizeOrderMap = new Map<string, number>();
  sizeAttributesFromStore.forEach((attribute) => {
    (attribute.values || []).forEach((value, index) => {
      const label = normalizeSizeLabel(value.name || value.code || '');
      if (!label) return;

      const order = Number.isFinite(value.sort_order) ? Number(value.sort_order) : index;
      const current = storeSizeOrderMap.get(label);
      if (current === undefined || order < current) {
        storeSizeOrderMap.set(label, order);
      }
    });
  });

  const compareSizeLabels = (left: string, right: string) => {
    const a = normalizeSizeLabel(left);
    const b = normalizeSizeLabel(right);

    const orderA = storeSizeOrderMap.get(a);
    const orderB = storeSizeOrderMap.get(b);
    if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
      return orderA - orderB;
    }
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;

    const numericA = Number(a);
    const numericB = Number(b);
    const isNumericA = Number.isFinite(numericA);
    const isNumericB = Number.isFinite(numericB);
    if (isNumericA && isNumericB && numericA !== numericB) {
      return numericA - numericB;
    }

    return a.localeCompare(b, 'pt-BR', { numeric: true });
  };

  const stats = {
    total: Number(summary?.total ?? initialPagination?.total ?? products.length),
    active: Number(summary?.active ?? products.filter((product) => product.isActive).length),
    inactive: Number(summary?.inactive ?? products.filter((product) => !product.isActive).length),
    featured: Number(summary?.featured ?? products.filter((product) => product.isFeatured).length),
  }

  const hasActiveFilters = search.trim().length > 0 || selectedCategory !== "all" || selectedStatus !== "all";

  const colorAttribute = attributes.find((attribute) =>
    ['color', 'colors', 'cor', 'cores'].includes((attribute.code || '').toLowerCase())
  );

  const getColorMetaVisual = (color: { name?: string; hex?: string; images?: string[] }) => {
    const normalizedName = String(color.name || '').trim().toLowerCase();

    const value = colorAttribute?.values?.find((item) => {
      const itemName = String(item.name || '').trim().toLowerCase();
      const itemCode = String(item.code || '').trim().toLowerCase();
      return itemName === normalizedName || itemCode === normalizedName;
    });

    const meta = (value?.meta || {}) as { imageUrl?: string; rgb?: string };
    const imageUrl = typeof meta.imageUrl === 'string' && meta.imageUrl.trim().length > 0
      ? meta.imageUrl
      : undefined;

    const rgb = typeof meta.rgb === 'string' && meta.rgb.trim().startsWith('#')
      ? meta.rgb.trim()
      : undefined;

    return {
      imageUrl,
      backgroundColor: rgb || color.hex || '#000000',
    };
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <AdminPage>
        <AdminHero
          icon={Package}
          eyebrow="Catalogo"
          title="Produtos"
          description="Gerencie o catalogo com foco em leitura rapida, filtros claros e acoes sempre ao alcance."
          actions={
            <>
            <Button
              variant="outline"
              className="min-h-12 rounded-2xl cursor-pointer"
              onClick={handleExportExcel}
              disabled={isLoading || products.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <SheetTrigger asChild>
              <Button
                className="min-h-12 rounded-2xl cursor-pointer"
                onClick={() => {
                  setEditingProduct(null);
                  setIsCreating(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </SheetTrigger>
            </>
          }
        />

        <AdminStatGrid>
          <AdminStatCard icon={Layers} label="Produtos" value={stats.total} hint="Itens no catalogo" />
          <AdminStatCard icon={CheckCircle2} label="Ativos" value={stats.active} hint="Disponiveis" tone="success" />
          <AdminStatCard icon={XCircle} label="Inativos" value={stats.inactive} hint="Ocultos" tone="danger" />
          <AdminStatCard icon={Star} label="Destaques" value={stats.featured} hint="Em evidencia" tone="info" />
        </AdminStatGrid>

        <AdminToolbar>
          <div className="flex w-full flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-12 rounded-2xl pl-9"
              />
            </div>

            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value);
                navigateWithParams(1, search, value, selectedStatus);
              }}
            >
              <SelectTrigger className="min-h-12 w-full rounded-2xl lg:w-60">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                navigateWithParams(1, search, selectedCategory, value);
              }}
            >
              <SelectTrigger className="min-h-12 w-full rounded-2xl lg:w-45">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 rounded-2xl cursor-pointer lg:w-auto"
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
                setSelectedStatus("all");
                navigateWithParams(1, "", "all", "all");
              }}
              disabled={!hasActiveFilters}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Remover filtros
            </Button>
          </div>
        </AdminToolbar>

        <MobileCardList>
          {isLoading ? (
            <AdminPanel>
              <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            </AdminPanel>
          ) : products.length === 0 ? (
            <AdminPanel>
              <div className="py-8 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            </AdminPanel>
          ) : (
            products.map((product) => (
              <button key={product.id} type="button" className="w-full text-left" onClick={() => openEditSheet(product)}>
                <AdminPanel className="transition-colors hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
                      {product.images && product.images.length > 0 ? (
                        <Image src={product.images[0] || "/placeholder.svg"} alt={product.name} fill className="object-cover" sizes="64px" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{product.name}</p>
                          {product.isFeatured ? <Badge variant="violet">Destaque</Badge> : null}
                          <Badge variant={product.isActive ? "emerald" : "amber"}>{product.isActive ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Categoria</p>
                          <p className="font-medium text-foreground">{getCategoryName(product.categoryId)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Preco base</p>
                          <p className="font-medium text-foreground">R$ {Number(product.basePrice).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AdminPanel>
              </button>
            ))
          )}
        </MobileCardList>

        <DesktopOnly>
        <div className="rounded-[24px] border border-border/60 bg-card/95 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Produto</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">SKU</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Categoria</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Cores</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Tamanhos</TableHead>
                <TableHead className="text-right text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Preco Base</TableHead>
                <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum produto encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id} className="border-border/20 hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 rounded-lg border border-border/20 bg-muted/40 flex items-center justify-center overflow-hidden relative">
                          {product.images && product.images.length > 0 ? (
                            <Image
                              src={product.images[0] || "/placeholder.svg"}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.isFeatured && (
                            <Badge variant="violet" className="text-xs font-medium">
                              Destaque
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell>{getCategoryName(product.categoryId)}</TableCell>
                    <TableCell>
                      {product.colors && product.colors.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {product.colors.slice(0, 4).map((color, idx) => {
                            const visual = getColorMetaVisual(color);

                            return (
                              <div
                                key={idx}
                                className="w-5 h-5 rounded-full border shadow-sm"
                                style={{
                                  backgroundColor: visual.backgroundColor,
                                  backgroundImage: visual.imageUrl ? `url(${visual.imageUrl})` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                                title={color.name}
                              />
                            );
                          })}
                          {product.colors.length > 4 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              +{product.colors.length - 4}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.sizes && product.sizes.length > 0 ? (
                        <span className="text-sm">
                          {Array.from(new Set(product.sizes.map((size) => normalizeSizeLabel(size))))
                            .sort(compareSizeLabels)
                            .join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {Number(product.basePrice).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "emerald" : "amber"} className="text-xs font-medium">
                        {product.isActive ? "Ativo" : "Inativo"}
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
                          {product.slug ? (
                            <DropdownMenuItem asChild className="cursor-pointer">
                              <a href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="mr-2 h-4 w-4" />
                                Ver na Loja
                              </a>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver na Loja
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEditSheet(product)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
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

        {totalItems > 0 && (
          <AdminPaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(page) => navigateWithParams(page, search, selectedCategory, selectedStatus)}
            showing={{
              start: pageStart,
              end: pageEnd,
              total: totalItems,
            }}
          />
        )}

        <SheetContent className="w-full sm:w-[70vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden">
          <div className="flex-1 flex flex-col p-6">
            <SheetHeader className="p-0 mb-6">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-base font-semibold">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>
            
            <ProductForm
              product={editingProduct || undefined}
              categories={categories}
              attributes={{
                attributes,
                colorAttribute: attributes.find((a) => a.code === 'color'),
                sizeAttribute: attributes.find((a) => a.code === 'size'),
                storeId,
              }}
              storeId={storeId}
              onSubmit={handleSubmit}
              onSaveColorImages={handleSaveColorImages}
              onCancel={closeSheet}
              onRefreshAttributes={refreshAttributes}
            />
          </div>
        </SheetContent>
      </AdminPage>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="cursor-pointer"
              onClick={() => {
              setDeleteDialogOpen(false);
              setProductToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default AdminProductsPageClient;
