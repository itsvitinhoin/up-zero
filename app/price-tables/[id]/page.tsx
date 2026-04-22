"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import CurrencyInput from "@/components/form/CurrencyInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Trash2, DollarSign } from "lucide-react";
import { getPriceTableById, getPriceTableItems, setPriceTableItem, removePriceTableItem } from "@/lib/actions/settings";
import { getProductsAction } from "@/lib/actions/products";
import type { PriceTable, PriceTableItem, Product } from "@/lib/types";
import Link from "next/link";

export default function PriceTableItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [priceTable, setPriceTable] = useState<PriceTable | null>(null);
  const [items, setItems] = useState<PriceTableItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  async function loadData() {
    setIsLoading(true);
    const [tableResult, itemsResult, productsResult] = await Promise.all([
      getPriceTableById(resolvedParams.id),
      getPriceTableItems(resolvedParams.id),
      getProductsAction(),
    ]);

    if (tableResult.success && tableResult.data) {
      setPriceTable(tableResult.data);
    }
    if (itemsResult.success && itemsResult.data) {
      setItems(itemsResult.data);
      const initialOverrides: Record<string, string> = {};
      for (const item of itemsResult.data) {
        initialOverrides[item.productId] = item.overridePrice.toString();
      }
      setOverrides(initialOverrides);
    }
    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data);
    }
    setIsLoading(false);
  }

  async function handleSaveOverride(productId: string) {
    const value = overrides[productId];
    if (!value) return;
    
    await setPriceTableItem(resolvedParams.id, productId, Number.parseFloat(value));
    loadData();
  }

  async function handleRemoveOverride(productId: string) {
    await removePriceTableItem(resolvedParams.id, productId);
    const newOverrides = { ...overrides };
    delete newOverrides[productId];
    setOverrides(newOverrides);
    loadData();
  }

  const getItemPrice = (productId: string) => {
    const item = items.find((i) => i.productId === productId);
    return item?.overridePrice;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!priceTable) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Tabela não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/price-tables">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {priceTable.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {priceTable.type === "PERCENTAGE"
              ? `Ajuste de ${priceTable.percentage}% sobre o preço base`
              : "Configure preços fixos por produto"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Preço Base</TableHead>
              {priceTable.type === "PERCENTAGE" && (
                <TableHead className="text-right">Preço Tabela</TableHead>
              )}
              <TableHead className="text-right">Override (R$)</TableHead>
              <TableHead className="w-25" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const hasOverride = getItemPrice(product.id) !== undefined;
              const tablePrice =
                priceTable.type === "PERCENTAGE" && priceTable.percentage !== undefined
                  ? product.basePrice * (1 + priceTable.percentage / 100)
                  : product.basePrice;

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    R$ {product.basePrice.toFixed(2)}
                  </TableCell>
                  {priceTable.type === "PERCENTAGE" && (
                    <TableCell className="text-right">
                      R$ {tablePrice.toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <CurrencyInput
                      value={overrides[product.id] ? Number(overrides[product.id]) : null}
                      onChange={(value) =>
                        setOverrides({
                          ...overrides,
                          [product.id]: value == null ? "" : String(value),
                        })
                      }
                      placeholder="Preço fixo"
                      className="w-32 ml-auto"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSaveOverride(product.id)}
                        disabled={!overrides[product.id]}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      {hasOverride && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOverride(product.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
