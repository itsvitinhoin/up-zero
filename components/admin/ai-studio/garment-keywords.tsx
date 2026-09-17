"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { garmentGuidance } from "@/lib/ai-studio/garment-guidance";
import { garmentGuidanceSchema, type GarmentGuidance, type Job } from "@/lib/ai-studio/types";
import { api, fieldClass } from "./helpers";

const piecesOptions = ["Blusa", "Saia", "Calça", "Shorts", "Vestido", "Macacão"];
const fitOptions = ["Reta", "Flare", "Wide leg", "Ajustada", "Evasê"];

export function GarmentKeywords({ job, blocked, run, onChange, onEditingChange }: {
  job: Job; blocked: boolean;
  run: (action: () => Promise<void>) => void;
  onChange: (job: Job) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState<(Omit<GarmentGuidance, "pieces"> & { piecesText: string }) | null>(null);
  const [error, setError] = useState("");
  const current = garmentGuidance(job);
  const pieces = draft?.piecesText.split(",").map(p => p.trim()).filter(Boolean) || [];
  const start = () => {
    setDraft({ ...current, piecesText: current.pieces.join(", ") });
    setError("");
    onEditingChange(true);
  };
  const cancel = () => { setDraft(null); setError(""); onEditingChange(false); };
  const save = () => {
    if (!draft) return;
    const parsed = garmentGuidanceSchema.safeParse({ pieces, composition: draft.composition, fit: draft.fit, pattern: draft.pattern, notes: draft.notes });
    if (!parsed.success) { setError("Informe de 1 a 8 peças (até 80 caracteres cada), modelagem e estampa (até 160 caracteres), e até 1.500 caracteres nos detalhes."); return; }
    run(async () => {
      const updated = await api<Job>(`jobs/${job.id}`, { action: "update_guidance", guidance: parsed.data });
      onChange(updated);
      cancel();
    });
  };
  return <section className="space-y-3 rounded-xl border bg-background p-4" aria-label="Identificação da roupa">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-medium">Confira a identificação da roupa</h3>
        <p className="mt-1 text-xs text-muted-foreground">{job.garmentGuidance ? "Orientação salva por você. Ela tem prioridade sobre a classificação da IA." : "Palavras-chave da análise. Se a IA confundiu saia com calça, corrija antes de gerar."}</p>
      </div>
      {!draft && <Button size="sm" variant="outline" disabled={blocked} onClick={start}>Corrigir ou adicionar detalhes</Button>}
    </div>
    {!draft ? <>
      <div className="flex flex-wrap gap-2">
        {[...current.pieces, `Composição: ${current.composition}`, `Modelagem: ${current.fit}`, `Estampa: ${current.pattern}`].map((keyword, index) => <span key={`${index}-${keyword}`} className="rounded-full bg-muted px-3 py-1 text-sm">{keyword}</span>)}
      </div>
      {current.notes && <p className="whitespace-pre-wrap text-sm"><strong>Detalhes adicionais:</strong> {current.notes}</p>}
    </> : <div className="space-y-4">
      <label className="block space-y-1 text-sm"><span>Tipo de peça (separe por vírgula)</span><input className={fieldClass} disabled={blocked} value={draft.piecesText} maxLength={648} placeholder="Ex.: Blusa, Saia" onChange={e => setDraft({ ...draft, piecesText: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2" aria-label="Sugestões de peças">{piecesOptions.map(piece => <Button key={piece} size="sm" variant={pieces.includes(piece) ? "default" : "outline"} aria-pressed={pieces.includes(piece)} disabled={blocked} onClick={() => setDraft({ ...draft, piecesText: (pieces.includes(piece) ? pieces.filter(p => p !== piece) : [...pieces, piece]).join(", ") })}>{piece}</Button>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-sm"><span>Composição</span><select className={fieldClass} disabled={blocked} value={draft.composition} onChange={e => setDraft({ ...draft, composition: e.target.value as GarmentGuidance["composition"] })}>{["Peça única", "Conjunto", "Não identificado"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block space-y-1 text-sm"><span>Modelagem</span><input className={fieldClass} disabled={blocked} value={draft.fit} maxLength={160} placeholder="Ex.: Saia evasê, blusa reta" onChange={e => setDraft({ ...draft, fit: e.target.value })} /></label>
        <label className="block space-y-1 text-sm"><span>Estampa / superfície</span><input className={fieldClass} disabled={blocked} value={draft.pattern} maxLength={160} placeholder="Ex.: Estampado floral" onChange={e => setDraft({ ...draft, pattern: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Modelagens:</span>{fitOptions.map(fit => <Button key={fit} size="sm" variant="outline" disabled={blocked} onClick={() => setDraft({ ...draft, fit })}>{fit}</Button>)}</div>
      <label className="block space-y-1 text-sm"><span>Detalhes para orientar a geração</span><textarea className={`${fieldClass} min-h-24`} disabled={blocked} maxLength={1500} value={draft.notes} placeholder="Ex.: É um conjunto de blusa e saia longa. A saia é uma peça contínua, sem divisão entre as pernas. Não transformar em calça." onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Salvar estas informações não usa créditos de IA. Salve ou cancele a edição antes de gerar.</p>
      <div className="flex gap-2"><Button size="sm" disabled={blocked} onClick={save}>Salvar orientações</Button><Button size="sm" variant="outline" disabled={blocked} onClick={cancel}>Cancelar edição</Button></div>
    </div>}
    {job.outputs.length > 0 && <p className="text-xs text-muted-foreground">As correções valem para as próximas fotos que você gerar ou refizer. As imagens já geradas permanecem como estão.</p>}
  </section>;
}
