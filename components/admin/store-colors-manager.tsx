"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Upload, X, Loader2, Save, Palette, GripVertical } from "lucide-react";
import { createAttributeValue, createColorValue, deleteAttributeValue, updateAttributeValueMeta, updateAttributeValueSortOrder } from "@/lib/actions/attribute-values";
import { toast } from "sonner";
import type { AttributesContextType } from "@/components/admin/attributes-provider";

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

type FormColor = {
  id: string;
  name: string;
  hex: string;
  images: string[];
  attributeValueId?: number;
};

interface StoreColorsManagerProps {
  attributes?: AttributesContextType;
  storeId?: number | null;
  colorAttributeId?: number | null;
  onRefreshAttributes?: () => Promise<void>;
}

export function StoreColorsManager({
  attributes,
  storeId,
  colorAttributeId,
  onRefreshAttributes,
}: StoreColorsManagerProps) {
  const [colors, setColors] = useState<FormColor[]>([]);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [newColorImageUrl, setNewColorImageUrl] = useState("");
  const [isUploadingNewColorImage, setIsUploadingNewColorImage] = useState(false);
  const [savingColorId, setSavingColorId] = useState<string | null>(null);
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);
  const [dirtyColorIds, setDirtyColorIds] = useState<Record<string, boolean>>({});
  const [draggedColorId, setDraggedColorId] = useState<string | null>(null);
  const [dragOverColorId, setDragOverColorId] = useState<string | null>(null);
  const [isSavingColorOrder, setIsSavingColorOrder] = useState(false);

  const newColorFileInputRef = useRef<HTMLInputElement>(null);
  const colorFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function resolveHexFromStoreColor(name: string, rgb?: string) {
    const rgbValue = rgb?.trim();
    if (rgbValue && rgbValue.startsWith("#") && (rgbValue.length === 7 || rgbValue.length === 4)) {
      return rgbValue;
    }

    const common = COMMON_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return common?.hex || "#000000";
  }

  function dedupeColors(list: FormColor[]) {
    const seen = new Set<string>();
    return list.filter((color) => {
      const key = typeof color.attributeValueId === "number"
        ? `id:${color.attributeValueId}`
        : `name:${color.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const targetColorAttribute = (() => {
    if (typeof colorAttributeId === "number") {
      const byId = attributes?.attributes?.find((attribute) => attribute.id === colorAttributeId);
      if (byId) return byId;
    }
    return attributes?.colorAttribute;
  })();

  const targetColorValues = targetColorAttribute?.values || [];

  useEffect(() => {
    const currentTargetAttribute = typeof colorAttributeId === "number"
      ? attributes?.attributes?.find((attribute) => attribute.id === colorAttributeId)
      : attributes?.colorAttribute;
    const storeColors = currentTargetAttribute?.values || [];
    const mapped = storeColors.map((value, idx) => ({
      id: `store-color-${value.id}-${idx}`,
      name: value.name,
      hex: resolveHexFromStoreColor(value.name, value.meta?.rgb),
      images: value.meta?.imageUrl ? [value.meta.imageUrl] : [],
      attributeValueId: value.id,
    }));

    setColors((prev) => {
      if (prev.length === 0) return mapped;
      return dedupeColors([
        ...prev.filter((p) => typeof p.attributeValueId !== "number"),
        ...mapped,
      ]);
    });
  }, [attributes?.attributes, attributes?.colorAttribute, colorAttributeId]);

  function markColorDirty(colorId: string, isDirty = true) {
    setDirtyColorIds((prev) => ({ ...prev, [colorId]: isDirty }));
  }

  function findColorAttributeValue(color: FormColor) {
    const values = targetColorValues;
    if (color.attributeValueId) {
      return values.find((value) => value.id === color.attributeValueId) || null;
    }

    const normalizedName = color.name.trim().toLowerCase();
    return values.find((value) => {
      const valueName = value.name?.trim().toLowerCase();
      const valueCode = value.code?.trim().toLowerCase();
      return valueName === normalizedName || valueCode === normalizedName;
    }) || null;
  }

  async function uploadNewColorImage(files: FileList) {
    const file = files[0];
    if (!file) return;

    setIsUploadingNewColorImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("imageType", "storeColorImage");
      formData.append("folder", `store/colors/new`);

      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha no upload");

      setNewColorImageUrl(result.url as string);
      toast("Upload concluido", {
        description: "Imagem da nova cor carregada.",
      });
    } catch (error) {
      console.error("uploadNewColorImage error:", error);
      toast.error("Falha no upload", {
        description: "Nao foi possivel enviar a imagem da cor.",
      });
    } finally {
      setIsUploadingNewColorImage(false);
    }
  }

  async function syncColorAttributeMeta(color: FormColor, imageUrl?: string | null) {
    let value = findColorAttributeValue(color);
    if (!value && typeof targetColorAttribute?.id === "number") {
      const meta = {
        rgb: color.hex,
        imageUrl: imageUrl ?? color.images[0] ?? null,
      };
      const createResult = await createAttributeValue(targetColorAttribute.id, color.name, { meta });
      if (createResult.success && createResult.data?.id) {
        value = createResult.data;
        setColors((prev) => prev.map((item) =>
          item.id === color.id
            ? { ...item, attributeValueId: createResult.data.id }
            : item
        ));
      }
    } else if (!value && storeId) {
      const meta = {
        rgb: color.hex,
        imageUrl: imageUrl ?? color.images[0] ?? null,
      };
      const createResult = await createColorValue(color.name, color.hex, storeId, meta);
      if (createResult.success && createResult.data?.id) {
        value = createResult.data;
        setColors((prev) => prev.map((item) =>
          item.id === color.id
            ? { ...item, attributeValueId: createResult.data.id }
            : item
        ));
      }
    }

    if (!value) return false;

    const currentMeta = (value.meta as { rgb?: string; imageUrl?: string } | undefined) || {};
    const nextRgb = color.hex || currentMeta.rgb;
    const nextImageUrl = imageUrl !== undefined
      ? imageUrl
      : (color.images[0] ?? currentMeta.imageUrl ?? null);

    const meta = {
      rgb: nextRgb,
      imageUrl: nextImageUrl,
    };

    const result = await updateAttributeValueMeta(value.id, meta);
    if (!result.success) {
      console.error("syncColorAttributeMeta: Erro ao atualizar meta:", result.error);
      return false;
    }

    onRefreshAttributes?.();
    return true;
  }

  async function saveColorAttributeValue(colorId: string) {
    const color = colors.find((item) => item.id === colorId);
    if (!color) return;

    setSavingColorId(colorId);
    const didUpdateAttribute = await syncColorAttributeMeta(color, color.images[0] ?? null);
    if (didUpdateAttribute) {
      markColorDirty(colorId, false);
      toast("Cor salva", {
        description: "A cor foi salva com sucesso.",
      });
    } else {
      toast.error("Falha ao salvar", {
        description: "Nao foi possivel salvar a cor.",
      });
    }

    setSavingColorId(null);
  }

  function updateColorHex(colorId: string, hex: string) {
    setColors(colors.map((c) => c.id === colorId ? { ...c, hex } : c));
    markColorDirty(colorId);
  }

  async function uploadColorImages(colorId: string, files: FileList) {
    setUploadingColorId(colorId);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("imageType", "storeColorImage");
        formData.append("folder", `store/colors/${colorId}`);

        const response = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha no upload");
        return result.url as string;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      if (uploadedUrls.length === 0) {
        throw new Error("Upload sem URL retornada");
      }

      let updatedColors: FormColor[] = [];
      setColors((prev) => {
        updatedColors = prev.map((c) =>
          c.id === colorId
            ? { ...c, images: [...c.images, ...uploadedUrls] }
            : c
        );
        return updatedColors;
      });
      markColorDirty(colorId);

      toast("Upload concluido", {
        description: "Clique em salvar para aplicar na cor.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Falha no upload", {
        description: "Nao foi possivel enviar a imagem.",
      });
    } finally {
      setUploadingColorId(null);
      setSavingColorId(null);
    }
  }

  function removeColorImage(colorId: string, imageIndex: number) {
    setColors((prev) => {
      return prev.map((c) =>
        c.id === colorId
          ? { ...c, images: c.images.filter((_, i) => i !== imageIndex) }
          : c
      );
    });

    markColorDirty(colorId);
  }

  function addColor() {
    if (!newColorName.trim()) return;

    if (colors.some((c) => c.name.toLowerCase() === newColorName.toLowerCase())) {
      return;
    }

    const newColorId = `color-${Date.now()}`;
    const trimmedImageUrl = newColorImageUrl.trim();
    const newColor: FormColor = {
      id: newColorId,
      name: newColorName.trim(),
      hex: newColorHex,
      images: trimmedImageUrl ? [trimmedImageUrl] : [],
    };

    setColors([...colors, newColor]);
    setNewColorName("");
    setNewColorHex("#000000");
    setNewColorImageUrl("");
    markColorDirty(newColorId);

    if (!storeId && typeof targetColorAttribute?.id !== "number") {
      toast.error("Store ID nao disponivel");
      return;
    }

    const meta: { rgb?: string; imageUrl?: string } = { rgb: newColorHex };
    if (trimmedImageUrl) {
      meta.imageUrl = trimmedImageUrl;
    }

    const createPromise = typeof targetColorAttribute?.id === "number"
      ? createAttributeValue(targetColorAttribute.id, newColor.name, { meta })
      : createColorValue(newColor.name, newColor.hex, storeId as number, meta);

    createPromise.then((result) => {
      if (result.success) {
        if (result.data?.id) {
          setColors((prev) => prev.map((color) =>
            color.id === newColorId
              ? { ...color, attributeValueId: result.data.id }
              : color
          ));
          setDirtyColorIds((prev) => ({ ...prev, [newColorId]: false }));
        }
        onRefreshAttributes?.();
      } else {
        toast.error("Falha ao criar cor", {
          description: result.error || "Nao foi possivel criar a cor",
        });
      }
    });
  }

  function addCommonColor(commonColor: { name: string; hex: string }) {
    if (colors.some((c) => c.name.toLowerCase() === commonColor.name.toLowerCase())) {
      return;
    }

    const newColorId = `color-${Date.now()}`;
    const newColor: FormColor = {
      id: newColorId,
      name: commonColor.name,
      hex: commonColor.hex,
      images: [],
    };

    setColors([...colors, newColor]);
    markColorDirty(newColorId);

    if (!storeId && typeof targetColorAttribute?.id !== "number") {
      toast.error("Store ID nao disponivel");
      return;
    }

    const meta = { rgb: commonColor.hex };
    const createPromise = typeof targetColorAttribute?.id === "number"
      ? createAttributeValue(targetColorAttribute.id, newColor.name, { meta })
      : createColorValue(newColor.name, newColor.hex, storeId as number, meta);

    createPromise.then((result) => {
      if (result.success) {
        if (result.data?.id) {
          setColors((prev) => prev.map((color) =>
            color.id === newColorId
              ? { ...color, attributeValueId: result.data.id }
              : color
          ));
          setDirtyColorIds((prev) => ({ ...prev, [newColorId]: false }));
        }
        onRefreshAttributes?.();
      } else {
        toast.error("Falha ao criar cor", {
          description: result.error || "Nao foi possivel criar a cor",
        });
      }
    });
  }

  async function removeColor(colorId: string) {
    const color = colors.find((item) => item.id === colorId);
    if (!color) return;

    const attributeValue = findColorAttributeValue(color);
    if (attributeValue) {
      const deleteResult = await deleteAttributeValue(attributeValue.id);
      if (!deleteResult.success) {
        toast.error("Falha ao remover", {
          description: "Nao foi possivel remover no backend.",
        });
        return;
      }
    }

    setColors((prev) => prev.filter((item) => item.id !== colorId));
    setDirtyColorIds((prev) => {
      const next = { ...prev };
      delete next[colorId];
      return next;
    });
    onRefreshAttributes?.();
    toast("Cor removida", {
      description: "A cor foi removida com sucesso.",
    });
  }

  async function persistColorOrder(nextColors: FormColor[]) {
    const sortOrderByValueId = new Map<number, number>(
      targetColorValues.map((value) => [value.id, Number(value.sort_order ?? 0)])
    );

    const updates: Array<{ valueId: number; sortOrder: number }> = [];

    nextColors.forEach((color, index) => {
      const valueId = color.attributeValueId ?? findColorAttributeValue(color)?.id;
      if (!valueId) return;

      const currentSortOrder = sortOrderByValueId.get(valueId);
      if (currentSortOrder === undefined || currentSortOrder !== index) {
        updates.push({ valueId, sortOrder: index });
      }
    });

    if (!updates.length) return;

    setIsSavingColorOrder(true);
    try {
      const results = await Promise.all(
        updates.map((update) => updateAttributeValueSortOrder(update.valueId, update.sortOrder))
      );

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        toast.error("Falha ao ordenar cores", {
          description: "Nao foi possivel salvar a nova ordem de todas as cores.",
        });
        return;
      }

      await onRefreshAttributes?.();
      toast("Ordem atualizada", {
        description: "A nova ordem das cores foi salva.",
      });
    } finally {
      setIsSavingColorOrder(false);
    }
  }

  function reorderColors(fromColorId: string, toColorId: string) {
    if (!fromColorId || !toColorId || fromColorId === toColorId) return;

    setColors((prev) => {
      const fromIndex = prev.findIndex((color) => color.id === fromColorId);
      const toIndex = prev.findIndex((color) => color.id === toColorId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      void persistColorOrder(next);
      return next;
    });
  }

  function handleColorDragStart(colorId: string) {
    setDraggedColorId(colorId);
  }

  function handleColorDragOver(event: React.DragEvent<HTMLDivElement>, colorId: string) {
    event.preventDefault();
    if (draggedColorId && draggedColorId !== colorId) {
      setDragOverColorId(colorId);
    }
  }

  function handleColorDragLeave() {
    setDragOverColorId(null);
  }

  function handleColorDrop(event: React.DragEvent<HTMLDivElement>, targetColorId: string) {
    event.preventDefault();

    if (!draggedColorId || draggedColorId === targetColorId) {
      setDragOverColorId(null);
      setDraggedColorId(null);
      return;
    }

    reorderColors(draggedColorId, targetColorId);
    setDragOverColorId(null);
    setDraggedColorId(null);
  }

  function handleColorDragEnd() {
    setDragOverColorId(null);
    setDraggedColorId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cores da Loja</CardTitle>
        <CardDescription>
          Adicione as cores disponiveis. Cada cor pode ter suas proprias fotos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-[220px_150px_150px_150px] gap-4">
            <Label className="h-6 inline-flex items-end px-2 pb-1 text-sm font-medium">Nome</Label>
            <Label className="h-6 inline-flex items-end px-2 pb-1 text-sm font-medium">Codigo HEX</Label>
            <Label className="h-6 inline-flex items-end px-2 pb-1 text-sm font-medium">Imagem (opcional)</Label>
            <Label className="h-6 inline-flex items-end px-2 pb-1 text-sm font-medium opacity-0">Ação</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_150px_150px_150px] gap-4 items-center">
            <Input
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Ex: Azul Marinho"
              className="h-10"
            />

            <div className="flex items-center gap-4 h-10">
              <input
                type="color"
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                className="h-10 w-10 min-h-10 min-w-10 rounded-md overflow-hidden border-0 bg-transparent p-0 cursor-pointer aspect-square appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-md"
              />
              <Input
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                className="flex-1 h-10 font-mono"
                maxLength={7}
              />
            </div>

            <div className="flex items-center gap-4 h-10">
              <Button
                type="button"
                variant="outline"
                onClick={() => newColorFileInputRef.current?.click()}
                disabled={isUploadingNewColorImage}
                className="h-10 w-10 p-0"
              >
                {isUploadingNewColorImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <div className="relative h-10 w-10 overflow-hidden rounded border">
                {newColorImageUrl && (
                  <>
                    <Image
                      src={newColorImageUrl}
                      alt="Preview nova cor"
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setNewColorImageUrl("")}
                      className="absolute -top-1 -right-1 rounded-full p-0.5 bg-white/90 text-foreground border border-border shadow-sm"
                      aria-label="Remover imagem da nova cor"
                      title="Remover imagem"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
              <input
                ref={newColorFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && uploadNewColorImage(e.target.files)}
              />
            </div>

            <Button type="button" onClick={addColor} disabled={!newColorName.trim()} className="h-12 px-8 w-full text-base font-semibold">
              <Plus className="h-5 w-5 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm text-muted-foreground">
            {targetColorAttribute ? "Cores (Quick Add)" : "Cores rapidas:"}
          </Label>
          <div className="flex flex-wrap gap-4">
            {COMMON_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => addCommonColor(color)}
                disabled={colors.some((c) => c.name.toLowerCase() === color.name.toLowerCase())}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span
                  className="w-3 h-3 rounded-full border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </button>
            ))}
          </div>
        </div>

        {colors.length > 0 && (
          <div className="space-y-4 mt-4">
            <Label>{colors.length === 1 ? "Cor Adicionada (1)" : `Cores Adicionadas (${colors.length})`}</Label>
            <p className="text-xs text-muted-foreground">Arraste para ordenar as cores da loja.</p>
            {colors.map((color) => (
              <Card
                key={color.id}
                className={`p-4 ${draggedColorId === color.id ? 'opacity-60' : ''} ${dragOverColorId === color.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                draggable={!isSavingColorOrder}
                onDragStart={() => handleColorDragStart(color.id)}
                onDragOver={(event) => handleColorDragOver(event, color.id)}
                onDragLeave={handleColorDragLeave}
                onDrop={(event) => handleColorDrop(event, color.id)}
                onDragEnd={handleColorDragEnd}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="pt-0.5 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{color.name}</p>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={color.hex}
                          onChange={(e) => updateColorHex(color.id, e.target.value)}
                          className="h-10 w-10 rounded-lg border-0 cursor-pointer aspect-square p-0 appearance-none"
                        />
                        <Input
                          value={color.hex}
                          onChange={(e) => updateColorHex(color.id, e.target.value)}
                          className="w-24 h-7 text-xs font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <Label className="text-sm mb-2 block">Foto</Label>
                    <div className="flex flex-wrap gap-4">
                      {color.images[0] && (
                        <div className="relative h-10 w-10 rounded border overflow-hidden">
                          <Image
                            src={color.images[0] || "/placeholder.svg"}
                            alt={`${color.name}`}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeColorImage(color.id, 0)}
                            className="absolute top-1 right-1 rounded-full p-0.5 bg-white/90 text-foreground border border-border shadow-sm"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => colorFileInputRefs.current[color.id]?.click()}
                        disabled={uploadingColorId === color.id}
                        className="h-10 w-10 rounded border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        {uploadingColorId === color.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </button>

                      <input
                        ref={(el) => { colorFileInputRefs.current[color.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files && uploadColorImages(color.id, e.target.files)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => saveColorAttributeValue(color.id)}
                      disabled={savingColorId === color.id || !dirtyColorIds[color.id] || isSavingColorOrder}
                      aria-label="Salvar cor"
                      title="Salvar cor"
                    >
                      {savingColorId === color.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColor(color.id)}
                      disabled={isSavingColorOrder}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {colors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma cor adicionada</p>
            <p className="text-sm">Adicione cores para criar variantes do produto</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
