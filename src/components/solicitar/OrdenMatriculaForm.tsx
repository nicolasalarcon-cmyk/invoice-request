import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { formatCOP } from "@/lib/format";
import { getFormConfig, type FormConfig } from "@/lib/form-config";
import { listProgramas, type Programa } from "@/lib/programas";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCohortesByNemonico, type CohorteRow } from "@/lib/sheets.functions";
import { AttachmentsField, type AttachmentItem } from "./AttachmentsField";

const CONCEPTOS_FIJOS = ["Matrícula", "Matrícula Parcial", "Otro"] as const;

interface FormState {
  nombre: string;
  identificacion: string;
  email: string;
  tipo_financiacion: string;
  tipo_programa: string;
  programa: string;
  programa_nemonico: string;
  codigo_snies: string;
  cohorte: string;
  plan_estudio: string;
  fecha_inicio: string;
  fecha_fin: string;
  horas_programa: string;
  duracion: string;
  convocatoria: string;
  periodo: string;
  concepto_opcion: string;
  concepto_otro: string;
  valor: string;
  descuento_pct: string;
  descuento_bono: string;
  fecha_limite_pago: string;
  observaciones: string;
}

const EMPTY: FormState = {
  nombre: "", identificacion: "", email: "", tipo_financiacion: "",
  tipo_programa: "Diplomado", programa: "", programa_nemonico: "",
  codigo_snies: "", cohorte: "", plan_estudio: "",
  fecha_inicio: "", fecha_fin: "", horas_programa: "",
  duracion: "", convocatoria: "",
  periodo: "1er Semestre 2026",
  concepto_opcion: "Matrícula", concepto_otro: "",
  valor: "", descuento_pct: "0", descuento_bono: "0",
  fecha_limite_pago: "", observaciones: "",
};

function deriveSemestre(fecha: string): string {
  if (!fecha) return "";
  let d: Date | null = null;
  const m1 = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const m2 = fecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
  else if (m2) d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  if (!d || isNaN(d.getTime())) return "";
  const mes = d.getMonth() + 1;
  const label = mes <= 6 ? "1er Semestre" : "2do Semestre";
  return `${label} ${d.getFullYear()}`;
}

