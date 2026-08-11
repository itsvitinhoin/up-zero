"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStoreAttribute, type Attribute } from "@/lib/actions/attributes";
import { createAttributeValue, deleteAttributeValue, updateAttributeValue, updateAttributeValueSortOrder } from "@/lib/actions/attribute-values";
import { StoreAttributeNameField } from "@/components/admin/store-attribute-name-field";

interface GenericAttributeValuesManagerProps {
  attribute: Attribute | null;
  storeId?: number | null;
  nextAttributeSortOrder?: number;
  mode?: "manage-values" | "create-attribute";
  canCreateAttributes?: boolean;
  onAttributeCreated?: (attribute: Attribute) => void;
  onRefreshAttributes?: () => Promise<void>;
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
}

export function GenericAttributeValuesManager({
  attribute,
  storeId,
  nextAttributeSortOrder = 0,
  mode = "manage-values",
  canCreateAttributes = true,
  onAttributeCreated,
  onRefreshAttributes,
}: GenericAttributeValuesManagerProps) {
  const [newAttributeLabel, setNewAttributeLabel] = useState("");
  const [isCreatingAttribute, setIsCreatingAttribute] = useState(false);
  const [localCreatedAttribute, setLocalCreatedAttribute] = useState<Attribute | null>(null);
  const [newValueLabel, setNewValueLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [valueNameDrafts, setValueNameDrafts] = useState<Record<number, string>>({});
  const [savingValueId, setSavingValueId] = useState<number | null>(null);
  const [deletingValueId, setDeletingValueId] = useState<number | null>(null);
  const [orderedValueIds, setOrderedValueIds] = useState<number[]>([]);
  const [draggedValueId, setDraggedValueId] = useState<number | null>(null);
  const [dragOverValueId, setDragOverValueId] = useState<number | null>(null);
  const [isSavingValueOrder, setIsSavingValueOrder] = useState(false);

  const activeAttribute = mode === "create-attribute" ? localCreatedAttribute : attribute;
  const values = useMemo(() => activeAttribute?.values ?? [], [activeAttribute]);
  const orderedValues = useMemo(() => {
    if (!values.length) return [];

    const valueById = new Map(values.map((value) => [value.id, value]));
    const fromOrder = orderedValueIds
      .map((id) => valueById.get(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const remaining = values.filter((value) => !orderedValueIds.includes(value.id));
    return [...fromOrder, ...remaining];
  }, [values, orderedValueIds]);

  useEffect(() => {
    const nextDrafts: Record<number, string> = {};
    values.forEach((value) => {
      nextDrafts[value.id] = value.name || value.code || "";
    });
    setValueNameDrafts(nextDrafts);
  }, [values]);

  useEffect(() => {
    setOrderedValueIds((prev) => {
      const nextIds = values.map((value) => value.id);
      if (!nextIds.length) return [];

      if (!prev.length) return nextIds;

      const valid = prev.filter((id) => nextIds.includes(id));
      const additions = nextIds.filter((id) => !valid.includes(id));
      return [...valid, ...additions];
    });
  }, [values]);

  async function persistValueOrder(nextOrderedValues: typeof values) {
    const updates = nextOrderedValues
      .map((value, index) => ({
        id: value.id,
        sortOrder: index,
        currentSortOrder: Number(value.sort_order ?? 0),
      }))
      .filter((entry) => entry.currentSortOrder !== entry.sortOrder);

    if (!updates.length) return;

    setIsSavingValueOrder(true);
    try {
      const results = await Promise.all(
        updates.map((update) => updateAttributeValueSortOrder(update.id, update.sortOrder))
      );

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        toast.error("Falha ao ordenar valores", {
          description: "Não foi possível salvar a nova ordem dos valores.",
        });
        return;
      }

      if (mode === "create-attribute" && localCreatedAttribute) {
        setLocalCreatedAttribute((prev) =>
          prev
            ? {
                ...prev,
                values: nextOrderedValues.map((value, index) => ({
                  ...value,
                  sort_order: index,
                })),
              }
            : prev
        );
      }

      await onRefreshAttributes?.();
      toast("Ordem atualizada", {
        description: "A ordem dos valores foi salva.",
      });
    } finally {
      setIsSavingValueOrder(false);
    }
  }

  function reorderValues(fromId: number, toId: number) {
    if (fromId === toId) return;

    const fromIndex = orderedValues.findIndex((value) => value.id === fromId);
    const toIndex = orderedValues.findIndex((value) => value.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextOrdered = [...orderedValues];
    const [moved] = nextOrdered.splice(fromIndex, 1);
    nextOrdered.splice(toIndex, 0, moved);

    setOrderedValueIds(nextOrdered.map((value) => value.id));
    void persistValueOrder(nextOrdered);
  }

  function handleValueDragStart(valueId: number) {
    setDraggedValueId(valueId);
  }

  function handleValueDragOver(event: React.DragEvent<HTMLDivElement>, valueId: number) {
    event.preventDefault();
    if (draggedValueId && draggedValueId !== valueId) {
      setDragOverValueId(valueId);
    }
  }

  function handleValueDragLeave() {
    setDragOverValueId(null);
  }

  function handleValueDrop(event: React.DragEvent<HTMLDivElement>, targetValueId: number) {
    event.preventDefault();

    if (!draggedValueId || draggedValueId === targetValueId) {
      setDragOverValueId(null);
      setDraggedValueId(null);
      return;
    }

    reorderValues(draggedValueId, targetValueId);
    setDragOverValueId(null);
    setDraggedValueId(null);
  }

  function handleValueDragEnd() {
    setDragOverValueId(null);
    setDraggedValueId(null);
  }

  async function handleCreateAttribute() {
    if (!canCreateAttributes) {
      toast.error("Atributos devem ser criados pelo ERP integrado");
      return;
    }

    if (!storeId) {
      toast.error("Store ID não disponível");
      return;
    }

    const label = newAttributeLabel.trim();
    const value = normalizeCode(label);
    if (!label || !value) return;

    setIsCreatingAttribute(true);
    const result = await createStoreAttribute({
      storeId,
      label,
      value,
      sortOrder: nextAttributeSortOrder,
    });
    setIsCreatingAttribute(false);

    if (!result.success || !result.data) {
      toast.error("Falha ao criar atributo", {
        description: result.error || "Não foi possível criar o atributo.",
      });
      return;
    }

    setNewAttributeLabel("");
    await onRefreshAttributes?.();
    setLocalCreatedAttribute(result.data);
    onAttributeCreated?.(result.data);
    toast("Atributo criado", {
      description: `"${label}" foi criado com sucesso.`,
    });
  }

  async function handleCreateValue() {
    if (!canCreateAttributes) {
      toast.error("Atributos devem ser criados pelo ERP integrado");
      return;
    }

    const targetAttribute = mode === "create-attribute" ? localCreatedAttribute : attribute;
    if (!targetAttribute) return;
    const label = newValueLabel.trim();
    const value = normalizeCode(label);
    if (!label || !value) return;
    const nextValueSortOrder = values.reduce((maxSortOrder, currentValue) => {
      const currentSortOrder = Number(currentValue.sort_order ?? 0);
      return Math.max(maxSortOrder, currentSortOrder);
    }, -1) + 1;

    setIsCreating(true);
    const result = await createAttributeValue(targetAttribute.id, label, {
      code: value,
      sortOrder: nextValueSortOrder,
    });
    setIsCreating(false);

    if (!result.success) {
      toast.error("Falha ao criar valor", {
        description: result.error || "Não foi possível criar este valor.",
      });
      return;
    }

    setNewValueLabel("");
    if (mode === "create-attribute" && localCreatedAttribute && result.data) {
      setLocalCreatedAttribute((prev) =>
        prev ? { ...prev, values: [...(prev.values ?? []), result.data!] } : prev
      );
    }
    await onRefreshAttributes?.();
    toast("Valor criado", {
      description: `"${label}" adicionado.`,
    });
  }

  async function handleSaveValueName(valueId: number, currentName: string) {
    const nextName = (valueNameDrafts[valueId] || "").trim();
    if (!nextName || nextName === currentName) return;

    setSavingValueId(valueId);
    const result = await updateAttributeValue(valueId, { name: nextName });
    setSavingValueId(null);

    if (!result.success) {
      toast.error("Falha ao atualizar valor", {
        description: result.error || "Não foi possível atualizar o nome.",
      });
      return;
    }

    if (mode === "create-attribute" && localCreatedAttribute) {
      setLocalCreatedAttribute((prev) =>
        prev
          ? {
              ...prev,
              values: (prev.values ?? []).map((value) =>
                value.id === valueId ? { ...value, name: nextName } : value
              ),
            }
          : prev
      );
    }

    await onRefreshAttributes?.();
    toast("Valor atualizado", {
      description: `Nome alterado para "${nextName}".`,
    });
  }

  function renderValueRow(value: NonNullable<typeof values>[number]) {
    const currentName = value.name || value.code || "";
    const draftName = valueNameDrafts[value.id] ?? currentName;
    const isDirty = draftName.trim() !== currentName.trim();

    return (
      <div
        key={value.id}
        draggable={!isSavingValueOrder && savingValueId !== value.id}
        onDragStart={() => handleValueDragStart(value.id)}
        onDragOver={(event) => handleValueDragOver(event, value.id)}
        onDragLeave={handleValueDragLeave}
        onDrop={(event) => handleValueDrop(event, value.id)}
        onDragEnd={handleValueDragEnd}
        className={`flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 ${draggedValueId === value.id ? "opacity-60" : ""} ${dragOverValueId === value.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={draftName}
            onChange={(event) =>
              setValueNameDrafts((prev) => ({ ...prev, [value.id]: event.target.value }))
            }
            className="h-8 max-w-[220px] text-sm"
            disabled={isSavingValueOrder || savingValueId === value.id}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            ({value.code})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            disabled={!isDirty || isSavingValueOrder || savingValueId === value.id}
            onClick={() => void handleSaveValueName(value.id, currentName)}
            aria-label={`Salvar ${currentName}`}
          >
            {savingValueId === value.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer text-destructive"
            onClick={() => void handleDeleteValue(value.id, currentName)}
            disabled={deletingValueId === value.id || isSavingValueOrder || savingValueId === value.id}
            aria-label={`Remover ${currentName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  async function handleDeleteValue(valueId: number, valueName: string) {
    setDeletingValueId(valueId);
    const result = await deleteAttributeValue(valueId);
    setDeletingValueId(null);

    if (!result.success) {
      toast.error("Falha ao remover", {
        description: result.error || "Não foi possível remover o valor.",
      });
      return;
    }

    if (mode === "create-attribute" && localCreatedAttribute) {
      setLocalCreatedAttribute((prev) =>
        prev ? { ...prev, values: (prev.values ?? []).filter((v) => v.id !== valueId) } : prev
      );
    }
    await onRefreshAttributes?.();
    toast("Valor removido", {
      description: `"${valueName}" foi removido.`,
    });
  }

  if (mode === "create-attribute") {
    if (!canCreateAttributes) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo atributo</CardTitle>
            <CardDescription>
              Com ERP integrado, novos atributos devem ser criados no ERP.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {localCreatedAttribute ? localCreatedAttribute.name : "Novo atributo"}
          </CardTitle>
          <CardDescription>
            {localCreatedAttribute
              ? `Adicione valores ao atributo "${localCreatedAttribute.name}".`
              : "Cadastre um novo atributo informando apenas o nome."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!localCreatedAttribute && (
            <>
              <div className="space-y-2">
                <Label>Nome do atributo</Label>
                <Input
                  value={newAttributeLabel}
                  onChange={(event) => setNewAttributeLabel(event.target.value)}
                  placeholder="Ex: Material"
                />
                <p className="text-xs text-muted-foreground">
                  O código interno será gerado automaticamente a partir do nome.
                </p>
              </div>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={isCreatingAttribute || !newAttributeLabel.trim() || !normalizeCode(newAttributeLabel)}
                onClick={handleCreateAttribute}
              >
                <Plus className="h-4 w-4" />
                Criar atributo
              </Button>
            </>
          )}

          {localCreatedAttribute && (
            <>
              <StoreAttributeNameField
                attributeId={localCreatedAttribute.id}
                attributeName={localCreatedAttribute.name}
                attributeCode={localCreatedAttribute.code}
                onRefreshAttributes={onRefreshAttributes}
                onNameUpdated={(name) =>
                  setLocalCreatedAttribute((prev) => (prev ? { ...prev, name } : prev))
                }
                disabled={!canCreateAttributes}
              />

              <div className="space-y-2">
                <Label>Novo valor</Label>
                <div className="flex gap-2">
                  <Input
                    value={newValueLabel}
                    onChange={(event) => setNewValueLabel(event.target.value)}
                    placeholder="Nome (ex: Algodão)"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateValue();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className="cursor-pointer shrink-0"
                    disabled={isCreating || !newValueLabel.trim() || !normalizeCode(newValueLabel)}
                    onClick={handleCreateValue}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O código do valor é gerado automaticamente e não pode ser alterado depois.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valores cadastrados</Label>
                <p className="text-xs text-muted-foreground">Arraste para ordenar. Edite o nome e salve; o código permanece fixo.</p>
                {values.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum valor ainda. Adicione o primeiro acima.</p>
                ) : (
                  <div className="space-y-2">
                    {orderedValues.map((value) => renderValueRow(value))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!attribute) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atributo não selecionado</CardTitle>
          <CardDescription>Selecione um atributo para gerenciar os valores.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{attribute.name}</CardTitle>
        <CardDescription>
          Gerencie os valores do atributo <span className="font-mono">{attribute.code}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <StoreAttributeNameField
          attributeId={attribute.id}
          attributeName={attribute.name}
          attributeCode={attribute.code}
          onRefreshAttributes={onRefreshAttributes}
          disabled={!canCreateAttributes}
        />

        <div className={canCreateAttributes ? "space-y-2" : "hidden"}>
          <Label>Novo valor</Label>
          <div className="flex gap-2">
            <Input
              value={newValueLabel}
              onChange={(event) => setNewValueLabel(event.target.value)}
              placeholder="Nome (ex: Algodão)"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateValue();
                }
              }}
            />
            <Button
              type="button"
              className="cursor-pointer shrink-0"
              disabled={isCreating || !newValueLabel.trim() || !normalizeCode(newValueLabel)}
              onClick={handleCreateValue}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O código do valor é gerado automaticamente e não pode ser alterado depois.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Valores cadastrados</Label>
          <p className="text-xs text-muted-foreground">Arraste para ordenar. Edite o nome e salve; o código permanece fixo.</p>
          {values.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum valor cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {orderedValues.map((value) => renderValueRow(value))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
