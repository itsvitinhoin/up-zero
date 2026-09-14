"use client";

import Image from "next/image";
import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shotLabels, type Reference } from "@/lib/ai-studio/types";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/ai-studio/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body instanceof FormData || body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível concluir a solicitação.");
  return result as T;
}
export const media = (id: string) => `/api/ai-studio/media/${id}`;
export function Photo({
  id,
  alt,
  className = "",
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={media(id)}
      alt={alt}
      width={1024}
      height={1536}
      unoptimized
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
export const fieldClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function ReferencePicker({
  value,
  onChange,
  busy,
  onBusy,
  onError,
  onlyAvatar = false,
  onlyColor = false,
}: {
  value: Reference[];
  onChange: (v: Reference[]) => void;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (v: string) => void;
  onlyAvatar?: boolean;
  onlyColor?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const maximum = onlyColor ? 4 : onlyAvatar ? 3 : 8;
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    onBusy(true);
    const next = [...value];
    try {
      for (const file of Array.from(files).slice(0, maximum - next.length)) {
        const form = new FormData();
        form.set("file", file);
        const result = await api<{ assetId: string }>("references", form);
        next.push({
          assetId: result.assetId,
          role:
            onlyColor ? "color" : next.length === 0
              ? "front"
              : next.length === 1
                ? "back"
                : next.length === 2
                  ? "side"
                  : "detail",
        });
        onChange([...next]);
      }
    } catch (error) {
      onError((error as Error).message);
    } finally {
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((ref, index) => (
          <div
            key={ref.assetId}
            className="overflow-hidden rounded-xl border bg-muted/20"
          >
            <div className="relative h-36 bg-muted/40">
              <Photo id={ref.assetId} alt={`Referência ${index + 1}`} />
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remover referência ${index + 1}`}
                className="absolute right-1 top-1 rounded-full bg-background p-1 shadow"
              >
                <X className="size-4" />
              </button>
            </div>
            <select
              aria-label={`Ângulo da referência ${index + 1}`}
              className="w-full border-t bg-background p-2 text-xs"
              value={onlyColor ? ref.angle || "" : ref.role}
              disabled={busy}
              onChange={(e) =>
                onChange(
                  value.map((r, i) =>
                    i === index
                      ? onlyColor ? { ...r, angle: (e.target.value || undefined) as Reference["angle"] } : { ...r, role: e.target.value as Reference["role"] }
                      : r,
                  ),
                )
              }
            >
              {onlyColor && <option value="">Selecione o ângulo</option>}
              {(onlyAvatar
                ? ["front", "back", "side"]
                : ["front", "back", "side", "detail"]
              ).map((role) => (
                <option key={role} value={role}>
                  {role === "color"
                    ? "Cor real"
                    : shotLabels[role as keyof typeof shotLabels]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {value.length < maximum && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            <Upload className="size-5" />
            Enviar fotos
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        JPG, PNG ou WebP, até 8 MB cada. {onlyColor ? "Envie de 1 a 4 fotos da cor selecionada e indique o ângulo de cada uma." : "Confira o ângulo abaixo de cada foto."}
      </p>
    </div>
  );
}
export function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-3 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
export function ActionButton({
  children,
  busy,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  busy: boolean;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <Button type="button" disabled={busy} variant={variant} onClick={onClick}>
      {children}
    </Button>
  );
}