export function OrdenMatriculaForm({ editId }: { editId?: string }) {
  const { user, isAdmin, isComercial, profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [openProg, setOpenProg] = useState(false);
  const [cohortes, setCohortes] = useState<CohorteRow[]>([]);
  const [loadingCohortes, setLoadingCohortes] = useState(false);
  const [manualProg, setManualProg] = useState(false);

  useEffect(() => {
    getFormConfig().then(setCfg);
    listProgramas().then(setProgramas).catch(() => setProgramas([]));
  }, []);

  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error } = await supabase.from("invoice_requests").select("*").eq("id", editId).maybeSingle();
      if (error || !data) return;
      setOriginalStatus(data.status);
      const d = data as Record<string, unknown>;
      const att = (d.attachments as AttachmentItem[] | null) ?? [];
      setAttachments(Array.isArray(att) ? att : []);
      const conceptoRaw = data.concepto ?? "Matrícula";
      const isFijo = (CONCEPTOS_FIJOS as readonly string[]).includes(conceptoRaw);
      setForm({
        nombre: data.nombre ?? "",
        identificacion: data.identificacion ?? "",
        email: data.email ?? "",
        tipo_financiacion: (d.tipo_persona as string) ?? "",
        tipo_programa: data.tipo_programa ?? "Diplomado",
        programa: data.programa ?? "",
        programa_nemonico: "",
        codigo_snies: data.codigo_snies ?? "",
        cohorte: data.cohorte ?? "",
        plan_estudio: data.plan_estudio ?? "",
        fecha_inicio: data.fecha_inicio ?? "",
        fecha_fin: data.fecha_fin ?? "",
        horas_programa: data.horas_programa ? String(data.horas_programa) : "",
        duracion: (data as { duracion?: string | null }).duracion ?? "",
        convocatoria: (data as { convocatoria?: string | null }).convocatoria ?? "",
        periodo: data.periodo ?? "",
        concepto_opcion: isFijo ? conceptoRaw : "Otro",
        concepto_otro: isFijo ? "" : conceptoRaw,
        valor: String(data.matricula ?? ""),
        descuento_pct: String(data.descuento_pct ?? 0),
        descuento_bono: String(data.descuento_bono ?? 0),
        fecha_limite_pago: data.fecha_limite_pago ?? "",
        observaciones: data.observaciones ?? "",
      });
    })();
  }, [editId, user]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pickPrograma = (p: Programa) => {
    const isEsp = (p.tipo_programa ?? "").toLowerCase().includes("especial");
    setForm((f) => ({
      ...f,
      programa: p.nombre,
      programa_nemonico: p.nemonico ?? "",
      codigo_snies: p.codigo_snies ?? f.codigo_snies,
      tipo_programa: tipos.find((t) => t.localeCompare(p.tipo_programa ?? "", undefined, { sensitivity: "base" }) === 0) ?? f.tipo_programa,
      cohorte: "",
      plan_estudio: p.nombre,
      fecha_inicio: "",
      fecha_fin: "",
      duracion: (p as any).duracion ?? (isEsp ? "3 cuatrimestres" : ""),
      convocatoria: "",
    }));
    setOpenProg(false);
    setManualProg(false);
    setCohortes([]);
    if (p.nemonico) {
      setLoadingCohortes(true);
      listCohortesByNemonico(p.nemonico)
        .then((rows) => setCohortes(rows))
        .catch(() => setCohortes([]))
        .finally(() => setLoadingCohortes(false));
    }
  };

  const pickCohorte = (c: CohorteRow) => {
    setForm((f) => ({
      ...f,
      cohorte: c.codigo,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_finalizacion ?? f.fecha_fin,
      convocatoria: c.convocatoria,
      periodo: deriveSemestre(c.fecha_inicio) || f.periodo,
    }));
  };

  const { valor, descuento, descuentoBono, valorTotal } = useMemo(() => {
    const v = Number(form.valor) || 0;
    const pct = Math.min(Math.max(Number(form.descuento_pct) || 0, 0), 100);
    const d = Math.round((v * pct) / 100);
    const bono = Math.max(Number(form.descuento_bono) || 0, 0);
    const total = Math.max(v - d - bono, 0);
    return { valor: v, descuento: d, descuentoBono: bono, valorTotal: total };
  }, [form.valor, form.descuento_pct, form.descuento_bono]);

  const fieldVisible = (key: string) => cfg?.fields?.[key]?.visible !== false;
  const fieldLabel = (key: string, fallback: string) => cfg?.fields?.[key]?.label ?? fallback;

  const conceptoFinal = form.concepto_opcion === "Otro"
    ? (form.concepto_otro.trim() || "Otro")
    : form.concepto_opcion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.concepto_opcion === "Otro" && !form.concepto_otro.trim()) {
      toast.error("Escribe el concepto personalizado.");
      return;
    }
    setBusy(true);
    try {
      const approveNow = isAdmin && autoApprove && !editId;
      const today = new Date();
      const baseLimite = form.fecha_limite_pago
        || new Date(today.getTime() + 4 * 86400000).toISOString().slice(0, 10);
      const extra = new Date(new Date(baseLimite).getTime() + 3 * 86400000).toISOString().slice(0, 10);

      const payload = {
        document_type: "orden_matricula",
        nombre: form.nombre,
        identificacion: form.identificacion,
        email: form.email || null,
        tipo_programa: form.tipo_programa,
        programa: form.programa || form.tipo_programa,
        codigo_snies: form.codigo_snies || null,
        cohorte: form.cohorte || null,
        plan_estudio: form.plan_estudio || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        horas_programa: form.horas_programa ? Number(form.horas_programa) : null,
        duracion: form.duracion || null,
        convocatoria: form.convocatoria || null,
        periodo: form.periodo,
        concepto: conceptoFinal,
        matricula: valor,
        descuento,
        descuento_pct: Number(form.descuento_pct) || 0,
        descuento_bono: descuentoBono,
        valor_total: valorTotal,
        recargo_total: Math.round(valorTotal * 1.1),
        fecha_limite_pago: baseLimite,
        observaciones: form.observaciones || null,
        tipo_persona: form.tipo_financiacion || null,
        attachments,
      };

      if (editId) {
        const next = { ...payload } as typeof payload & {
          status?: "pendiente";
          info_requested?: null;
          rejection_reason?: null;
        };
        if ((originalStatus === "requiere_info" || originalStatus === "rechazada") && !isAdmin) {
          next.status = "pendiente";
          next.info_requested = null;
          next.rejection_reason = null;
        }
        const { error } = await supabase.from("invoice_requests").update(next).eq("id", editId);
        if (error) throw error;
        toast.success("Solicitud actualizada");
        router.push(isAdmin ? "/admin" : "/mis-recibos");
      } else {
        const { error } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          comercial_email: profile?.email ?? user.email ?? null,
          fecha_pago_extraordinario: approveNow ? extra : null,
          status: approveNow ? "aprobada" : "pendiente",
          approved_by: approveNow ? user.id : null,
          approved_at: approveNow ? new Date().toISOString() : null,
          recibo_numero: approveNow ? Date.now() % 100000000 : null,
        });
        if (error) throw error;
        toast.success(approveNow ? "Recibo creado y aprobado" : "Solicitud enviada");
        router.push(approveNow ? "/admin" : isAdmin ? "/admin" : "/mis-recibos");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const tipos = cfg?.tipos_programa ?? ["Diplomado", "Especialización"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Datos del comercial">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <Input value={profile?.nombre_completo ?? ""} disabled />
          </Field>
          <Field label="Correo">
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </Field>
        </div>
      </Section>

      <Section title="Datos del estudiante">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo *">
            <Input required minLength={2} maxLength={200} value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
          </Field>
          <Field label="N° identificación *">
            <Input required minLength={4} maxLength={30} value={form.identificacion} onChange={(e) => update("identificacion", e.target.value)} />
          </Field>
          {fieldVisible("email_estudiante") && (
            <Field label={fieldLabel("email_estudiante", "Correo")}>
              <Input type="email" maxLength={200} value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
          )}
          <Field label="Motivo">
            <Select value={form.tipo_financiacion} onValueChange={(v) => update("tipo_financiacion", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona una opción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Retiro de las Cesantías">Retiro de las Cesantías</SelectItem>
                <SelectItem value="Empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Datos del programa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de programa *">
            <Select value={form.tipo_programa} onValueChange={(v) => setForm((f) => ({ ...f, tipo_programa: v, duracion: v.toLowerCase().includes("especial") ? "3 cuatrimestres" : f.duracion }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nombre del programa">
            <Popover open={openProg} onOpenChange={setOpenProg}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{form.programa || "Selecciona un programa…"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[540px] max-w-[calc(100vw-1rem)] p-0" align="start" sideOffset={4}>
                <Command>
                  <CommandInput placeholder="Buscar por nemónico o nombre…" />
                  <CommandList className="max-h-72 overflow-y-auto">
                    <CommandEmpty>
                      {programas.length === 0 ? "Aún no hay programas en el catálogo." : "Sin resultados."}
                    </CommandEmpty>
                    <CommandGroup>
                      {programas
                        .filter((p) => !form.tipo_programa || (p.tipo_programa ?? "").localeCompare(form.tipo_programa, undefined, { sensitivity: "base" }) === 0)
                        .map((p) => {
                          const snies = p.codigo_snies?.match(/\b(\d{5,7})\b/)?.[1] ?? null;
                          return (
                            <CommandItem
                              key={p.id}
                              value={`${p.nemonico ?? ""} ${p.nombre} ${p.codigo_snies ?? ""}`}
                              onSelect={() => pickPrograma(p)}
                              className="flex items-center gap-2 py-2"
                            >
                              <Check className={cn("h-3.5 w-3.5 shrink-0", form.programa === p.nombre ? "opacity-100" : "opacity-0")} />
                              {p.nemonico && (
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{p.nemonico}</span>
                              )}
                              <span className="flex-1 truncate text-sm">{p.nombre}</span>
                              {snies && <span className="shrink-0 text-xs text-muted-foreground">SNIES {snies}</span>}
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="border-t p-1">
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => { setManualProg(true); update("programa", ""); setOpenProg(false); setCohortes([]); }}
                  >
                    ✏ Otro / escribir manualmente
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            {manualProg && (
              <Input
                className="mt-2"
                autoFocus
                value={form.programa}
                onChange={(e) => update("programa", e.target.value)}
                placeholder="Escribe el nombre del programa"
              />
            )}
          </Field>
          {isAdmin && (
            <Field label="SNIES">
              <Input value={form.codigo_snies} onChange={(e) => update("codigo_snies", e.target.value)} placeholder="Ej: 108572" />
            </Field>
          )}
          <Field label="Cohorte">
            {cohortes.length > 0 ? (
              <Select value={form.cohorte} onValueChange={(v) => {
                const c = cohortes.find((x) => x.codigo === v);
                if (c) pickCohorte(c);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCohortes ? "Cargando…" : "Selecciona cohorte"} />
                </SelectTrigger>
                <SelectContent>
                  {cohortes.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.codigo} · inicio {c.fecha_inicio} · {c.convocatoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.cohorte}
                onChange={(e) => update("cohorte", e.target.value)}
                placeholder={loadingCohortes ? "Cargando cohortes…" : "Selecciona un programa o escribe manualmente"}
              />
            )}
          </Field>
          <Field label="Nombre del Diplomado">
            <Input value={form.plan_estudio} onChange={(e) => update("plan_estudio", e.target.value)} />
          </Field>
          <Field label="Fecha de inicio">
            <Input value={form.fecha_inicio} onChange={(e) => update("fecha_inicio", e.target.value)} placeholder="Ej: 24/11/2026" />
          </Field>
          <Field label="Convocatoria">
            <Input value={form.convocatoria} onChange={(e) => update("convocatoria", e.target.value)} placeholder="Ej: NOVIEMBRE 2025" />
          </Field>
          <Field label="Duración">
            <Input value={form.duracion} onChange={(e) => update("duracion", e.target.value)} placeholder="Ej: 17 semanas" />
          </Field>
          {fieldVisible("fecha_fin") && (
            <Field label={fieldLabel("fecha_fin", "Fecha de finalización")}>
              <Input value={form.fecha_fin} onChange={(e) => update("fecha_fin", e.target.value)} placeholder="Ej: Diciembre 2026" />
            </Field>
          )}
          <Field label="Periodo académico *">
            <Input required value={form.periodo} onChange={(e) => update("periodo", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Datos del recibo de pago">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Concepto *">
            <Select value={form.concepto_opcion} onValueChange={(v) => update("concepto_opcion", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONCEPTOS_FIJOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.concepto_opcion === "Otro" && (
              <Input
                className="mt-2"
                required
                maxLength={200}
                value={form.concepto_otro}
                onChange={(e) => update("concepto_otro", e.target.value)}
                placeholder="Escribe el concepto personalizado"
              />
            )}
          </Field>
          <Field label="Valor (COP) *">
            <Input required type="number" min={0} value={form.valor} onChange={(e) => update("valor", e.target.value)} />
          </Field>
          <Field label="Descuento (%)">
            <Input type="number" min={0} max={100} step="0.01" value={form.descuento_pct} onChange={(e) => update("descuento_pct", e.target.value)} />
          </Field>
          <Field label="Descuento Bono (COP)">
            <Input type="number" min={0} step="1" value={form.descuento_bono} onChange={(e) => update("descuento_bono", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Valor total">
            <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
              {formatCOP(valorTotal)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCOP(valor)} − {formatCOP(descuento)} (desc.) − {formatCOP(descuentoBono)} (bono)
            </p>
          </Field>
          <Field label="Fecha límite de pago *">
            <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Adjuntos">
        {user && (
          <AttachmentsField value={attachments} onChange={setAttachments} userId={user.id} disabled={busy} />
        )}
      </Section>

      {fieldVisible("observaciones") && (
        <Section title={fieldLabel("observaciones", "Observaciones")}>
          <Textarea rows={3} value={form.observaciones} onChange={(e) => update("observaciones", e.target.value)} placeholder="Notas opcionales para el administrador" />
        </Section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {isAdmin && !editId && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Aprobar y crear directamente
          </label>
        )}
        <Button type="submit" size="lg" disabled={busy || (!isComercial && !isAdmin)}>
          {busy ? "Guardando..." : editId ? "Guardar cambios" : isAdmin && autoApprove ? "Crear recibo aprobado" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
