"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStoreAttributeName } from "@/lib/actions/attributes";
import { toast } from "sonner";

interface StoreAttributeNameFieldProps {
  attributeId?: number | null;
  attributeName?: string | null;
  attributeCode?: string | null;
  onRefreshAttributes?: () => Promise<void>;
  onNameUpdated?: (name: string) => void;
  disabled?: boolean;
}

export function StoreAttributeNameField({
  attributeId,
  attributeName,
  attributeCode,
  onRefreshAttributes,
  onNameUpdated,
  disabled = false,
}: StoreAttributeNameFieldProps) {
  const [name, setName] = useState(attributeName || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(attributeName || "");
  }, [attributeId, attributeName]);

  async function handleSave() {
    if (!attributeId) return;

    const nextName = name.trim();
    if (!nextName || nextName === attributeName) return;

    setIsSaving(true);
    const result = await updateStoreAttributeName({
      attributeId,
      name: nextName,
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error("Falha ao atualizar atributo", {
        description: result.error || "Não foi possível atualizar o nome.",
      });
      return;
    }

    await onRefreshAttributes?.();
    onNameUpdated?.(nextName);
    toast("Atributo atualizado", {
      description: `Nome alterado para "${nextName}".`,
    });
  }

  if (!attributeId) return null;

  return (
    <div className="space-y-2">
      <Label>Nome do atributo</Label>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex: Tamanho"
          disabled={disabled || isSaving}
        />
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer shrink-0"
          disabled={disabled || isSaving || !name.trim() || name.trim() === attributeName}
          onClick={() => void handleSave()}
        >
          Salvar nome
        </Button>
      </div>
      {attributeCode ? (
        <p className="text-xs text-muted-foreground">
          Código interno: <span className="font-mono">{attributeCode}</span> (não editável)
        </p>
      ) : null}
    </div>
  );
}
