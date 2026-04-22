"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface StoreSizesSelectorCardProps {
  sizes: string[];
  selectedSizes: string[];
  onToggleSize: (size: string) => void;
  title?: string;
  description?: string;
}

export function StoreSizesSelectorCard({
  sizes,
  selectedSizes,
  onToggleSize,
  title = "Tamanhos da Loja",
  description = "Catálogo de tamanhos da loja. Clique para selecionar no produto.",
}: StoreSizesSelectorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sizes.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onToggleSize(size)}
                className={`h-12 rounded-lg border text-sm font-medium transition-colors ${
                  selectedSizes.includes(size)
                    ? "bg-zinc-900 text-zinc-100 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "bg-background hover:bg-muted border-input"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhum tamanho cadastrado na loja.</div>
        )}

        {selectedSizes.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="text-sm text-muted-foreground">
              Tamanhos selecionados: {selectedSizes.join(", ")}
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
