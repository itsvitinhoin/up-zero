"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStoreAttribute, updateStoreAttributeName, type Attribute } from "@/lib/actions/attributes";
import { createAttributeValue, deleteAttributeValue, updateAttributeValueSortOrder } from "@/lib/actions/attribute-values";

interface GenericAttributeValuesManagerProps {
  attribute: Attribute | null;
  storeId?: number | null;
  nextAttributeSortOrder?: number;
  mode?: "manage-values" | "create-attribute";
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
  onAttributeCreated,
  onRefreshAttributes,
}: GenericAttributeValuesManagerProps) {
  const [newAttributeLabel, setNewAttributeLabel] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [isCreatingAttribute, setIsCreatingAttribute] = useState(false);
  const [localCreatedAttribute, setLocalCreatedAttribute] = useState<Attribute | null>(null);
  const [newValueLabel, setNewValueLabel] = useState("");
  const [newValueValue, setNewValueValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [attributeName, setAttributeName] = useState("");
  const [isSavingAttributeName, setIsSavingAttributeName] = useState(false);
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
    setAttributeName(attribute?.name || "");
  }, [attribute?.id, attribute?.name]);

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
    if (!storeId) {
      toast.error("Store ID não disponível");
      return;
    }

    const label = newAttributeLabel.trim();
    const value = normalizeCode(newAttributeValue || newAttributeLabel);
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
    setNewAttributeValue("");
    await onRefreshAttributes?.();
    setLocalCreatedAttribute(result.data);
    onAttributeCreated?.(result.data);
    toast("Atributo criado", {
      description: `"${label}" foi criado com sucesso.`,
    });
  }

  async function handleCreateValue() {
    const targetAttribute = mode === "create-attribute" ? localCreatedAttribute : attribute;
    if (!targetAttribute) return;
    const label = newValueLabel.trim();
    const value = normalizeCode(newValueValue || newValueLabel);
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
    setNewValueValue("");
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

  async function handleSaveAttributeName() {
    if (!attribute) return;
    const nextName = attributeName.trim();
    if (!nextName || nextName === attribute.name) return;

    setIsSavingAttributeName(true);
    const result = await updateStoreAttributeName({
      attributeId: attribute.id,
      name: nextName,
    });
    setIsSavingAttributeName(false);

    if (!result.success) {
      toast.error("Falha ao atualizar atributo", {
        description: result.error || "Não foi possível atualizar o nome.",
      });
      return;
    }

    await onRefreshAttributes?.();
    toast("Atributo atualizado", {
      description: `Nome alterado para "${nextName}".`,
    });
  }

  if (mode === "create-attribute") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {localCreatedAttribute ? localCreatedAttribute.name : "Novo atributo"}
          </CardTitle>
          <CardDescription>
            {localCreatedAttribute
              ? `Adicione valores ao atributo "`+localCreatedAttribute.name+`".`
              : "Cadastre um novo atributo informando nome e código."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!localCreatedAttribute && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome do atributo</Label>
                  <Input
                    value={newAttributeLabel}
                    onChange={(event) => setNewAttributeLabel(event.target.value)}
                    placeholder="Ex: Material"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código do atributo</Label>
                  <Input
                    value={newAttributeValue}
                    onChange={(event) => setNewAttributeValue(event.target.value)}
                    placeholder="Ex: material (opcional)"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={isCreatingAttribute || !newAttributeLabel.trim() || !normalizeCode(newAttributeValue || newAttributeLabel)}
                onClick={handleCreateAttribute}
              >
                <Plus className="h-4 w-4" />
                Criar atributo
              </Button>
            </>
          )}

          {localCreatedAttribute && (
            <>
              <div className="space-y-2">
                <Label>Novo valor</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  <Input
                    value={newValueValue}
                    onChange={(event) => setNewValueValue(event.target.value)}
                    placeholder="Código (ex: algodao)"
                  />
                  <Button
                    type="button"
                    className="cursor-pointer"
                    disabled={isCreating || !newValueLabel.trim() || !normalizeCode(newValueValue || newValueLabel)}
                    onClick={handleCreateValue}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valores cadastrados</Label>
                <p className="text-xs text-muted-foreground">Arraste para ordenar os valores deste atributo.</p>
                {values.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum valor ainda. Adicione o primeiro acima.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {orderedValues.map((value) => (
                      <Badge
                        key={value.id}
                        variant="secondary"
                        draggable={!isSavingValueOrder}
                        onDragStart={() => handleValueDragStart(value.id)}
                        onDragOver={(event) => handleValueDragOver(event, value.id)}
                        onDragLeave={handleValueDragLeave}
                        onDrop={(event) => handleValueDrop(event, value.id)}
                        onDragEnd={handleValueDragEnd}
                        className={`gap-2 py-1 ${draggedValueId === value.id ? 'opacity-60' : ''} ${dragOverValueId === value.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      >
                        <GripVertical className="h-3.5 w-3.5 opacity-60" />
                        <span>{value.name || value.code}</span>
                        <span className="text-xs text-muted-foreground">({value.code})</span>
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => handleDeleteValue(value.id, value.name || value.code)}
                          disabled={deletingValueId === value.id || isSavingValueOrder}
                          aria-label={`Remover ${value.name || value.code}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
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
        <div className="space-y-2">
          <Label>Nome do atributo</Label>
          <div className="flex gap-2">
            <Input
              value={attributeName}
              onChange={(event) => setAttributeName(event.target.value)}
              placeholder="Ex: Material"
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={isSavingAttributeName || !attributeName.trim() || attributeName.trim() === attribute.name}
              onClick={handleSaveAttributeName}
            >
              Salvar nome
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Novo valor</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              value={newValueLabel}
              onChange={(event) => setNewValueLabel(event.target.value)}
              placeholder="Label (ex: Algodão)"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateValue();
                }
              }}
            />
            <Input
              value={newValueValue}
              onChange={(event) => setNewValueValue(event.target.value)}
              placeholder="Value (ex: algodao)"
            />
            <Button
              type="button"
              className="cursor-pointer"
              disabled={isCreating || !newValueLabel.trim() || !normalizeCode(newValueValue || newValueLabel)}
              onClick={handleCreateValue}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Valores cadastrados</Label>
          <p className="text-xs text-muted-foreground">Arraste para ordenar os valores deste atributo.</p>
          {values.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum valor cadastrado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedValues.map((value) => (
                <Badge
                  key={value.id}
                  variant="secondary"
                  draggable={!isSavingValueOrder}
                  onDragStart={() => handleValueDragStart(value.id)}
                  onDragOver={(event) => handleValueDragOver(event, value.id)}
                  onDragLeave={handleValueDragLeave}
                  onDrop={(event) => handleValueDrop(event, value.id)}
                  onDragEnd={handleValueDragEnd}
                  className={`gap-2 py-1 ${draggedValueId === value.id ? 'opacity-60' : ''} ${dragOverValueId === value.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  <GripVertical className="h-3.5 w-3.5 opacity-60" />
                  <span>{value.name || value.code}</span>
                  <span className="text-xs text-muted-foreground">({value.code})</span>
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => handleDeleteValue(value.id, value.name || value.code)}
                    disabled={deletingValueId === value.id || isSavingValueOrder}
                    aria-label={`Remover ${value.name || value.code}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
