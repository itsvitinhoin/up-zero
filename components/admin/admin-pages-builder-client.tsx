"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft, Save, Plus, ArrowUp, ArrowDown, Trash2,
  Heading, AlignLeft, MousePointer, Image as ImageIcon,
  CircleUser, Minus, Square, Code, Columns3, BoxSelect,
  ChevronLeft, Settings, Eye, ExternalLink, X,
  AlignCenter, AlignRight, LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { updateInstitutionalPageAction } from "@/lib/actions/pages";
import type { InstitutionalPage } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BlockType =
  | "heading" | "text" | "button" | "image"
  | "avatar" | "divider" | "spacer" | "html"
  | "columns" | "container"
  // legacy (hidden from palette, still renderable)
  | "hero" | "image-text" | "features";

export interface PageBlock {
  id: string;
  type: BlockType;
  data: Record<string, any>;
  children?: PageBlock[];  // used by columns/container
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

// ─── Block Catalogue ────────────────────────────────────────────────────────

interface BlockMeta {
  name: string;
  icon: React.ReactNode;
  defaults: Record<string, any>;
}

const BLOCK_CATALOGUE: Record<string, BlockMeta> = {
  heading:   { name: "Heading",   icon: <Heading size={20} />,      defaults: { text: "Seu Título", level: "h2", align: "left" } },
  text:      { name: "Text",      icon: <AlignLeft size={20} />,    defaults: { content: "<p>Seu texto aqui...</p>" } },
  button:    { name: "Button",    icon: <MousePointer size={20} />, defaults: { label: "Clique Aqui", url: "/", variant: "primary", align: "left" } },
  image:     { name: "Image",     icon: <ImageIcon size={20} />,    defaults: { src: "", alt: "", width: 100, borderRadius: 0 } },
  avatar:    { name: "Avatar",    icon: <CircleUser size={20} />,   defaults: { src: "", size: 80, shape: "circle" } },
  divider:   { name: "Divider",   icon: <Minus size={20} />,        defaults: { style: "solid", color: "#e2e8f0", widthPercent: 100 } },
  spacer:    { name: "Spacer",    icon: <Square size={20} />,       defaults: { height: 40 } },
  html:      { name: "Html",      icon: <Code size={20} />,         defaults: { content: "" } },
  columns:   { name: "Columns",   icon: <Columns3 size={20} />,     defaults: { columnCount: 2, gap: 16, align: "stretch" } },
  container: { name: "Container", icon: <BoxSelect size={20} />,    defaults: { bgColor: "transparent", padding: 16 } },
};

const PALETTE_TYPES = Object.keys(BLOCK_CATALOGUE) as BlockType[];

function createBlock(type: BlockType): PageBlock {
  const meta = BLOCK_CATALOGUE[type];
  const block: PageBlock = { id: uid(), type, data: { ...meta?.defaults } };
  if (type === "columns") {
    const cols = (block.data.columnCount || 2) as number;
    block.children = Array.from({ length: cols }, () => ({ id: uid(), type: "container" as BlockType, data: { bgColor: "transparent", padding: 0 }, children: [] }));
  }
  if (type === "container") {
    block.children = [];
  }
  return block;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface BuilderProps {
  storeId: number;
  page: InstitutionalPage;
}

export default function AdminPagesBuilderClient({ storeId, page }: BuilderProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // page-level
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [isActive, setIsActive] = useState(page.is_active);

  // blocks
  const initialBlocks: PageBlock[] = page.meta?.blocks || [];
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);

  // editor
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [inserterIndex, setInserterIndex] = useState<number | null>(null); // null = hidden, number = insert position
  const [inserterParentId, setInserterParentId] = useState<string | null>(null); // null = root level

  // ── helpers ──

  const findBlock = useCallback((id: string, list: PageBlock[] = blocks): PageBlock | null => {
    for (const b of list) {
      if (b.id === id) return b;
      if (b.children) {
        const found = findBlock(id, b.children);
        if (found) return found;
      }
    }
    return null;
  }, [blocks]);

  const selectedBlock = selectedId ? findBlock(selectedId) : null;

  // ── mutations (immutable) ──

  const updateBlockInTree = (list: PageBlock[], id: string, updater: (b: PageBlock) => PageBlock): PageBlock[] =>
    list.map(b => {
      if (b.id === id) return updater(b);
      if (b.children) return { ...b, children: updateBlockInTree(b.children, id, updater) };
      return b;
    });

  const deleteBlockInTree = (list: PageBlock[], id: string): PageBlock[] =>
    list.filter(b => b.id !== id).map(b => b.children ? { ...b, children: deleteBlockInTree(b.children, id) } : b);

  const insertBlockInTree = (list: PageBlock[], index: number, block: PageBlock, parentId: string | null): PageBlock[] => {
    if (parentId === null) {
      const copy = [...list];
      copy.splice(index, 0, block);
      return copy;
    }
    return list.map(b => {
      if (b.id === parentId && b.children) {
        const kids = [...b.children];
        kids.splice(index, 0, block);
        return { ...b, children: kids };
      }
      if (b.children) return { ...b, children: insertBlockInTree(b.children, index, block, parentId) };
      return b;
    });
  };

  const moveBlockInList = (list: PageBlock[], id: string, dir: "up" | "down"): PageBlock[] => {
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return list;
      const copy = [...list];
      [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
      return copy;
    }
    return list.map(b => b.children ? { ...b, children: moveBlockInList(b.children, id, dir) } : b);
  };

  const updateBlock = (id: string, newData: Record<string, any>) => {
    setBlocks(prev => updateBlockInTree(prev, id, b => ({ ...b, data: { ...b.data, ...newData } })));
  };

  const deleteBlock = (id: string) => {
    if (selectedId === id) setSelectedId(null);
    setBlocks(prev => deleteBlockInTree(prev, id));
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    setBlocks(prev => moveBlockInList(prev, id, dir));
  };

  const insertBlock = (type: BlockType) => {
    const block = createBlock(type);
    const index = inserterIndex ?? blocks.length;
    const parentId = inserterParentId;
    setBlocks(prev => insertBlockInTree(prev, index, block, parentId));
    setSelectedId(block.id);
    setInserterIndex(null);
    setInserterParentId(null);
  };

  const openInserter = (index: number, parentId: string | null = null) => {
    setInserterIndex(index);
    setInserterParentId(parentId);
  };

  // columns child management
  const updateColumnsCount = (id: string, newCount: number) => {
    setBlocks(prev => updateBlockInTree(prev, id, b => {
      const current = b.children || [];
      let kids: PageBlock[];
      if (newCount > current.length) {
        kids = [...current, ...Array.from({ length: newCount - current.length }, () => ({ id: uid(), type: "container" as BlockType, data: { bgColor: "transparent", padding: 0 }, children: [] }))];
      } else {
        kids = current.slice(0, newCount);
      }
      return { ...b, data: { ...b.data, columnCount: newCount }, children: kids };
    }));
  };

  // ── save ──

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateInstitutionalPageAction(page.id, {
      title, slug, isActive,
      meta: { ...page.meta, blocks },
    });
    if (result.success) toast.success("Página salva com sucesso!");
    else toast.error(result.error || "Erro ao salvar página");
    setIsSaving(false);
  };

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  const renderSidebar = () => {
    // Page settings
    if (showSettings) {
      return (
        <div className="space-y-6 pt-4 pb-8">
          <div className="flex items-center gap-2 pb-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-7 w-7"><ChevronLeft size={16} /></Button>
            <h3 className="font-semibold text-lg">Configurações</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título da Página</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm shrink-0">/p/</span>
                <Input value={slug} onChange={e => setSlug(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label>Acessível publicamente</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>
      );
    }

    // Block properties
    if (selectedBlock && BLOCK_CATALOGUE[selectedBlock.type]) {
      return (
        <div className="space-y-5 pt-4 pb-12">
          <div className="flex items-center gap-2 pb-3 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="h-7 w-7"><ChevronLeft size={16} /></Button>
            <h3 className="font-semibold truncate">{BLOCK_CATALOGUE[selectedBlock.type]?.name?.toUpperCase()} BLOCK</h3>
          </div>
          <div className="space-y-4">
            {renderBlockProps(selectedBlock)}
          </div>
        </div>
      );
    }

    // Default: block palette
    return (
      <div className="space-y-6 pt-4 pb-8">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Blocos</h3>
          <Badge variant="secondary">{blocks.length}</Badge>
        </div>
        {blocks.length === 0 && (
          <div className="py-10 text-center border-2 border-dashed rounded-lg text-muted-foreground text-sm">
            Página vazia. Adicione blocos abaixo.
          </div>
        )}
        <Separator />
        <BlockPalette onAdd={(type) => { insertBlock(type); }} />
      </div>
    );
  };

  // ─── Block Properties Panel ───────────────────────────────────────────────

  const renderBlockProps = (block: PageBlock) => {
    const d = block.data;
    const set = (patch: Record<string, any>) => updateBlock(block.id, patch);

    switch (block.type) {
      case "heading":
        return (<>
          <div className="space-y-2"><Label>Texto</Label><Input value={d.text} onChange={e => set({ text: e.target.value })} /></div>
          <div className="space-y-2"><Label>Nível</Label>
            <div className="flex gap-1">{(["h1","h2","h3","h4"] as const).map(l => (
              <Button key={l} size="sm" variant={d.level === l ? "default" : "outline"} className="flex-1 uppercase text-xs" onClick={() => set({ level: l })}>{l}</Button>
            ))}</div>
          </div>
          <AlignmentSelector value={d.align} onChange={v => set({ align: v })} />
        </>);

      case "text":
        return (<>
          <div className="space-y-2"><Label>Conteúdo (HTML)</Label>
            <Textarea className="min-h-[200px] max-h-[80vh]  font-mono text-xs" value={d.content} onChange={e => set({ content: e.target.value })} />
          </div>
        </>);

      case "button":
        return (<>
          <div className="space-y-2"><Label>Texto do Botão</Label><Input value={d.label} onChange={e => set({ label: e.target.value })} /></div>
          <div className="space-y-2"><Label>Link (URL)</Label><Input value={d.url} onChange={e => set({ url: e.target.value })} /></div>
          <div className="space-y-2"><Label>Estilo</Label>
            <div className="flex gap-1">{(["primary","outline","ghost"] as const).map(v => (
              <Button key={v} size="sm" variant={d.variant === v ? "default" : "outline"} className="flex-1 capitalize text-xs" onClick={() => set({ variant: v })}>{v}</Button>
            ))}</div>
          </div>
          <AlignmentSelector value={d.align} onChange={v => set({ align: v })} />
        </>);

      case "image":
        return (<>
          <div className="space-y-2">
            <Label>Imagem</Label>
            <ImageUpload value={d.src || null} onChange={(url) => set({ src: url || "" })} imageType="pageContent" folder="pages" hideRecommendation />
          </div>
          <div className="space-y-2"><Label>Texto Alt</Label><Input value={d.alt} onChange={e => set({ alt: e.target.value })} /></div>
          <div className="space-y-2"><Label>Largura (%)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.width]} min={10} max={100} step={5} onValueChange={([v]) => set({ width: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.width}%</span>
            </div>
          </div>
          <div className="space-y-2"><Label>Borda Arredondada (px)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.borderRadius]} min={0} max={32} step={2} onValueChange={([v]) => set({ borderRadius: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.borderRadius}px</span>
            </div>
          </div>
        </>);

      case "avatar":
        return (<>
          <div className="space-y-2">
            <Label>Imagem</Label>
            <ImageUpload value={d.src || null} onChange={(url) => set({ src: url || "" })} imageType="pageContent" folder="pages" hideRecommendation />
          </div>
          <div className="space-y-2"><Label>Tamanho (px)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.size]} min={32} max={200} step={8} onValueChange={([v]) => set({ size: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.size}px</span>
            </div>
          </div>
          <div className="space-y-2"><Label>Formato</Label>
            <div className="flex gap-1">
              <Button size="sm" variant={d.shape === "circle" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => set({ shape: "circle" })}>Círculo</Button>
              <Button size="sm" variant={d.shape === "square" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => set({ shape: "square" })}>Quadrado</Button>
            </div>
          </div>
        </>);

      case "divider":
        return (<>
          <div className="space-y-2"><Label>Estilo</Label>
            <div className="flex gap-1">{(["solid","dashed","dotted"] as const).map(s => (
              <Button key={s} size="sm" variant={d.style === s ? "default" : "outline"} className="flex-1 capitalize text-xs" onClick={() => set({ style: s })}>{s}</Button>
            ))}</div>
          </div>
          <div className="space-y-2"><Label>Cor</Label><Input type="color" value={d.color} onChange={e => set({ color: e.target.value })} className="h-10 px-1" /></div>
          <div className="space-y-2"><Label>Largura (%)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.widthPercent]} min={10} max={100} step={5} onValueChange={([v]) => set({ widthPercent: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.widthPercent}%</span>
            </div>
          </div>
        </>);

      case "spacer":
        return (<>
          <div className="space-y-2"><Label>Altura (px)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.height]} min={8} max={120} step={4} onValueChange={([v]) => set({ height: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.height}px</span>
            </div>
          </div>
        </>);

      case "html":
        return (<>
          <div className="space-y-2"><Label>Código HTML</Label>
            <Textarea className="min-h-[250px] max-h-[80vh] overflow-y-auto font-mono text-xs" value={d.content} onChange={e => set({ content: e.target.value })} placeholder="<div>...</div>" />
          </div>
        </>);

      case "columns":
        return (<>
          <div className="space-y-2"><Label>Número de colunas</Label>
            <div className="flex gap-1">{[2, 3].map(n => (
              <Button key={n} size="sm" variant={d.columnCount === n ? "default" : "outline"} className="flex-1 text-xs"
                onClick={() => updateColumnsCount(block.id, n)}>{n}</Button>
            ))}</div>
          </div>
          <div className="space-y-2"><Label>Gap entre colunas (px)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.gap]} min={0} max={48} step={4} onValueChange={([v]) => set({ gap: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.gap}px</span>
            </div>
          </div>
          <div className="space-y-2"><Label>Alinhamento Vertical</Label>
            <div className="flex gap-1">{([["start","Topo"],["center","Centro"],["stretch","Preencher"]] as const).map(([v, l]) => (
              <Button key={v} size="sm" variant={d.align === v ? "default" : "outline"} className="flex-1 text-xs" onClick={() => set({ align: v })}>{l}</Button>
            ))}</div>
          </div>
        </>);

      case "container":
        return (<>
          <div className="space-y-2"><Label>Cor de Fundo</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={d.bgColor === "transparent" ? "#ffffff" : d.bgColor} onChange={e => set({ bgColor: e.target.value })} className="h-10 w-14 px-1" />
              <Button size="sm" variant="outline" className="text-xs" onClick={() => set({ bgColor: "transparent" })}>Transparente</Button>
            </div>
          </div>
          <div className="space-y-2"><Label>Padding (px)</Label>
            <div className="flex items-center gap-3">
              <Slider value={[d.padding]} min={0} max={64} step={4} onValueChange={([v]) => set({ padding: v })} className="flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{d.padding}px</span>
            </div>
          </div>
        </>);

      default:
        return <p className="text-sm text-muted-foreground">Bloco legado sem propriedades editáveis.</p>;
    }
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r bg-background flex flex-col h-full shadow-sm z-20">
        <div className="flex items-center justify-between p-4 border-b shrink-0 h-14">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/pages/institutional"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setShowSettings(true); setSelectedId(null); }} className={showSettings ? "bg-muted" : ""}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "..." : <><Save className="h-4 w-4 mr-1.5" /> Salvar</>}
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 pr-5">
            {renderSidebar()}
          </div>
        </ScrollArea>
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col h-full min-h-0">
        <div className="h-14 flex items-center px-6 justify-between border-b bg-background/50 backdrop-blur shrink-0">
          <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 border py-1 px-2.5 rounded-full bg-background">
            <Eye size={14} /> Pré-visualização
          </span>
          <div className="flex items-center gap-3">
            {!isActive && <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent">Rascunho</Badge>}
            {isActive && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent">Publicada</Badge>}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/p/${page.slug}`} target="_blank">Ver na Loja <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-100/60 min-h-0">
          <div className="max-w-[900px] mx-auto my-8 bg-white shadow-sm rounded-lg min-h-[400px] relative">
            {blocks.length === 0 && inserterIndex === null && (
              <div className="flex flex-col items-center justify-center py-32 opacity-40">
                <LayoutTemplate size={48} className="mb-4 text-muted-foreground" />
                <h2 className="text-xl font-bold mb-2">Editor Visual</h2>
                <p className="text-muted-foreground text-sm mb-6">Clique no + para começar.</p>
              </div>
            )}

            {/* Inserter at top */}
            <InserterButton onClick={() => openInserter(0)} />

            {blocks.map((block, idx) => (
              <div key={block.id}>
                <BlockPreview
                  block={block}
                  isSelected={selectedId === block.id}
                  onSelect={() => { setShowSettings(false); setSelectedId(block.id); }}
                  onMoveUp={() => moveBlock(block.id, "up")}
                  onMoveDown={() => moveBlock(block.id, "down")}
                  onDelete={() => deleteBlock(block.id)}
                  onOpenInserter={openInserter}
                  selectedId={selectedId}
                  setSelectedId={(id) => { setShowSettings(false); setSelectedId(id); }}
                  onMoveBlock={moveBlock}
                  onDeleteBlock={deleteBlock}
                />
                <InserterButton onClick={() => openInserter(idx + 1)} />
              </div>
            ))}

            {/* Inserter Popover */}
            {inserterIndex !== null && (
              <InserterPopover onAdd={insertBlock} onClose={() => { setInserterIndex(null); setInserterParentId(null); }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AlignmentSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Alinhamento</Label>
      <div className="flex gap-1">
        <Button size="sm" variant={value === "left" ? "default" : "outline"} className="flex-1" onClick={() => onChange("left")}><AlignLeft size={14} /></Button>
        <Button size="sm" variant={value === "center" ? "default" : "outline"} className="flex-1" onClick={() => onChange("center")}><AlignCenter size={14} /></Button>
        <Button size="sm" variant={value === "right" ? "default" : "outline"} className="flex-1" onClick={() => onChange("right")}><AlignRight size={14} /></Button>
      </div>
    </div>
  );
}

function BlockPalette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PALETTE_TYPES.map(type => {
        const meta = BLOCK_CATALOGUE[type];
        return (
          <button key={type} onClick={() => onAdd(type)} className="flex flex-col items-center justify-center p-3.5 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors gap-2">
            <div className="text-muted-foreground">{meta.icon}</div>
            <span className="text-xs text-center font-medium leading-tight">{meta.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function InserterButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative h-0 flex items-center justify-center z-10 group">
      <button
        onClick={onClick}
        className="absolute -translate-y-1/2 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
      >
        <Plus size={16} />
      </button>
      <div className="absolute left-4 right-4 border-t border-transparent group-hover:border-primary/20 transition-colors -translate-y-1/2" />
    </div>
  );
}

function InserterPopover({ onAdd, onClose }: { onAdd: (type: BlockType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border p-5 w-[380px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-sm">Adicionar Bloco</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PALETTE_TYPES.map(type => {
            const meta = BLOCK_CATALOGUE[type];
            return (
              <button key={type} onClick={() => onAdd(type)}
                className="flex flex-col items-center justify-center p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors gap-1.5"
              >
                <div className="text-muted-foreground">{meta.icon}</div>
                <span className="text-[10px] text-center font-medium leading-tight">{meta.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Block Preview ──────────────────────────────────────────────────────────

interface BlockPreviewProps {
  block: PageBlock;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onOpenInserter: (index: number, parentId: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  onMoveBlock: (id: string, dir: "up" | "down") => void;
  onDeleteBlock: (id: string) => void;
}

function BlockPreview({ block, isSelected, onSelect, onMoveUp, onMoveDown, onDelete, onOpenInserter, selectedId, setSelectedId, onMoveBlock, onDeleteBlock }: BlockPreviewProps) {
  const d = block.data;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`relative group cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary ring-inset" : "hover:ring-1 hover:ring-primary/30"}`}
    >
      {/* Floating toolbar */}
      <div className={`absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 bg-white border rounded-md shadow-sm z-20 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown size={14} /></button>
        <div className="border-t" />
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
      </div>

      {/* Block type label */}
      {isSelected && (
        <div className="absolute -top-3 left-3 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded z-20 pointer-events-none uppercase">
          {BLOCK_CATALOGUE[block.type]?.name || block.type}
        </div>
      )}

      {/* Content */}
      {block.type === "heading" && (
        <div className="px-8 py-6" style={{ textAlign: d.align as any }}>
          {d.level === "h1" && <h1 className="text-4xl font-bold">{d.text || "Heading"}</h1>}
          {d.level === "h2" && <h2 className="text-3xl font-bold">{d.text || "Heading"}</h2>}
          {d.level === "h3" && <h3 className="text-2xl font-semibold">{d.text || "Heading"}</h3>}
          {d.level === "h4" && <h4 className="text-xl font-semibold">{d.text || "Heading"}</h4>}
        </div>
      )}

      {block.type === "text" && (
        <div className="px-8 py-4">
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: d.content || "<p>Texto vazio</p>" }} />
        </div>
      )}

      {block.type === "button" && (
        <div className="px-8 py-6" style={{ textAlign: d.align as any }}>
          <button className={`inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-medium transition-colors ${
            d.variant === "primary" ? "bg-primary text-white" :
            d.variant === "outline" ? "border border-primary text-primary" :
            "text-primary hover:bg-muted"
          }`}>
            {d.label || "Button"}
          </button>
        </div>
      )}

      {block.type === "image" && (
        <div className="px-8 py-4 flex justify-center">
          {d.src ? (
            <img src={d.src} alt={d.alt} style={{ width: `${d.width}%`, borderRadius: `${d.borderRadius}px` }} className="max-w-full h-auto" />
          ) : (
            <div className="w-full bg-gray-100 border-2 border-dashed rounded-lg flex items-center justify-center py-16 text-muted-foreground" style={{ width: `${d.width}%` }}>
              <ImageIcon size={40} className="opacity-30" />
            </div>
          )}
        </div>
      )}

      {block.type === "avatar" && (
        <div className="px-8 py-4 flex justify-center">
          {d.src ? (
            <img src={d.src} alt="Avatar" style={{ width: d.size, height: d.size, borderRadius: d.shape === "circle" ? "50%" : "8px" }} className="object-cover" />
          ) : (
            <div className="bg-gray-200 flex items-center justify-center text-muted-foreground" style={{ width: d.size, height: d.size, borderRadius: d.shape === "circle" ? "50%" : "8px" }}>
              <CircleUser size={d.size * 0.5} className="opacity-40" />
            </div>
          )}
        </div>
      )}

      {block.type === "divider" && (
        <div className="px-8 py-4 flex justify-center">
          <hr style={{ borderStyle: d.style, borderColor: d.color, width: `${d.widthPercent}%` }} className="border-t-2" />
        </div>
      )}

      {block.type === "spacer" && (
        <div className="relative group/spacer" style={{ height: d.height }}>
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-t border-dashed border-gray-300 opacity-0 group-hover/spacer:opacity-100 transition-opacity" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-white px-1 opacity-0 group-hover/spacer:opacity-100 transition-opacity">{d.height}px</span>
        </div>
      )}

      {block.type === "html" && (
        <div className="px-8 py-4">
          {d.content ? (
            <div dangerouslySetInnerHTML={{ __html: d.content }} />
          ) : (
            <div className="border-2 border-dashed rounded-lg py-8 text-center text-muted-foreground text-sm">
              <Code size={24} className="mx-auto mb-2 opacity-30" />
              HTML vazio
            </div>
          )}
        </div>
      )}

      {block.type === "columns" && (
        <div className="px-8 py-4">
          <div className="flex" style={{ gap: d.gap, alignItems: d.align === "center" ? "center" : d.align === "start" ? "flex-start" : "stretch" }}>
            {(block.children || []).map((col, colIdx) => (
              <div
                key={col.id}
                className={`flex-1 border border-dashed rounded-lg min-h-[80px] relative ${selectedId === col.id ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50/50"}`}
                onClick={(e) => { e.stopPropagation(); setSelectedId(col.id); }}
                style={{ backgroundColor: col.data.bgColor !== "transparent" ? col.data.bgColor : undefined, padding: col.data.padding }}
              >
                {/* Children of column */}
                {(col.children || []).length === 0 && (
                  <div className="flex items-center justify-center h-full min-h-[80px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenInserter(0, col.id); }}
                      className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
                {(col.children || []).map((child, childIdx) => (
                  <div key={child.id}>
                    <BlockPreview
                      block={child}
                      isSelected={selectedId === child.id}
                      onSelect={() => setSelectedId(child.id)}
                      onMoveUp={() => onMoveBlock(child.id, "up")}
                      onMoveDown={() => onMoveBlock(child.id, "down")}
                      onDelete={() => onDeleteBlock(child.id)}
                      onOpenInserter={onOpenInserter}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      onMoveBlock={onMoveBlock}
                      onDeleteBlock={onDeleteBlock}
                    />
                  </div>
                ))}
                {(col.children || []).length > 0 && (
                  <div className="flex justify-center py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenInserter((col.children || []).length, col.id); }}
                      className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === "container" && !block.children && (
        <div className="px-8 py-4" style={{ backgroundColor: d.bgColor !== "transparent" ? d.bgColor : undefined, padding: d.padding }}>
          <div className="border-2 border-dashed rounded-lg py-8 text-center text-muted-foreground text-sm">
            Container
          </div>
        </div>
      )}

      {/* Legacy block types — simple rendering */}
      {block.type === "hero" && (
        <div className="bg-slate-900 text-white py-20 px-8 text-center">
          <h1 className="text-4xl font-extrabold mb-2">{d.title || "Hero"}</h1>
          <p className="text-lg opacity-80">{d.subtitle}</p>
        </div>
      )}
      {block.type === "image-text" && (
        <div className="px-8 py-8 flex gap-8 items-center">
          <div className="flex-1"><h2 className="text-2xl font-bold mb-2">{d.title}</h2><div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: d.content }} /></div>
          <div className="flex-1 bg-gray-100 rounded-lg h-40 flex items-center justify-center"><ImageIcon className="opacity-20" size={40} /></div>
        </div>
      )}
      {block.type === "features" && (
        <div className="px-8 py-8 text-center">
          <h2 className="text-2xl font-bold mb-4">{d.title}</h2>
          <div className="flex gap-4 justify-center">{d.columns?.map((c: any, i: number) => (
            <div key={i} className="p-4 border rounded-lg"><h3 className="font-semibold">{c.title}</h3><p className="text-sm text-muted-foreground">{c.description}</p></div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
