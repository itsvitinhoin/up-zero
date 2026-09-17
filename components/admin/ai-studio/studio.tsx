"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Sparkles,
  Search,
  Library,
  Users,
  ArrowLeft,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  isBusy,
  shotLabels,
  statusLabels,
  type Angle,
  type Avatar,
  type Job,
  type Reference,
  type StudioProduct,
  type StudioColor,
} from "@/lib/ai-studio/types";
import { api, fieldClass, Photo, ReferencePicker, Section } from "./helpers";
import { JobReview } from "./job-review";

type CatalogItem = { id: number; name: string; image?: string };
type Status = {
  configured: boolean;
  workerOnline: boolean;
  dailyImageLimit: number;
};

export function Studio() {
  const params = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]),
    [avatars, setAvatars] = useState<Avatar[]>([]);
  const [status, setStatus] = useState<Status | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"new" | "library" | "avatars" | "job">(
      "new",
    ),
    [selected, setSelected] = useState<Job | null>(null);
  const [product, setProduct] = useState<StudioProduct | null>(null),
    [groupKey, setGroupKey] = useState("");
  const [query, setQuery] = useState(""),
    [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [refs, setRefs] = useState<Reference[]>([]),
    [colorRefs, setColorRefs] = useState<Reference[]>([]),
    [colors, setColors] = useState<StudioColor[]>([]),
    [color, setColor] = useState(""),
    [hex, setHex] = useState("#405a47");
  const [colorQuery, setColorQuery] = useState("");
  const [allColors, setAllColors] = useState(false);
  const [avatarId, setAvatarId] = useState(""),
    [angles, setAngles] = useState<Angle[]>(["front", "back", "side"]);
  const [imageModel, setImageModel] = useState<
    "gpt-image-2.5-sunburst" | "gpt-image-2.5-flare"
  >("gpt-image-2.5-sunburst");
  const [avatarName, setAvatarName] = useState(""),
    [avatarRefs, setAvatarRefs] = useState<Reference[]>([]),
    [rights, setRights] = useState(false);
  const selectedId = useRef<string | null>(null),
    requestId = useRef<string | null>(null);
  const locked = busy || uploading;
  function changeJob(job: Job) {
    if (selectedId.current !== job.id) {
      setProduct(null);
      setGroupKey(job.groupKey || "");
      if (job.productId) {
        void api<StudioProduct>(`product/${job.productId}`)
          .then((p) => {
            if (selectedId.current === job.id) setProduct(p);
          })
          .catch((e) => setError(e.message));
      }
    }
    selectedId.current = job.id;
    setSelected(job);
    setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
    setView("job");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [nextJobs, nextAvatars, nextStatus] = await Promise.all([
          api<Job[]>("jobs"),
          api<Avatar[]>("avatars"),
          api<Status>("status"),
        ]);
        if (!active) return;
        setJobs(nextJobs);
        setAvatars(nextAvatars);
        setStatus(nextStatus);
        if (selectedId.current) {
          const job = nextJobs.find((j) => j.id === selectedId.current);
          if (job) setSelected(job);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void api<StudioColor[]>("colors").then((v) => { if (active) setColors(v); }).catch((e) => { if (active) setError(e.message); });
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const id = Number(params.get("productId"));
    if (!Number.isSafeInteger(id) || id <= 0) return;
    let active = true;
    api<StudioProduct>(`product/${id}`)
      .then((p) => {
        if (active) {
          setProduct(p);

          setGroupKey("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [params]);
  function reset() {
    selectedId.current = null;
    setSelected(null);
    requestId.current = null;
    setRefs([]);
    setColorRefs([]);
    setColor("");
    setAvatarId("");
    setProduct(null);
    setGroupKey("");
    setCatalog([]);
    setError("");
    setView("new");
  }
  const searchProducts = () =>
    run(async () =>
      setCatalog(
        await api<CatalogItem[]>(`catalog?q=${encodeURIComponent(query)}`),
      ),
    );
  const chooseProduct = (id: number) =>
    run(async () => {
      const p = await api<StudioProduct>(`product/${id}`);
      setProduct(p);
      setGroupKey("");
      requestId.current = null;
      setRefs([]);
      setColorRefs([]);
      setColor("");
      setCatalog([]);
    });
  const productSelector = (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          aria-label="Buscar produto por nome ou código"
          className={fieldClass}
          placeholder="Buscar produto por nome ou código"
          value={query}
          disabled={locked}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void searchProducts();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={locked}
          aria-label="Buscar produtos"
          onClick={() => void searchProducts()}
        >
          <Search className="size-4" />
        </Button>
      </div>
      {catalog.length > 0 && (
        <div className="max-h-60 divide-y overflow-auto rounded-xl border">
          {catalog.map((p) => (
            <button
              type="button"
              key={p.id}
              disabled={locked}
              onClick={() => void chooseProduct(p.id)}
              className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-muted"
            >
              {p.image && (
                <Image
                  src={p.image}
                  alt=""
                  width={36}
                  height={48}
                  className="h-12 w-9 rounded object-cover"
                />
              )}
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      {product && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CircleCheck className="size-4 text-primary" />
            {product.name}
          </p>
          <label className="mt-3 block text-xs font-medium">
            Grupo de imagens de destino
            <select
              className={`${fieldClass} mt-1`}
              value={groupKey}
              disabled={locked}
              onChange={(e) => {
                setGroupKey(e.target.value);
                requestId.current = null;
                const g = product.groups.find((g) => g.key === e.target.value);
                const matching = colors.filter((c) => g?.attributeValueIds?.includes(c.id));
                if (matching.length === 1) { setColor(matching[0].name); setHex(matching[0].hex || "#808080"); setColorRefs([]); }
              }}
            >
              <option value="">Selecione a cor / variante</option>
              {product.groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label} · {g.images.length} fotos
                </option>
              ))}
            </select>
          </label>
          {product.groupingType === "product" && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Este produto usa uma galeria única. As fotos aprovadas serão adicionadas diretamente à galeria do produto.
            </p>
          )}
        </div>
      )}
    </div>
  );
  function clone() {
    if (!selected) return;
    setRefs(selected.references.filter((r) => r.role !== "color"));
    setColorRefs(selected.references.filter((r) => r.role === "color").slice(0, 4));
    setColor(selected.color);
    setHex(selected.hex);
    setAvatarId(selected.avatarId || "");
    setAngles(selected.angles);
    setImageModel(selected.imageModel);
    setGroupKey(selected.groupKey || "");
    requestId.current = null;
    setView("new");
    if (selected.productId)
      void run(async () =>
        setProduct(await api<StudioProduct>(`product/${selected.productId}`)),
      );
    else setProduct(null);
  }
  const existingImages = [
    ...new Set(product?.groups.flatMap((g) => g.images) || []),
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-primary">
            <Sparkles className="size-4" />
            Fotografia de produto
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Estúdio IA</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A mesma peça, em todas as cores. Crie fotos a partir de referências
            e revise antes de publicar.
          </p>
        </div>
        <Button disabled={locked} onClick={reset}>
          <Plus className="mr-2 size-4" />
          Novo ensaio
        </Button>
      </header>
      <nav
        className="flex gap-1 overflow-x-auto border-b"
        aria-label="Navegação do Estúdio"
      >
        {(
          [
            ["new", "Criar ensaio", Sparkles],
            ["library", "Biblioteca", Library],
            ["avatars", "Avatares", Users],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            disabled={locked}
            onClick={() => setView(key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm ${view === key || (view === "job" && key === "library") ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            <Icon className="size-4" />
            {label}
            {key === "library" && (
              <span className="rounded-full bg-muted px-2 text-xs">
                {jobs.length}
              </span>
            )}
          </button>
        ))}
      </nav>
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>{error}</p>
          <button aria-label="Dispensar mensagem" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {status && (!status.configured || !status.workerOnline) && (
        <p
          role="status"
          className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
        >
          {!status.configured
            ? "A chave da OpenAI precisa ser configurada para gerar imagens."
            : "O processamento está offline. Você pode organizar as referências enquanto o serviço é restabelecido."}
        </p>
      )}
      {loading ? (
        <div className="rounded-2xl border p-10 text-center text-muted-foreground">
          Carregando o Estúdio…
        </div>
      ) : view === "new" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Section number={1} title="Selecione o produto e o grupo de imagens">
              {productSelector}
              {existingImages.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Usar fotos existentes do produto ({existingImages.length})
                  </summary>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {existingImages.map((url, i) => (
                      <button
                        type="button"
                        key={url}
                        disabled={locked || refs.length >= 8}
                        onClick={() =>
                          void run(async () => {
                            const result = await api<{ assetId: string }>(
                              "references",
                              { productId: product!.id, url },
                            );
                            setRefs([
                              ...refs,
                              { assetId: result.assetId, role: "front" },
                            ]);
                            requestId.current = null;
                          })
                        }
                        className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border"
                        aria-label={`Usar foto existente ${i + 1}`}
                      >
                        <Image
                          src={url}
                          alt={`Foto existente ${i + 1}`}
                          width={80}
                          height={112}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-background/90 py-1 text-xs">
                          Usar foto
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <ReferencePicker
                value={refs}
                onChange={(v) => {
                  setRefs(v);
                  requestId.current = null;
                }}
                busy={locked}
                onBusy={setUploading}
                onError={setError}
              />
              <p className="text-sm text-muted-foreground">
                Frente e costas são um bom ponto de partida. A lateral será estimada a partir delas, e o detalhe será recortado da frente gerada. Use as fotos que tiver, mesmo que seja apenas uma. Detalhes não visíveis podem ficar diferentes da peça real; mais referências ajudam a reduzir esse risco.
              </p>
            </Section>
            <Section number={2} title="Defina a nova cor">
              <input aria-label="Buscar cor cadastrada" placeholder="Buscar cor cadastrada" className={fieldClass} value={colorQuery} onChange={(e) => setColorQuery(e.target.value)} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allColors} onChange={(e) => setAllColors(e.target.checked)} />Mostrar também cores fora deste produto</label>
              <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {colors.filter((c) => c.name.toLocaleLowerCase().includes(colorQuery.toLocaleLowerCase()) && (allColors || product?.groups.some((g) => g.attributeValueIds?.includes(c.id)))).map((c) => {
                  const groups = product?.groups.filter((g) => g.attributeValueIds?.includes(c.id)) || [];
                  const count = new Set(groups.flatMap((g) => g.images)).size;
                  return <button type="button" key={c.id} disabled={locked || !product} aria-pressed={color === c.name}
                    className={`rounded-xl border p-3 text-left text-sm ${color === c.name ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}
                    onClick={() => {
                      setColor(c.name); setHex(c.hex || "#808080"); setColorRefs([]);
                      setGroupKey(groups.length === 1 ? groups[0].key : ""); requestId.current = null;
                    }}>
                    <span className="flex items-center gap-2"><span className="size-5 shrink-0 rounded-full border" style={{ backgroundColor: c.hex || undefined }} />{c.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{groups.length ? product?.groupingType === "product" ? "Galeria compartilhada" : count ? `${count} fotos` : "Sem fotos" : "Sem variante neste produto"}</span>
                  </button>;
                })}
              </div>
              {!product && <p className="text-sm text-muted-foreground">Selecione o produto para ver suas cores.</p>}
              {!colors.length && <p className="text-sm text-muted-foreground">Nenhuma cor carregada. Cadastre as cores no sistema para selecioná-las aqui.</p>}
              <p className="text-sm text-muted-foreground">A cor cadastrada identifica a variante e o destino das fotos. O tom da geração será baseado exclusivamente nas fotos da etapa 3.</p>
              {color && !groupKey && <p className="text-sm text-muted-foreground">Selecione o grupo correspondente à cor no produto para publicar. Sem grupo, as fotos poderão ser geradas e salvas.</p>}
            </Section>
            <Section number={3} title="Referências da cor real">
              <p className="text-sm text-muted-foreground">Envie de 1 a 4 fotos da peça na cor {color || "selecionada"}, no manequim ou esticada (still), com luz neutra. Envie ao menos uma foto: essas imagens definem a cor da geração; Se não houver fotos na etapa 1, estas fotos também serão usadas para identificar a roupa. Selecione um avatar para vestir a peça.</p>
              <ReferencePicker onlyColor value={colorRefs} busy={locked || !color} onBusy={setUploading} onError={setError}
                onChange={(v) => { setColorRefs(v); requestId.current = null; }} />
            </Section>
            <Section number={4} title="Escolha quem veste a peça">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setAvatarId("");
                    requestId.current = null;
                  }}
                  aria-pressed={!avatarId}
                  className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center ${!avatarId ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}
                >
                  <Users className="size-7 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Manter modelo original
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Pessoa ou manequim da referência
                  </span>
                </button>
                {avatars.map((avatar) => (
                  <button
                    type="button"
                    key={avatar.id}
                    disabled={locked}
                    aria-pressed={avatarId === avatar.id}
                    onClick={() => {
                      setAvatarId(avatar.id);
                      requestId.current = null;
                    }}
                    className={`overflow-hidden rounded-xl border ${avatarId === avatar.id ? "border-primary ring-1 ring-primary" : ""}`}
                  >
                    <div className="h-36 bg-muted">
                      <Photo
                        id={avatar.references[0].assetId}
                        alt={avatar.name}
                      />
                    </div>
                    <span className="block p-2 text-sm">{avatar.name}</span>
                  </button>
                ))}
              </div>
              {!refs.length && !avatarId && <p className="text-sm text-muted-foreground">Sem fotos da peça na etapa 1, selecione um avatar. A roupa e a cor serão extraídas das fotos da etapa 3.</p>}
              {!avatars.length && (
                <p className="text-sm text-muted-foreground">
                  Cadastre referências aprovadas na aba Avatares para reutilizar
                  o mesmo modelo nos ensaios.
                </p>
              )}
            </Section>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="space-y-5 rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">5. Geração</h2>
              <p className="text-sm text-muted-foreground">{product?.name || "Selecione um produto"}</p>
              <div className="space-y-3">
                {(["front", "back", "side"] as Angle[]).map((angle) => (
                  <label
                    key={angle}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{shotLabels[angle]}</span>
                    <input
                      type="checkbox"
                      checked={angles.includes(angle)}
                      disabled={locked}
                      onChange={(e) => {
                        setAngles(
                          e.target.checked
                            ? (["front", "back", "side"] as Angle[]).filter(
                                (a) => a === angle || angles.includes(a),
                              )
                            : angles.filter((a) => a !== angle),
                        );
                        requestId.current = null;
                      }}
                    />
                  </label>
                ))}
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  {angles.includes("front")
                    ? "Frente, costas e lateral: enquadramento vertical com margens de 5% no topo e na base. Detalhe: recorte aproximado da roupa."
                    : "Inclua a frente para obter também a foto de detalhe."}
                </p>
              </div>
              <label className="block text-sm">
                Qualidade do processamento
                <select
                  className={`${fieldClass} mt-2`}
                  disabled={locked}
                  value={imageModel}
                  onChange={(e) => {
                    setImageModel(e.target.value as typeof imageModel);
                    requestId.current = null;
                  }}
                >
                  <option value="gpt-image-2.5-sunburst">
                    Sunburst · mais detalhe
                  </option>
                  <option value="gpt-image-2.5-flare">
                    Flare · comparar velocidade
                  </option>
                </select>
              </label>
              <Button
                className="w-full"
                disabled={
                  locked ||
                  !status?.configured ||
                  !status.workerOnline ||
                  !product ||
                  color.trim().length < 2 ||
                  !colorRefs.length ||
                  (!refs.length && !avatarId) ||
                  !angles.length
                }
                onClick={() =>
                  void run(async () => {
                    requestId.current ||= crypto.randomUUID();
                    changeJob(
                      await api<Job>("jobs", {
                        requestId: requestId.current,
                        name: product!.name.slice(0, 120),
                        productId: product?.id || null,
                        groupKey: groupKey || null,
                        color,
                        hex,
                        references: [...refs, ...colorRefs],
                        avatarId: avatarId || null,
                        angles,
                        imageModel,
                      }),
                    );
                  })
                }
              >
                {busy ? "Preparando…" : "Analisar peça"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A análise utiliza créditos. Você confere a ficha antes de
                solicitar a geração das fotos. Todas as imagens ficam salvas
                para revisão.
              </p>
            </section>
          </aside>
        </div>
      ) : view === "library" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ensaios e imagens salvos nesta loja. O processamento continua mesmo
            ao sair da página.
          </p>
          {!jobs.length ? (
            <div className="rounded-2xl border border-dashed p-12 text-center">
              <Library className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h2 className="font-medium">
                Sua biblioteca começa com a primeira peça
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie um ensaio para gerar fotos de outras cores.
              </p>
              <Button className="mt-5" onClick={() => setView("new")}>
                Criar primeiro ensaio
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => changeJob(job)}
                  className="overflow-hidden rounded-2xl border bg-card text-left transition hover:border-primary"
                >
                  <div className="h-52 bg-muted/40">
                    <Photo
                      id={job.outputs[0]?.assetId || job.references[0].assetId}
                      alt={job.name}
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <span className="text-xs text-muted-foreground">
                      {statusLabels[job.status]}
                      {isBusy(job) ? "…" : ""}
                    </span>
                    <h2 className="font-semibold">{job.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {job.color} · {job.outputs.length} imagens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : view === "avatars" ? (
        <div className="max-w-3xl space-y-5">
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Adicionar avatar à biblioteca</h2>
            <p className="text-sm text-muted-foreground">
              Use fotografias licenciadas ou avatares sintéticos já aprovados.
              Referências de frente, costas e perfil ajudam a manter identidade
              e proporções. As imagens ficam disponíveis apenas nesta loja.
            </p>
            <label className="block text-sm">
              Nome do avatar
              <input
                className={`${fieldClass} mt-1`}
                value={avatarName}
                maxLength={80}
                disabled={locked}
                onChange={(e) => setAvatarName(e.target.value)}
                placeholder="Ex.: Modelo Ana"
              />
            </label>
            <ReferencePicker
              value={avatarRefs}
              onChange={setAvatarRefs}
              busy={locked}
              onBusy={setUploading}
              onError={setError}
              onlyAvatar
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={rights}
                disabled={locked}
                onChange={(e) => setRights(e.target.checked)}
              />
              Tenho autorização de uso das referências e revisei a aparência
              deste avatar.
            </label>
            <Button
              disabled={
                locked ||
                !rights ||
                avatarName.trim().length < 2 ||
                !avatarRefs.some((r) => r.role === "front")
              }
              onClick={() =>
                void run(async () => {
                  const avatar = await api<Avatar>("avatars", {
                    name: avatarName,
                    references: avatarRefs,
                    rightsConfirmed: rights,
                  });
                  setAvatars([...avatars, avatar]);
                  setAvatarName("");
                  setAvatarRefs([]);
                  setRights(false);
                  toast.success("Avatar salvo na biblioteca.");
                })
              }
            >
              Salvar avatar
            </Button>
          </section>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className="overflow-hidden rounded-xl border"
              >
                <div className="h-48 bg-muted/30">
                  <Photo id={avatar.references[0].assetId} alt={avatar.name} />
                </div>
                <p className="p-3 text-sm font-medium">{avatar.name}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        selected && (
          <>
            <Button variant="ghost" onClick={() => setView("library")}>
              <ArrowLeft className="mr-2 size-4" />
              Biblioteca
            </Button>
            <JobReview
              key={selected.id}
              job={selected}
              onChange={changeJob}
              onClone={clone}
              run={run}
              busy={locked}
            />
            {(!selected.productId || !selected.groupKey) &&
              selected.outputs.some((o) => o.approved) && (
                <section className="space-y-4 rounded-2xl border bg-card p-5">
                  <h2 className="font-semibold">
                    Adicionar estas fotos a um produto
                  </h2>
                  {productSelector}
                  <p className="text-sm text-muted-foreground">
                    Confira se o grupo selecionado corresponde à cor{" "}
                    <strong>{selected.color}</strong>. As fotos aprovadas serão
                    adicionadas à galeria existente.
                  </p>
                  <Button
                    disabled={
                      locked ||
                      !product ||
                      !groupKey
                    }
                    onClick={() =>
                      void run(async () =>
                        changeJob(
                          await api<Job>(`jobs/${selected.id}/publish`, {
                            productId: product!.id,
                            groupKey,
                            shots: selected.outputs
                              .filter((o) => o.approved && !o.publishedUrl)
                              .map((o) => o.shot),
                          }),
                        ),
                      )
                    }
                  >
                    Adicionar fotos aprovadas
                  </Button>
                </section>
              )}
          </>
        )
      )}
    </main>
  );
}
