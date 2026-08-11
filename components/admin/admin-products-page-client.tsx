"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PercentageInput from "@/components/form/PercentageInput";
import CurrencyInput from "@/components/form/CurrencyInput";
import IntegerInput from "@/components/form/IntegerInput";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, MoreHorizontal, Search, Pencil, Trash2, Package, Eye, CheckCircle2, XCircle, Star, Layers, X, Download, FilterX, ArrowUp, ArrowDown, Check, ChevronsUpDown, ChevronRight, ChevronDown } from "lucide-react";
import { getProductsAction, createProductAction, updateProductAction, deleteProductAction, bulkUpdateProductsAction } from "@/lib/actions/products";
import { getCategoriesAction } from "@/lib/actions/categories";
import { getAttributesWithValuesByStore, getStoreIdFromToken } from "@/lib/actions/attributes";
import { getMeasurementTablesAction } from "@/lib/actions/measurement-tables";
import { ProductForm } from "@/components/admin/product-form";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import { useAdminStore } from "@/contexts/admin-store-context";
import { usePaginationMeta } from "@/hooks/use-paginated-list";
import { buildStorefrontUrl } from "@/lib/storefront-url";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import { useAttributes } from "@/components/admin/attributes-provider";
import type { Product, Category } from "@/lib/types";
import type { Attribute } from "@/lib/actions/attributes";
import Image from "next/image";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface AdminProductsPageClientProps {
  initialProducts?: any[];
  initialCategories?: any[];
  initialPagination?: {
    total: number;
    page: number;
    limit: number;
    search: string;
    category: string;
    attributeValues?: string;
    status: string;
    sortBy?: string;
    sortDir?: string;
  };
  initialSummary?: {
    total: number;
    active: number;
    inactive: number;
    featured: number;
  };
  isErpIntegrated?: boolean;
}

type MeasurementTableOption = {
  id: string;
  name: string;
};

type BulkDiscountMode = "none" | "percent" | "fixed" | "clear";
type BulkStatusMode = "keep" | "active" | "inactive";
type BulkNcmMode = "keep" | "set" | "clear";
type BulkWeightMode = "keep" | "set";
type ProductSortField = "name" | "sku" | "base_price" | "promo_price";
type ProductSortDirection = "asc" | "desc";
type BulkUpdateProductsPayload = Parameters<typeof bulkUpdateProductsAction>[0];

type SelectedProductSnapshot = {
  id: string;
  name: string;
  categoryId?: string;
  categoryIds?: string[];
};

const MAX_PERSISTED_BULK_SELECTION = 1000;

type CategoryOptionWithDepth = {
  category: Category;
  depth: number;
};

type AttributeValueTreeOption = {
  id: string;
  label: string;
  searchText: string;
};

type AttributeTreeOption = {
  id: string;
  label: string;
  code: string;
  values: AttributeValueTreeOption[];
};

function buildCategoryOptionsWithDepth(categories: Category[]): CategoryOptionWithDepth[] {
  const byParent = new Map<string | null, Category[]>();
  const ids = new Set(categories.map((category) => String(category.id)));

  for (const category of categories) {
    const normalizedParentId = category.parentId ? String(category.parentId) : null;
    const parentKey = normalizedParentId && ids.has(normalizedParentId) ? normalizedParentId : null;
    const siblings = byParent.get(parentKey) ?? [];
    siblings.push(category);
    byParent.set(parentKey, siblings);
  }

  for (const [, siblings] of byParent) {
    siblings.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }));
  }

  const result: CategoryOptionWithDepth[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    const nodes = byParent.get(parentId) ?? [];
    for (const node of nodes) {
      const nodeId = String(node.id);
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      result.push({ category: node, depth });
      walk(nodeId, depth + 1);
    }
  };

  walk(null, 0);

  for (const category of categories) {
    const categoryId = String(category.id);
    if (!visited.has(categoryId)) {
      result.push({ category, depth: 0 });
    }
  }

  return result;
}

const AdminProductsPageClient = ({
  initialProducts = [],
  initialCategories = [],
  initialPagination,
  initialSummary,
  isErpIntegrated = false,
}: AdminProductsPageClientProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { storefrontUrl, session } = useAdminStore();
  const permissionSet = new Set(
    Array.isArray(session?.permissionCodes)
      ? session.permissionCodes
          .map((code) => String(code || '').trim().toLowerCase())
          .filter(Boolean)
      : []
  );
  const canCreateProduct = permissionSet.has('products.create') && !isErpIntegrated;
  const canEditProduct = permissionSet.has('products.edit');
  const canDeleteProduct = permissionSet.has('products.delete');
  const canExportReports = permissionSet.has('reports.export');
  const [products, setProducts] = useState<Product[]>(initialProducts as Product[]);
  const [categories, setCategories] = useState<Category[]>(initialCategories as Category[]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState(initialPagination?.search ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialPagination?.category ?? "all");
  const [selectedAttributeValue, setSelectedAttributeValue] = useState<string>(
    initialPagination?.attributeValues?.split(',')[0]?.trim() || "all",
  );
  const [attributeFilterOpen, setAttributeFilterOpen] = useState(false);
  const [attributeFilterQuery, setAttributeFilterQuery] = useState("");
  const [expandedAttributeGroups, setExpandedAttributeGroups] = useState<Record<string, boolean>>({});
  const [selectedStatus, setSelectedStatus] = useState<string>(initialPagination?.status ?? "all");
  const [selectedLimit, setSelectedLimit] = useState<number>(initialPagination?.limit ?? 20);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingMode, setExportingMode] = useState<"products" | "variants" | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [summary, setSummary] = useState(initialSummary ?? null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedProductsMap, setSelectedProductsMap] = useState<Record<string, SelectedProductSnapshot>>({});
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkKeepCategories, setBulkKeepCategories] = useState(true);
  const [bulkSelectedCategoryIds, setBulkSelectedCategoryIds] = useState<string[]>([]);
  const [bulkAddCategoryId, setBulkAddCategoryId] = useState<string>("none");
  const [bulkRemoveCategoryId, setBulkRemoveCategoryId] = useState<string>("none");
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkTagsToRemoveInput, setBulkTagsToRemoveInput] = useState("");
  const [bulkMeasurementSelection, setBulkMeasurementSelection] = useState<string>("keep");
  const [bulkDiscountMode, setBulkDiscountMode] = useState<BulkDiscountMode>("none");
  const [bulkDiscountValue, setBulkDiscountValue] = useState<number | null>(null);
  const [bulkStatusSelection, setBulkStatusSelection] = useState<BulkStatusMode>("keep");
  const [bulkNcmMode, setBulkNcmMode] = useState<BulkNcmMode>("keep");
  const [bulkNcmValue, setBulkNcmValue] = useState("");
  const [bulkWeightMode, setBulkWeightMode] = useState<BulkWeightMode>("keep");
  const [bulkWeightGrams, setBulkWeightGrams] = useState<number | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgressCurrent, setBulkProgressCurrent] = useState(0);
  const [bulkProgressTotal, setBulkProgressTotal] = useState(0);
  const [bulkProgressProductName, setBulkProgressProductName] = useState("");
  const [measurementTableOptions, setMeasurementTableOptions] = useState<MeasurementTableOption[]>([]);
  const { attributes: contextAttributes, storeId } = useAttributes();
  // Estado local para permitir atualização quando criar novos atributos
  const [attributes, setAttributes] = useState<Attribute[]>(contextAttributes);
  const categoryOptionsWithDepth = useMemo(
    () => buildCategoryOptionsWithDepth(categories),
    [categories],
  );
  const attributeTreeOptions = useMemo<AttributeTreeOption[]>(() => {
    return attributes
      .map((attribute) => {
        const sortedValues = [...(attribute.values || [])].sort((left, right) => {
          const leftOrder = Number.isFinite(left.sort_order) ? Number(left.sort_order) : Number.MAX_SAFE_INTEGER;
          const rightOrder = Number.isFinite(right.sort_order) ? Number(right.sort_order) : Number.MAX_SAFE_INTEGER;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return String(left.name || left.code || left.id).localeCompare(
            String(right.name || right.code || right.id),
            'pt-BR',
            { sensitivity: 'base' },
          );
        });

        const values = sortedValues.map((value) => {
          const valueLabel = String(value.name || value.code || value.id);
          return {
            id: String(value.id),
            label: valueLabel,
            searchText: `${attribute.name} ${attribute.code || ''} ${valueLabel}`.toLowerCase(),
          };
        });

        return {
          id: String(attribute.id),
          label: String(attribute.name || attribute.code || attribute.id),
          code: String(attribute.code || '').toLowerCase(),
          values,
        };
      })
      .filter((group) => group.values.length > 0)
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' }));
  }, [attributes]);

  const filteredAttributeTreeOptions = useMemo<AttributeTreeOption[]>(() => {
    const query = attributeFilterQuery.trim().toLowerCase();
    if (!query) return attributeTreeOptions;

    return attributeTreeOptions
      .map((group) => {
        const groupMatch = group.label.toLowerCase().includes(query) || group.code.includes(query);
        if (groupMatch) return group;

        return {
          ...group,
          values: group.values.filter((value) => value.searchText.includes(query)),
        };
      })
      .filter((group) => group.values.length > 0);
  }, [attributeTreeOptions, attributeFilterQuery]);

  const selectedAttributeValueLabel = useMemo(() => {
    if (selectedAttributeValue === 'all') return 'Todos os atributos';
    for (const group of attributeTreeOptions) {
      const value = group.values.find((item) => item.id === selectedAttributeValue);
      if (value) return `${group.label}: ${value.label}`;
    }
    return 'Todos os atributos';
  }, [selectedAttributeValue, attributeTreeOptions]);

  const toggleAttributeGroup = (groupId: string) => {
    setExpandedAttributeGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const selectionPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionPersistQuotaWarnedRef = useRef(false);

  const selectionStorageKey = useMemo(
    () => `admin-products-bulk-selection:${storeId ?? "global"}`,
    [storeId],
  );

  const toSelectedProductSnapshot = (product: Product): SelectedProductSnapshot => {
    const id = String(product.id);
    const name = String(product.name || `ID ${id}`).trim() || `ID ${id}`;
    const categoryIds = Array.isArray(product.categoryIds)
      ? product.categoryIds.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const categoryId = String(product.categoryId || '').trim();

    return {
      id,
      name,
      categoryId: categoryId || undefined,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    };
  };
  const sortFieldFromQuery = initialPagination?.sortBy;
  const sortDirectionFromQuery = initialPagination?.sortDir;
  const sortField = sortFieldFromQuery === "name" || sortFieldFromQuery === "sku" || sortFieldFromQuery === "base_price" || sortFieldFromQuery === "promo_price"
    ? sortFieldFromQuery
    : null;
  const sortDirection = sortDirectionFromQuery === "asc" || sortDirectionFromQuery === "desc"
    ? sortDirectionFromQuery
    : null;

  const currentPageProductIds = products.map((product) => String(product.id));
  const allCurrentPageSelected = currentPageProductIds.length > 0 && currentPageProductIds.every((id) => selectedProductIds.includes(id));
  const currentPageSelectedCount = currentPageProductIds.filter((id) => selectedProductIds.includes(id)).length;
  const selectedProductsCount = selectedProductIds.length;
  const bulkProgressPercent = bulkProgressTotal > 0
    ? Math.min(100, Math.round((bulkProgressCurrent / bulkProgressTotal) * 100))
    : 0;

  useEffect(() => {
    setProducts(initialProducts as Product[]);
  }, [initialProducts]);

  useEffect(() => {
    setSearch(initialPagination?.search ?? "");
  }, [initialPagination?.search]);

  useEffect(() => {
    setSelectedCategory(initialPagination?.category ?? "all");
    setSelectedAttributeValue(initialPagination?.attributeValues?.split(',')[0]?.trim() || "all");
    setSelectedStatus(initialPagination?.status ?? "all");
    setSelectedLimit(initialPagination?.limit ?? 20);
  }, [initialPagination?.category, initialPagination?.attributeValues, initialPagination?.status, initialPagination?.limit]);

  useEffect(() => {
    setCategories(initialCategories as Category[]);
  }, [initialCategories]);

  useEffect(() => {
    setSummary(initialSummary ?? null);
  }, [initialSummary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(selectionStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        ids?: string[];
        products?: Record<string, Product>;
      };

      const restoredIds = Array.isArray(parsed?.ids)
        ? parsed.ids.map((id) => String(id)).filter(Boolean).slice(0, MAX_PERSISTED_BULK_SELECTION)
        : [];
      const restoredProducts = parsed?.products && typeof parsed.products === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.products)
              .filter(([key]) => restoredIds.includes(String(key)))
              .map(([key, value]) => {
                const snapshot = value as Partial<SelectedProductSnapshot>;
                const id = String(snapshot?.id || key);
                const name = String(snapshot?.name || `ID ${id}`).trim() || `ID ${id}`;
                const categoryId = typeof snapshot?.categoryId === 'string' ? snapshot.categoryId.trim() : '';
                const categoryIds = Array.isArray(snapshot?.categoryIds)
                  ? snapshot.categoryIds.map((item) => String(item).trim()).filter(Boolean)
                  : [];
                return [
                  String(key),
                  {
                    id,
                    name,
                    categoryId: categoryId || undefined,
                    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
                  } satisfies SelectedProductSnapshot,
                ];
              }),
          )
        : {};

      setSelectedProductIds(restoredIds);
      setSelectedProductsMap(restoredProducts);
    } catch {
      // Ignora estado inválido salvo no navegador.
    }
  }, [selectionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const limitedIds = selectedProductIds.slice(0, MAX_PERSISTED_BULK_SELECTION);
    const limitedProducts = Object.fromEntries(
      limitedIds
        .filter((id) => selectedProductsMap[id])
        .map((id) => [id, selectedProductsMap[id]]),
    );

    if (selectionPersistTimeoutRef.current) {
      clearTimeout(selectionPersistTimeoutRef.current);
    }

    selectionPersistTimeoutRef.current = setTimeout(() => {
      try {
        if (limitedIds.length === 0) {
          window.sessionStorage.removeItem(selectionStorageKey);
          selectionPersistQuotaWarnedRef.current = false;
          return;
        }

        window.sessionStorage.setItem(
          selectionStorageKey,
          JSON.stringify({
            ids: limitedIds,
            products: limitedProducts,
          }),
        );

        selectionPersistQuotaWarnedRef.current = false;
      } catch {
        // Evita crash por quota (QuotaExceededError) ou indisponibilidade de storage.
        if (!selectionPersistQuotaWarnedRef.current) {
          toast.error('Seleção muito grande para persistir no navegador. Mantendo apenas na sessão atual.');
          selectionPersistQuotaWarnedRef.current = true;
        }
      }
    }, 300);

    return () => {
      if (selectionPersistTimeoutRef.current) {
        clearTimeout(selectionPersistTimeoutRef.current);
        selectionPersistTimeoutRef.current = null;
      }
    };
  }, [selectedProductIds, selectedProductsMap, selectionStorageKey]);

  useEffect(() => {
    if (selectedProductIds.length === 0 || products.length === 0) return;

    setSelectedProductsMap((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const product of products) {
        const productId = String(product.id);
        if (!selectedProductIds.includes(productId)) continue;
        next[productId] = toSelectedProductSnapshot(product);
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [products, selectedProductIds]);

  useEffect(() => {
    const loadMeasurementTables = async () => {
      const result = await getMeasurementTablesAction({ limit: 50 });
      if (!result.success || !result.data) return;
      setMeasurementTableOptions(result.data.map((table) => ({ id: table.id, name: table.name })));
    };

    void loadMeasurementTables();
  }, []);

  const resetBulkForm = () => {
    setBulkKeepCategories(true);
    setBulkSelectedCategoryIds([]);
    setBulkAddCategoryId("none");
    setBulkRemoveCategoryId("none");
    setBulkTagsInput("");
    setBulkTagsToRemoveInput("");
    setBulkMeasurementSelection("keep");
    setBulkDiscountMode("none");
    setBulkDiscountValue(null);
    setBulkStatusSelection("keep");
    setBulkNcmMode("keep");
    setBulkNcmValue("");
    setBulkWeightMode("keep");
    setBulkWeightGrams(null);
    setBulkProgressCurrent(0);
    setBulkProgressTotal(0);
    setBulkProgressProductName("");
  };

  const clearSelection = () => {
    setSelectedProductIds([]);
    setSelectedProductsMap({});
  };

  const toggleProductSelection = (product: Product, checked: boolean) => {
    const productId = String(product.id);
    setSelectedProductIds((prev) => {
      if (checked) {
        if (prev.includes(productId)) return prev;
        return [...prev, productId];
      }

      return prev.filter((id) => id !== productId);
    });

    setSelectedProductsMap((prev) => {
      if (checked) {
        return { ...prev, [productId]: toSelectedProductSnapshot(product) };
      }

      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    if (currentPageProductIds.length === 0) return;

    if (checked) {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...currentPageProductIds])));
      setSelectedProductsMap((prev) => {
        const next = { ...prev };
        for (const product of products) {
          next[String(product.id)] = toSelectedProductSnapshot(product);
        }
        return next;
      });
      return;
    }

    setSelectedProductIds((prev) => prev.filter((id) => !currentPageProductIds.includes(id)));
    setSelectedProductsMap((prev) => {
      const next = { ...prev };
      for (const productId of currentPageProductIds) {
        delete next[productId];
      }
      return next;
    });
  };

  const clearSort = () => {
    navigateWithParams(1, search, selectedCategory, selectedAttributeValue, selectedStatus, selectedLimit, null, null);
  };

  const parseTagsInput = (value: string): string[] => {
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const raw of value.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      tags.push(tag);
    }

    return tags;
  };

  const buildCategoryTree = (cats: Category[]) => {
    const tree: (Category & { children: Category[] })[] = [];
    const map = new Map<string, Category & { children: Category[] }>();

    cats.forEach((category) => map.set(category.id, { ...category, children: [] }));
    cats.forEach((category) => {
      if (category.parentId && map.has(category.parentId)) {
        map.get(category.parentId)!.children.push(map.get(category.id)!);
      } else {
        tree.push(map.get(category.id)!);
      }
    });

    return tree;
  };

  const getAncestorIds = (categoryId: string, cats: Category[]): string[] => {
    const category = cats.find((entry) => entry.id === categoryId);
    if (!category || !category.parentId) return [];
    return [category.parentId, ...getAncestorIds(category.parentId, cats)];
  };

  const max = (a: number, b: number) => (a > b ? a : b);

  const renderBulkCategoryNode = (node: Category & { children: Category[] }, level = 0) => {
    const checked = bulkSelectedCategoryIds.includes(node.id);

    return (
      <div key={node.id} className={`flex flex-col gap-2 ${level === 0 ? 'break-inside-avoid mb-2' : ''}`}>
        <label
          className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -ml-1.5 rounded-md transition-colors w-full"
          style={{ paddingLeft: `${max(0, level * 20 + 6)}px` }}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(isChecked) => {
              const isSelected = isChecked === true;
              setBulkSelectedCategoryIds((prev) => {
                let next = [...prev];
                if (isSelected) {
                  const ancestors = getAncestorIds(node.id, categories);
                  next = Array.from(new Set([...next, node.id, ...ancestors]));
                } else {
                  next = next.filter((id) => id !== node.id);
                }
                return next;
              });
            }}
          />
          <span className="min-w-0 wrap-break-word text-sm font-medium">{node.name}</span>
        </label>

        {node.children.length > 0 && (
          <div className="flex flex-col gap-1 w-full relative">
            <div className="absolute left-2.25 top-0 bottom-4 w-px bg-border" style={{ marginLeft: `${level * 20}px` }} />
            {node.children.map((child) => renderBulkCategoryNode(child as Category & { children: Category[] }, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const bulkCategoryTree = buildCategoryTree(categories);

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
      const videoGroups = fullData.video_groups || [];

      if (!productInfo || !productInfo.id) {
        console.error('Estrutura de produto inválida:', fullData);
        throw new Error('Dados do produto incompletos');
      }

      const imagesByVariantId = new Map<number, string[]>();
      let primaryGroupImages: string[] = [];
      let primaryGroupVariantCount = 0;

      const sortGroupImageUrls = (images: unknown[]): string[] =>
        (Array.isArray(images) ? images : [])
          .slice()
          .sort((left: any, right: any) => {
            const orderDiff = Number(left?.display_order ?? 0) - Number(right?.display_order ?? 0);
            if (orderDiff !== 0) return orderDiff;
            return Number(left?.id ?? 0) - Number(right?.id ?? 0);
          })
          .map((img: any) => img?.image_url)
          .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0);

      imageGroups.forEach((group: any) => {
        const urls = sortGroupImageUrls(group?.images);
        const variantCount = Array.isArray(group?.variants) ? group.variants.length : 0;

        if (urls.length > 0 && variantCount >= primaryGroupVariantCount) {
          primaryGroupImages = urls;
          primaryGroupVariantCount = variantCount;
        }

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
        meta: productInfo.meta && typeof productInfo.meta === 'object' ? productInfo.meta : null,
        materials: productInfo.composition || '',
        measures: productInfo.location || '',
        basePrice: firstVariant ? (firstVariant.price_cents || 0) / 100 : 0,
        promoPrice: firstVariant && firstVariant.promo_cents > 0 ? firstVariant.promo_cents / 100 : null,
        cost: firstVariant && firstVariant.cost_cents ? firstVariant.cost_cents / 100 : null,
        isActive: productInfo.active,
        isFeatured: false,
        categoryId: categoryIds.length > 0 ? String(categoryIds[0]) : '',
        categoryIds: categoryIds.map((id: unknown) => String(id)).filter(Boolean),
        tags: Array.isArray(productInfo.tags) ? productInfo.tags : [],
        images: primaryGroupImages.length > 0
          ? primaryGroupImages
          : Array.from(new Set(Array.from(imagesByVariantId.values()).flat())),
        sizes: [],
        colors: [],
        measurementTableId: productInfo.measurement_table_id ? String(productInfo.measurement_table_id) : null,
        measurementTableName: productInfo.measurement_table_name ? String(productInfo.measurement_table_name) : null,
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

      const normalizeHexColor = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const raw = value.trim();
        if (!raw) return null;

        const normalized = raw.startsWith('#') ? raw : `#${raw}`;
        if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
          return normalized;
        }

        return null;
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
                ?.values?.find((value) => value.id === valueId)?.meta as { rgb?: string; hex?: string; color?: string; imageUrl?: string } | undefined;

              const resolvedHex =
                normalizeHexColor(colorAttributeMeta?.rgb) ||
                normalizeHexColor(colorAttributeMeta?.hex) ||
                normalizeHexColor(colorAttributeMeta?.color) ||
                '#000000';

              colorsMap.set(valueCode, {
                id: valueId ? `color-${valueId}` : `color-${valueCode}`,
                name: valueName,
                hex: resolvedHex,
                images: [],
                attributeValueId: valueId,
              });
            }
          } else if (isSizeAttribute(attrCode, attrName)) {
            sizeName = String(valueName).toUpperCase();
            sizesSet.add(sizeName);
          }
        });

        // Armazenar dados da variante para popular preços/estoque.
        const combinationKey = variantInfo.combination_key || variantInfo.combinationKey || '';
        const isSimpleVariant = attributeValueIds.length === 0 && !colorName && !sizeName;
        const variantId = Number(variantInfo.id);

        if (!Number.isInteger(variantId) || variantId <= 0) {
          return;
        }

        const variantImages = imagesByVariantId.get(variantId) || [];

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
          id: variantId,
          color: colorName,
          size: sizeName,
          attributeValueIds,
          isSimpleProduct: isSimpleVariant,
          active: variantInfo.active !== false,
          isHighlighted: variantInfo.is_highlighted === true,
          preferredSellableLocationIds: Array.isArray(variantInfo?.meta?.preferred_sellable_location_ids)
            ? variantInfo.meta.preferred_sellable_location_ids
                .map((id: unknown) => Number(id))
                .filter((id: number) => Number.isInteger(id) && id > 0)
            : [],
          stock: variantInfo.stock_qty || 0,
          basePrice: (variantInfo.price_cents || 0) / 100,
          cost: variantInfo.cost_cents ? variantInfo.cost_cents / 100 : null,
          priceOverride: variantInfo.promo_cents ? variantInfo.promo_cents / 100 : null,
          ncm: variantInfo.ncm || productInfo.ncm || "",
          barcode: variantInfo.barcode || "",
          weightGrams: typeof variantInfo.weight_grams === 'number' ? variantInfo.weight_grams : null,
          images: variantImages,
          sku: (typeof variantInfo.sku === 'string' ? variantInfo.sku : null)
            || (typeof v.sku === 'string' ? v.sku : null),
          combinationKey,
        });
      });

      fullProduct.colors = Array.from(colorsMap.values());
      fullProduct.sizes = Array.from(sizesSet);

      console.log('🧩 Edit parser - variants recebidas:', variants.length);
      console.log('🧩 Edit parser - colors extraídas:', fullProduct.colors);
      console.log('🧩 Edit parser - sizes extraídos:', fullProduct.sizes);

      // Adicionar metadados de variantes para o formulário usar
      (fullProduct as any).__variantsData = variantsData;
      (fullProduct as any).__videoGroups = videoGroups;
      (fullProduct as any).__allVariantIds = variants
        .map((entry: any) => Number(entry?.variant?.id ?? entry?.id))
        .filter((value: number) => Number.isInteger(value) && value > 0);

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

      if (productInfo.video_grouping_rule) {
        try {
          const parsedVideoGroupingRule = typeof productInfo.video_grouping_rule === 'string'
            ? JSON.parse(productInfo.video_grouping_rule)
            : productInfo.video_grouping_rule;
          (fullProduct as any).__videoGroupingRule = parsedVideoGroupingRule;
        } catch (error) {
          console.error('Erro ao parsear video_grouping_rule:', error);
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
    if (editingProduct && !canEditProduct) {
      toast.error('Você não tem permissão para editar produtos');
      return;
    }

    if (!editingProduct && isErpIntegrated) {
      toast.error('Produtos devem ser criados pelo ERP integrado');
      return;
    }

    if (!editingProduct && !canCreateProduct) {
      toast.error('Você não tem permissão para criar produtos');
      return;
    }

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
    if (!canDeleteProduct) {
      toast.error('Você não tem permissão para excluir produtos');
      return;
    }

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
    setSelectedProductIds((prev) => prev.filter((id) => id !== productToDelete));
    setSelectedProductsMap((prev) => {
      const next = { ...prev };
      delete next[productToDelete];
      return next;
    });
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

  function handleOpenBulkDialog() {
    if (!canEditProduct) {
      toast.error('Você não tem permissão para editar produtos');
      return;
    }

    if (selectedProductsCount === 0) {
      toast.error('Selecione ao menos um produto');
      return;
    }

    const mergedCategoryIds = Array.from(
      new Set(
        selectedProductIds.flatMap((id) => {
          const product = selectedProductsMap[id];
          if (!product) return [] as string[];

          const categoryIds = Array.isArray(product.categoryIds)
            ? product.categoryIds.map((value) => String(value).trim()).filter(Boolean)
            : [];
          const categoryId = String(product.categoryId || '').trim();

          return categoryId ? Array.from(new Set([...categoryIds, categoryId])) : categoryIds;
        }),
      ),
    );

    setBulkSelectedCategoryIds(mergedCategoryIds);

    setBulkDialogOpen(true);
  }

  async function handleApplyBulkUpdate() {
    if (bulkApplying) return;
    if (!canEditProduct) {
      toast.error('Você não tem permissão para editar produtos');
      return;
    }

    const categoryChanged = !bulkKeepCategories;
    const addCategoryChanged = bulkAddCategoryId !== 'none';
    const removeCategoryChanged = bulkRemoveCategoryId !== 'none';
    const tagsToAdd = parseTagsInput(bulkTagsInput);
    const tagsToRemove = parseTagsInput(bulkTagsToRemoveInput);
    const measurementChanged = bulkMeasurementSelection !== 'keep';
    const statusChanged = bulkStatusSelection !== 'keep';
    const discountChanged = bulkDiscountMode !== 'none';
    const ncmChanged = bulkNcmMode !== 'keep';
    const weightChanged = bulkWeightMode === 'set';

    if (!categoryChanged && !addCategoryChanged && !removeCategoryChanged && tagsToAdd.length === 0 && tagsToRemove.length === 0 && !measurementChanged && !statusChanged && !discountChanged && !ncmChanged && !weightChanged) {
      toast.error('Defina ao menos uma alteração para aplicar em lote');
      return;
    }

    if (addCategoryChanged && removeCategoryChanged && bulkAddCategoryId === bulkRemoveCategoryId) {
      toast.error('A categoria para adicionar e remover não pode ser a mesma');
      return;
    }

    const discountNumber = typeof bulkDiscountValue === 'number' ? bulkDiscountValue : null;
    if ((bulkDiscountMode === 'percent' || bulkDiscountMode === 'fixed') && (!Number.isFinite(discountNumber ?? NaN) || (discountNumber ?? 0) <= 0)) {
      toast.error('Informe um valor de desconto válido');
      return;
    }

    if (bulkNcmMode === 'set' && !bulkNcmValue.trim()) {
      toast.error('Informe o NCM para aplicar em lote');
      return;
    }

    if (weightChanged && (!Number.isFinite(bulkWeightGrams ?? NaN) || (bulkWeightGrams ?? 0) < 0)) {
      toast.error('Informe um peso válido em gramas');
      return;
    }

    const parsedProductIds = selectedProductIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Math.trunc(id));

    if (parsedProductIds.length === 0) {
      toast.error('Nenhum produto válido selecionado');
      return;
    }

    const payload: BulkUpdateProductsPayload = {
      product_ids: parsedProductIds,
    };

    if (categoryChanged) {
      payload.category_ids = bulkSelectedCategoryIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .map((id) => Math.trunc(id));
    }

    if (addCategoryChanged) {
      const addCategoryId = Math.trunc(Number(bulkAddCategoryId));
      if (Number.isFinite(addCategoryId) && addCategoryId > 0) {
        payload.add_category_ids = [addCategoryId];
      }
    }

    if (removeCategoryChanged) {
      const removeCategoryId = Math.trunc(Number(bulkRemoveCategoryId));
      if (Number.isFinite(removeCategoryId) && removeCategoryId > 0) {
        payload.remove_category_ids = [removeCategoryId];
      }
    }

    if (tagsToAdd.length > 0) {
      payload.add_tags = tagsToAdd;
    }

    if (tagsToRemove.length > 0) {
      payload.remove_tags = tagsToRemove;
    }

    if (measurementChanged) {
      const measurementTableId = Number(bulkMeasurementSelection);
      if (Number.isFinite(measurementTableId) && measurementTableId > 0) {
        payload.measurement_table_id = Math.trunc(measurementTableId);
      }
    }

    if (statusChanged) {
      payload.active = bulkStatusSelection === 'active';
    }

    if (discountChanged) {
      const discountPayloadValue = bulkDiscountMode === 'fixed'
        ? Math.round((discountNumber ?? 0) * 100)
        : discountNumber;

      payload.discount = {
        mode: bulkDiscountMode,
        value: bulkDiscountMode === 'clear' ? null : discountPayloadValue,
      };
    }

    if (ncmChanged) {
      payload.ncm = bulkNcmMode === 'clear' ? '' : bulkNcmValue.trim();
    }

    if (weightChanged) {
      payload.weight_grams = Math.trunc(bulkWeightGrams ?? 0);
    }

    setBulkApplying(true);
    setBulkProgressTotal(1);
    setBulkProgressCurrent(0);
    setBulkProgressProductName('Processando lote no servidor');

    try {
      const result = await bulkUpdateProductsAction(payload);

      if (!result.success) {
        throw new Error(result.error || 'Falha ao aplicar atualização em lote');
      }

      const updatedCount = Number(result.data?.updated_count ?? 0);
      const updatedIds = Array.isArray(result.data?.updated_product_ids)
        ? result.data.updated_product_ids.map((id) => String(id))
        : [];
      const updatedProducts = Array.isArray(result.data?.updated_products)
        ? result.data.updated_products
            .filter((product) => Number.isFinite(product?.id) && typeof product?.name === 'string')
            .map((product) => ({ id: String(product.id), name: product.name.trim() }))
            .filter((product) => product.name.length > 0)
        : [];

      setBulkProgressCurrent(1);

      if (updatedCount > 0) {
        const updatedNames = updatedProducts.map((product) => product.name);
        const preview = updatedNames.slice(0, 8).join(' | ');
        const hasMore = updatedNames.length > 8;

        toast.success(`${updatedCount} produto(s) atualizado(s) em lote`, {
          description: preview.length > 0
            ? hasMore
              ? `${preview} | +${updatedNames.length - 8} restante(s)`
              : preview
            : undefined,
        });
      } else {
        toast.error('Nenhum produto foi atualizado em lote');
      }

      if (updatedIds.length > 0 && updatedIds.length < parsedProductIds.length) {
        const updatedSet = new Set(updatedIds);
        const failedIds = selectedProductIds.filter((id) => !updatedSet.has(String(id)));
        const preview = failedIds
          .slice(0, 4)
          .map((id) => selectedProductsMap[id]?.name || `ID ${id}`)
          .join(' | ');
        const hasMore = failedIds.length > 4;

        toast.error(`Falha ao atualizar ${failedIds.length} produto(s)`, {
          description: hasMore ? `${preview} | +${failedIds.length - 4} restante(s)` : preview,
        });
      }

      if (updatedCount > 0) {
        setBulkDialogOpen(false);
        resetBulkForm();
        clearSelection();
        router.refresh();
      }
    } catch (error) {
      console.error('Erro no update em lote:', error);
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : 'Erro desconhecido';
      toast.error(message);
    } finally {
      setBulkApplying(false);
    }
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

  function navigateWithParams(
    nextPage: number,
    nextSearch: string,
    nextCategory: string,
    nextAttributeValue: string,
    nextStatus: string,
    nextLimit: number,
    nextSortBy: ProductSortField | null = sortField,
    nextSortDir: ProductSortDirection | null = sortDirection,
  ) {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    if (nextLimit !== 20) {
      params.set('limit', String(nextLimit));
    }
    if (nextSearch.trim().length > 0) {
      params.set('q', nextSearch.trim());
    }
    if (nextCategory !== 'all') {
      params.set('category', nextCategory);
    }
    if (nextAttributeValue !== 'all') {
      params.set('attribute_values', nextAttributeValue);
    }
    if (nextStatus !== 'all') {
      params.set('status', nextStatus);
    }
    if (nextSortBy && nextSortDir) {
      params.set('sort_by', nextSortBy);
      params.set('sort_dir', nextSortDir);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function buildExportUrl(mode: "products" | "variants") {
    const params = new URLSearchParams();

    if (initialPagination?.search?.trim()) {
      params.set('q', initialPagination.search.trim());
    }

    if (initialPagination?.category && initialPagination.category !== 'all') {
      params.set('category', initialPagination.category);
    }

    if (initialPagination?.attributeValues?.trim()) {
      params.set('attribute_values', initialPagination.attributeValues.trim());
    }

    if (initialPagination?.status && initialPagination.status !== 'all') {
      params.set('status', initialPagination.status);
    }

    const basePath = mode === "variants"
      ? '/api/export/products/variants/excel'
      : '/api/export/products/excel';

    return `${basePath}${params.toString() ? `?${params.toString()}` : ''}`;
  }

  async function handleExportExcel(mode: "products" | "variants") {
    if (exportingMode) return;
    if (!canExportReports) {
      toast.error('Você não tem permissão para exportar relatórios');
      return;
    }

    try {
      setExportingMode(mode);

      const response = await fetch(buildExportUrl(mode), {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erro ao exportar: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fallbackFilename = mode === 'variants'
        ? `produtos-variantes-${new Date().toISOString().split('T')[0]}.xlsx`
        : `produtos-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.download = filenameMatch?.[1] || fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(mode === 'variants' ? 'Variantes exportadas com sucesso' : 'Produtos exportados com sucesso');
    } catch (error) {
      console.error('Erro ao exportar produtos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar produtos');
    } finally {
      setExportingMode(null);
    }
  }

  const handleSearchSubmit = () => {
    navigateWithParams(1, search, selectedCategory, selectedAttributeValue, selectedStatus, selectedLimit);
  };

  const handleSortColumnClick = (field: ProductSortField) => {
    const nextDirection: ProductSortDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
    navigateWithParams(1, search, selectedCategory, selectedAttributeValue, selectedStatus, selectedLimit, field, nextDirection);
  };

  const getProductCategoryNameList = (product: Product) => {
    const ids = Array.from(
      new Set(
        [
          ...(Array.isArray(product.categoryIds) ? product.categoryIds : []),
          String(product.categoryId || '').trim(),
        ].map((value) => String(value || '').trim()).filter(Boolean),
      ),
    );

    if (ids.length === 0) return [] as string[];

    const names = ids
      .map((id) => categories.find((category) => category.id === id)?.name || null)
      .filter((name): name is string => Boolean(name && name.trim().length > 0));

    return names;
  };

  const getProductCategoryNames = (product: Product) => {
    const names = getProductCategoryNameList(product);
    if (names.length === 0) return '-';
    return names.join(', ');
  };

  const getProductCategoryDisplayData = (product: Product) => {
    const names = getProductCategoryNameList(product);
    if (names.length === 0) {
      return {
        primaryName: '-',
        remainingCount: 0,
        tooltip: '',
      };
    }

    return {
      primaryName: names[0],
      remainingCount: Math.max(0, names.length - 1),
      tooltip: names.join(', '),
    };
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

  const normalizeHexColor = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{3}$/.test(normalized) || /^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return normalized;
    }

    return null;
  };

  const stats = {
    total: Number(summary?.total ?? initialPagination?.total ?? products.length),
    active: Number(summary?.active ?? products.filter((product) => product.isActive).length),
    inactive: Number(summary?.inactive ?? products.filter((product) => !product.isActive).length),
    featured: Number(summary?.featured ?? products.filter((product) => product.isFeatured).length),
  }

  const hasActiveFilters = search.trim().length > 0 || selectedCategory !== "all" || selectedAttributeValue !== "all" || selectedStatus !== "all";

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

    const meta = (value?.meta || {}) as {
      imageUrl?: string;
      image_url?: string;
      rgb?: string;
      hex?: string;
      color?: string;
    };
    const imageUrl = typeof meta.imageUrl === 'string' && meta.imageUrl.trim().length > 0
      ? meta.imageUrl
      : typeof meta.image_url === 'string' && meta.image_url.trim().length > 0
      ? meta.image_url
      : undefined;

    const rgb =
      normalizeHexColor(meta.rgb) ||
      normalizeHexColor(meta.hex) ||
      normalizeHexColor(meta.color);

    return {
      imageUrl,
      backgroundColor: rgb || color.hex || '#000000',
    };
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                Catálogo de produtos
              </div>
              <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <Package className="h-6 w-6 text-primary" />
                Produtos
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Gerencie o catálogo de produtos da loja, organize o sortimento e acompanhe os itens disponíveis.
              </p>
            </div>

            <div className="flex items-center gap-2">
            {canExportReports ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-full px-4 cursor-pointer"
                    disabled={exportingMode !== null || products.length === 0}
                    aria-label="Exportar dados em Excel"
                    title="Exportar dados em Excel"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline sm:ml-2">{exportingMode !== null ? 'Baixando...' : 'Exportar Excel'}</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={exportingMode !== null}
                    onClick={() => void handleExportExcel('products')}
                  >
                    Produtos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={exportingMode !== null}
                    onClick={() => void handleExportExcel('variants')}
                  >
                    Produtos por variante
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canCreateProduct && (
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="h-10 gap-2 rounded-full px-5 cursor-pointer"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsCreating(true);
                  }}
                  aria-label="Novo Produto"
                  title="Novo Produto"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline sm:ml-2">Novo Produto</span>
                </Button>
              </SheetTrigger>
            )}
          </div>
        </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Produtos</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{stats.total}</p>
              </div>
              <div className="rounded-full bg-sky-100 p-2 text-sky-700">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Ativos</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{stats.active}</p>
              </div>
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Inativos</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{stats.inactive}</p>
              </div>
              <div className="rounded-full bg-rose-100 p-2 text-rose-700">
                <XCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-rose-300 to-rose-500" />
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Destaques</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{stats.featured}</p>
              </div>
              <div className="rounded-full bg-violet-100 p-2 text-violet-700">
                <Star className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-violet-300 to-violet-500" />
          </div>
        </div>

        <form
          className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            handleSearchSubmit()
          }}
        >
          <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-full pl-10"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
                Buscar
              </Button>
            </div>

            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value);
                navigateWithParams(1, search, value, selectedAttributeValue, selectedStatus, selectedLimit);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full xl:w-60">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoryOptionsWithDepth.map(({ category, depth }) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="inline-flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
                      {depth > 0 && <span className="mr-1 text-muted-foreground">-</span>}
                      <span>{category.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover
              open={attributeFilterOpen}
              onOpenChange={(open) => {
                setAttributeFilterOpen(open);
                if (!open) {
                  setAttributeFilterQuery("");
                } else if (selectedAttributeValue !== 'all') {
                  const selectedGroup = attributeTreeOptions.find((group) =>
                    group.values.some((value) => value.id === selectedAttributeValue),
                  );
                  if (selectedGroup) {
                    setExpandedAttributeGroups((prev) => ({
                      ...prev,
                      [selectedGroup.id]: true,
                    }));
                  }
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={attributeFilterOpen}
                  className="h-10 w-full justify-between rounded-full xl:w-72"
                >
                  <span className="truncate text-left">{selectedAttributeValueLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(90vw,440px)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar atributo ou valor"
                    value={attributeFilterQuery}
                    onValueChange={setAttributeFilterQuery}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum atributo encontrado.</CommandEmpty>
                    <CommandGroup heading="Filtro">
                      <CommandItem
                        value="todos os atributos"
                        className="cursor-pointer"
                        onSelect={() => {
                          setSelectedAttributeValue('all');
                          navigateWithParams(1, search, selectedCategory, 'all', selectedStatus, selectedLimit);
                          setAttributeFilterOpen(false);
                          setAttributeFilterQuery("");
                        }}
                      >
                        <Check className={selectedAttributeValue === 'all' ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                        <span>Todos os atributos</span>
                      </CommandItem>
                    </CommandGroup>
                    {filteredAttributeTreeOptions.map((group) => {
                      const forceExpanded = attributeFilterQuery.trim().length > 0;
                      const isExpanded = forceExpanded || expandedAttributeGroups[group.id] === true;

                      return (
                        <CommandGroup key={group.id}>
                          <CommandItem
                            value={`grupo ${group.label} ${group.code}`}
                            className="cursor-pointer"
                            onSelect={() => toggleAttributeGroup(group.id)}
                          >
                            <ChevronRight className={isExpanded ? 'mr-2 h-4 w-4 rotate-90 transition-transform' : 'mr-2 h-4 w-4 transition-transform'} />
                            <span className="font-medium">{group.label}</span>
                          </CommandItem>

                          {isExpanded
                            ? group.values.map((value) => (
                                <CommandItem
                                  key={value.id}
                                  value={`${group.label} ${value.searchText}`}
                                  className="cursor-pointer pl-8"
                                  onSelect={() => {
                                    setSelectedAttributeValue(value.id);
                                    navigateWithParams(1, search, selectedCategory, value.id, selectedStatus, selectedLimit);
                                    setAttributeFilterOpen(false);
                                    setAttributeFilterQuery("");
                                  }}
                                >
                                  <Check className={selectedAttributeValue === value.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                                  <span className="mr-1 text-muted-foreground">-</span>
                                  <span className="truncate">{value.label}</span>
                                </CommandItem>
                              ))
                            : null}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                navigateWithParams(1, search, selectedCategory, selectedAttributeValue, value, selectedLimit);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full xl:w-45">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10);
                if (!Number.isFinite(nextLimit)) return;
                setSelectedLimit(nextLimit);
                navigateWithParams(1, search, selectedCategory, selectedAttributeValue, selectedStatus, nextLimit);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full xl:w-40">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
                setSelectedAttributeValue("all");
                setSelectedStatus("all");
                navigateWithParams(1, "", "all", "all", "all", selectedLimit);
              }}
              disabled={!hasActiveFilters}
              title="Limpar filtros"
            >
              <FilterX className="h-4 w-4" />
            </Button>

          </div>
        </form>

        {selectedProductsCount > 0 && (
          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">{selectedProductsCount} produto(s) selecionado(s)</p>
                  <p className="text-sm text-muted-foreground">
                    A seleção permanece mesmo ao trocar busca e página.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 rounded-full px-4 cursor-pointer"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                  <span>Limpar seleção</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-10 gap-2 rounded-full px-5 cursor-pointer"
                  onClick={handleOpenBulkDialog}
                  disabled={!canEditProduct}
                >
                  <Pencil className="h-4 w-4" />
                  <span>Editar em massa</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 border-border/20">
                <TableHead className="w-12">
                  <Checkbox
                    checked={allCurrentPageSelected ? true : currentPageSelectedCount > 0 ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleCurrentPageSelection(checked === true)}
                    aria-label="Selecionar produtos da página"
                    disabled={!canEditProduct || currentPageProductIds.length === 0}
                  />
                </TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">
                  <div className="inline-flex items-center gap-1">
                    <span>Produto</span>
                    <button
                      type="button"
                      className={`rounded p-0.5 transition-colors cursor-pointer ${sortField === "name" ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                      aria-label="Ordenar por produto"
                      onClick={() => handleSortColumnClick("name")}
                    >
                      {sortField === "name" && sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sortField === "name" && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Remover ordenacao de produto"
                        onClick={clearSort}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">
                  <div className="inline-flex items-center gap-1">
                    <span>SKU</span>
                    <button
                      type="button"
                      className={`rounded p-0.5 transition-colors cursor-pointer ${sortField === "sku" ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                      aria-label="Ordenar por sku"
                      onClick={() => handleSortColumnClick("sku")}
                    >
                      {sortField === "sku" && sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sortField === "sku" && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Remover ordenacao de sku"
                        onClick={clearSort}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Categoria</TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Cores</TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Tamanhos</TableHead>
                <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">
                  <div className="inline-flex items-center justify-end gap-1 w-full">
                    <span>Preço Base</span>
                    <button
                      type="button"
                      className={`rounded p-0.5 transition-colors cursor-pointer ${sortField === "base_price" ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                      aria-label="Ordenar por preco base"
                      onClick={() => handleSortColumnClick("base_price")}
                    >
                      {sortField === "base_price" && sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sortField === "base_price" && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Remover ordenacao de preco base"
                        onClick={clearSort}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">
                  <div className="inline-flex items-center justify-end gap-1 w-full">
                    <span>Preço Promo</span>
                    <button
                      type="button"
                      className={`rounded p-0.5 transition-colors cursor-pointer ${sortField === "promo_price" ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                      aria-label="Ordenar por preco promo"
                      onClick={() => handleSortColumnClick("promo_price")}
                    >
                      {sortField === "promo_price" && sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sortField === "promo_price" && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Remover ordenacao de preco promo"
                        onClick={clearSort}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/90 uppercase">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum produto encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id} className="border-border/20 hover:bg-muted/40">
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.includes(String(product.id))}
                        onCheckedChange={(checked) => toggleProductSelection(product, checked === true)}
                        aria-label={`Selecionar produto ${product.name}`}
                        disabled={!canEditProduct}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 rounded-lg border border-border/20 bg-muted/40 flex items-center justify-center overflow-hidden relative">
                          {product.images && product.images.length > 0 ? (
                            <CloudflareImage
                              src={product.images[0] || "/placeholder.svg"}
                              cloudflare={{ width: 40, height: 48, fit: "cover", dpr: 2 }}
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
                    <TableCell className="cursor-pointer">
                      {(() => {
                        const categoryDisplay = getProductCategoryDisplayData(product);
                        const tooltipText =
                          categoryDisplay.primaryName === '-'
                            ? 'Sem categoria'
                            : (categoryDisplay.tooltip || categoryDisplay.primaryName);

                        return (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <span className={categoryDisplay.primaryName === '-' ? 'text-muted-foreground' : ''}>
                                    {categoryDisplay.primaryName}
                                  </span>
                                  {categoryDisplay.remainingCount > 0 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      +{categoryDisplay.remainingCount}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-xs wrap-break-word">
                                {tooltipText}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
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
                        <div className="flex items-center gap-1">
                          {(() => {
                            const uniqueSizes = Array.from(new Set(product.sizes.map((size) => normalizeSizeLabel(size))))
                              .sort(compareSizeLabels);
                            const visibleSizes = uniqueSizes.slice(0, 5);
                            const remainingSizesCount = uniqueSizes.length - visibleSizes.length;

                            return (
                              <>
                                <span className="text-sm">{visibleSizes.join(', ')}</span>
                                {remainingSizesCount > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">+{remainingSizesCount}</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {Number(product.basePrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.promoPrice ? (
                        <span className="text-emerald-600 font-medium">R$ {Number(product.promoPrice).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
                              <a href={buildStorefrontUrl(storefrontUrl, `/produtos/${product.slug}`)} target="_blank" rel="noopener noreferrer">
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
                          {canEditProduct && (
                            <DropdownMenuItem onClick={() => openEditSheet(product)} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canDeleteProduct && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(product.id)}
                              className="text-destructive cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
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

        {totalItems > 0 && (
          <AdminPaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(page) => navigateWithParams(page, search, selectedCategory, selectedAttributeValue, selectedStatus, selectedLimit)}
            showing={{
              start: pageStart,
              end: pageEnd,
              total: totalItems,
            }}
          />
        )}

        <Drawer open={bulkDialogOpen} onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (!open) resetBulkForm();
        }} direction="right">
          <DrawerContent className="w-full sm:w-[80vw] lg:w-[70vw] max-w-none p-0">
            <div className="flex h-full flex-col">
            <DrawerHeader className="p-6 pb-4 border-b">
              <DrawerTitle>Editar produtos selecionados</DrawerTitle>
              <DrawerDescription>
                As alterações serão aplicadas aos {selectedProductsCount} produto(s) selecionado(s).
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              <div className="space-y-3 pt-2">

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Adicionar categoria especifica</Label>
                    <Select value={bulkAddCategoryId} onValueChange={setBulkAddCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nao adicionar categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nao adicionar categoria</SelectItem>
                        {categoryOptionsWithDepth.map(({ category, depth }) => (
                          <SelectItem key={`bulk-add-${category.id}`} value={category.id}>
                            <span className="inline-flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
                              {depth > 0 && <span className="mr-1 text-muted-foreground">-</span>}
                              <span>{category.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Adiciona a categoria informada sem remover as categorias atuais.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Remover categoria especifica</Label>
                    <Select value={bulkRemoveCategoryId} onValueChange={setBulkRemoveCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nao remover categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nao remover categoria</SelectItem>
                        {categoryOptionsWithDepth.map(({ category, depth }) => (
                          <SelectItem key={`bulk-remove-${category.id}`} value={category.id}>
                            <span className="inline-flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
                              {depth > 0 && <span className="mr-1 text-muted-foreground">-</span>}
                              <span>{category.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Remove a categoria informada mantendo as demais categorias do produto.
                    </p>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    value={bulkTagsInput}
                    onChange={(event) => setBulkTagsInput(event.target.value)}
                    placeholder="Ex: atacado, verao, destaque"
                  />
                  <p className="text-xs text-muted-foreground">Separe tags por vírgula. As tags novas serão adicionadas às existentes.</p>
                </div>

                <div className="space-y-2">
                  <Label>Remover tags</Label>
                  <Input
                    value={bulkTagsToRemoveInput}
                    onChange={(event) => setBulkTagsToRemoveInput(event.target.value)}
                    placeholder="Ex: destaque, promocao"
                  />
                  <p className="text-xs text-muted-foreground">As tags informadas serão removidas dos produtos selecionados.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tabela de medidas</Label>
                <Select value={bulkMeasurementSelection} onValueChange={setBulkMeasurementSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Manter tabela atual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Manter tabela atual</SelectItem>
                    {measurementTableOptions.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Select value={bulkDiscountMode} onValueChange={(value) => setBulkDiscountMode(value as BulkDiscountMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem desconto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem desconto</SelectItem>
                      <SelectItem value="fixed">Desconto em R$</SelectItem>
                      <SelectItem value="percent">Desconto em %</SelectItem>
                      <SelectItem value="clear">Zerar desconto promocional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor</Label>
                  {bulkDiscountMode === 'percent' ? (
                    <PercentageInput
                      value={bulkDiscountValue}
                      onChange={setBulkDiscountValue}
                      min={0}
                      max={100}
                      placeholder="0,00"
                    />
                  ) : bulkDiscountMode === 'fixed' ? (
                    <CurrencyInput
                      value={bulkDiscountValue}
                      onChange={setBulkDiscountValue}
                      locale="pt-BR"
                      currency="BRL"
                      decimals={2}
                      min={0}
                      placeholder="0,00"
                    />
                  ) : (
                    <Input value="" placeholder="Defina o tipo de desconto" disabled />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={bulkStatusSelection} onValueChange={(value) => setBulkStatusSelection(value as BulkStatusMode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Manter status atual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Manter status atual</SelectItem>
                    <SelectItem value="active">Ativar produtos</SelectItem>
                    <SelectItem value="inactive">Desativar produtos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>NCM</Label>
                  <Select value={bulkNcmMode} onValueChange={(value) => setBulkNcmMode(value as BulkNcmMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Manter NCM atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Manter NCM atual</SelectItem>
                      <SelectItem value="set">Definir NCM</SelectItem>
                      <SelectItem value="clear">Limpar NCM</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkNcmMode === 'set' ? (
                    <Input
                      value={bulkNcmValue}
                      onChange={(event) => setBulkNcmValue(event.target.value)}
                      placeholder="Ex: 6109.10.00"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Aplica o NCM em todas as variações dos produtos selecionados.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Peso</Label>
                  <Select value={bulkWeightMode} onValueChange={(value) => setBulkWeightMode(value as BulkWeightMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Manter peso atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Manter peso atual</SelectItem>
                      <SelectItem value="set">Definir peso</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkWeightMode === 'set' ? (
                    <IntegerInput
                      label=""
                      value={bulkWeightGrams}
                      onChange={(value) => setBulkWeightGrams(value)}
                      placeholder="0"
                      min={0}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Peso em gramas, aplicado em todas as variações dos produtos selecionados.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Arvore de categorias</Label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={bulkKeepCategories}
                      onCheckedChange={(checked) => setBulkKeepCategories(checked === true)}
                    />
                    <span>Manter categorias atuais</span>
                  </label>
                </div>

                {!bulkKeepCategories && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Merge inicial das categorias selecionadas</p>
                    <div className="columns-1 sm:columns-2 gap-3 rounded-md border p-4 overflow-x-hidden">
                      {bulkCategoryTree.map((root) => renderBulkCategoryNode(root as Category & { children: Category[] }, 0))}
                    </div>
                  </div>
                )}
              </div>

              {bulkApplying && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Processando {bulkProgressCurrent} de {bulkProgressTotal}
                    </span>
                    <span className="text-muted-foreground">{bulkProgressPercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${bulkProgressPercent}%` }}
                    />
                  </div>
                  {bulkProgressProductName ? (
                    <p className="text-xs text-muted-foreground">Produto atual: {bulkProgressProductName}</p>
                  ) : null}
                </div>
              )}
            </div>

            <DrawerFooter className="border-t bg-background p-4 sm:p-6 sticky bottom-0 flex-row! justify-end">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setBulkDialogOpen(false);
                  resetBulkForm();
                }}
                disabled={bulkApplying}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                onClick={handleApplyBulkUpdate}
                disabled={bulkApplying}
              >
                {bulkApplying ? 'Aplicando...' : 'Aplicar alterações'}
              </Button>
              </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

        <SheetContent
          className="w-full sm:w-[80vw] lg:w-[80vw] sm:max-w-none overflow-y-auto p-0 flex flex-col [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
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
              isErpIntegrated={isErpIntegrated}
              onSubmit={handleSubmit}
              onSaveColorImages={handleSaveColorImages}
              onCancel={closeSheet}
              onRefreshAttributes={refreshAttributes}
            />
          </div>
        </SheetContent>
      </div>

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
