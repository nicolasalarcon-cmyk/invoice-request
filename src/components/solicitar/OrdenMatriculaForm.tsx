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
import { listAsesores, type Asesor } from "@/lib/asesores";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCohortesByNemonico, type CohorteRow } from "@/lib/sheets.functions";
import { AttachmentsField, HistoricalAttachmentsList, type AttachmentItem } from "./AttachmentsField";

const CONCEPTOS_FIJOS = ["Matrícula", "Matrícula Parcial", "Otro"] as const;

interface FormState {
  nombre: string;
  identificacion: string;
  email: string;
  asesor_nombre: string;
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
  valor_parcial: string;
  valor: string;
  descuento_pct: string;
  descuento_bono: string;
  fecha_limite_pago: string;
  observaciones: string;
}

const EMPTY: FormState = {
  nombre: "", identificacion: "", email: "", asesor_nombre: "", tipo_financiacion: "",
  tipo_programa: "Diplomado", programa: "", programa_nemonico: "",
  codigo_snies: "", cohorte: "", plan_estudio: "",
  fecha_inicio: "", fecha_fin: "", horas_programa: "",
  duracion: "", convocatoria: "",
  periodo: "1er Semestre 2026",
  concepto_opcion: "Matrícula", concepto_otro: "",
  valor_parcial: "",
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

export function OrdenMatriculaForm({ editId, duplicateFromId }: { editId?: string; duplicateFromId?: string }) {
  const { user, role, canApprove, canViewAllRequests, isComercial, profile } = useAuth();
  const isAdmin = canApprove;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [historicalAttachments, setHistoricalAttachments] = useState<AttachmentItem[]>([]);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [originalReciboNumero, setOriginalReciboNumero] = useState<string | null>(null);
  const [originalApprovedAt, setOriginalApprovedAt] = useState<string | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [openProg, setOpenProg] = useState(false);
  const [cohortes, setCohortes] = useState<CohorteRow[]>([]);
  const [loadingCohortes, setLoadingCohortes] = useState(false);
  const [manualProg, setManualProg] = useState(false);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  useEffect(() => {
    getFormConfig().then(setCfg);
    listProgramas().then(setProgramas).catch(() => setProgramas([]));
    listAsesores().then(setAsesores).catch(() => setAsesores([]));
  }, []);

  const asesorOptions = asesores;

  const loadFormData = async (sourceId: string, isEdit: boolean) => {
    const { data, error } = await supabase.from("invoice_requests").select("*").eq("id", sourceId).maybeSingle();
    if (error || !data) return;
    if (isEdit) { setOriginalStatus(data.status); setOriginalReciboNumero(data.recibo_numero ?? null); setOriginalApprovedAt(data.approved_at ?? null); }
    const d = data as Record<string, unknown>;
    const att = (d.attachments as AttachmentItem[] | null) ?? [];
    const attArr = Array.isArray(att) ? att : [];
    if (isEdit && data.status === "rechazada") {
      // Los adjuntos de una solicitud rechazada quedan como historial/soporte:
      // no se cargan como editables, para que no se puedan borrar al corregir.
      setHistoricalAttachments(attArr);
      setAttachments([]);
    } else {
      setAttachments(attArr);
      setHistoricalAttachments([]);
    }
    const conceptoRaw = data.concepto ?? "Matrícula";
    const isFijo = (CONCEPTOS_FIJOS as readonly string[]).includes(conceptoRaw);
    setForm({
      nombre: data.nombre ?? "",
      identificacion: data.identificacion ?? "",
      email: data.email ?? "",
      asesor_nombre: (d.asesor_nombre as string) ?? "",
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
      valor_parcial: d.valor_parcial != null ? String(d.valor_parcial) : "",
      valor: String(data.matricula ?? ""),
      descuento_pct: String(data.descuento_pct ?? 0),
      descuento_bono: String(data.descuento_bono ?? 0),
      fecha_limite_pago: data.fecha_limite_pago ?? "",
      observaciones: data.observaciones ?? "",
    });
  };

  useEffect(() => {
    if (!editId || !user) return;
    loadFormData(editId, true);
  }, [editId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!duplicateFromId || !user) return;
    loadFormData(duplicateFromId, false);
  }, [duplicateFromId, user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isMatriculaParcial = form.concepto_opcion === "Matrícula Parcial";
  const isPartialActive = isMatriculaParcial && Number(form.valor_parcial) > 0;

  const { valor, descuento, descuentoBono, valorTotal } = useMemo(() => {
    const v = Number(form.valor) || 0;
    if (isPartialActive) {
      return { valor: v, descuento: 0, descuentoBono: 0, valorTotal: Number(form.valor_parcial) || 0 };
    }
    const pct = Math.min(Math.max(Number(form.descuento_pct) || 0, 0), 100);
    const d = Math.round((v * pct) / 100);
    const bono = Math.max(Number(form.descuento_bono) || 0, 0);
    const total = Math.max(v - d - bono, 0);
    return { valor: v, descuento: d, descuentoBono: bono, valorTotal: total };
  }, [form.valor, form.descuento_pct, form.descuento_bono, isPartialActive, form.valor_parcial]);

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
    if (!form.asesor_nombre) {
      toast.error("Selecciona el asesor comercial correspondiente.");
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
        asesor_nombre: form.asesor_nombre || null,
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
        descuento_pct: isMatriculaParcial ? 0 : (Number(form.descuento_pct) || 0),
        descuento_bono: descuentoBono,
        valor_total: valorTotal,
        recargo_total: Math.round(valorTotal * 1.1),
        valor_parcial: isPartialActive ? Number(form.valor_parcial) : null,
        fecha_limite_pago: baseLimite,
        fecha_pago_extraordinario: extra,
        observaciones: form.observaciones || null,
        tipo_persona: form.tipo_financiacion || null,
        attachments,
      };

      if (editId && (originalStatus === "rechazada" || originalStatus === "aprobada" || originalStatus === "corregida") && !isAdmin) {
        // Corregir y reenviar: se crea una solicitud nueva enlazada a la original.
        // Si la original ya estaba aprobada/corregida, se envía a Financiera para el ajuste,
        // conservando el mismo consecutivo; la original queda "rechazada" (con
        // motivo de corrección) y sin consecutivo, para no duplicarlo en Numeración.
        const isFixingApproved = originalStatus === "aprobada" || originalStatus === "corregida";
        if (isFixingApproved) {
          const approvedTs = originalApprovedAt ? new Date(originalApprovedAt).getTime() : 0;
          if (!approvedTs || Date.now() - approvedTs > 3 * 24 * 60 * 60 * 1000) {
            toast.error("Ya pasaron más de 3 días desde la aprobación — no se puede corregir esta solicitud.");
            return;
          }
        }
        if (isFixingApproved) {
          const { error: archErr } = await supabase
            .from("invoice_requests")
            .update({
              archived_by_comercial: true,
              status: "rechazada",
              rejection_reason: "Corrección solicitada tras aprobación — el comercial detectó un error y la reenvió para ajuste.",
              recibo_numero: null,
            })
            .eq("id", editId);
          if (archErr) throw archErr;
        }
        const { error: insErr } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          created_by_role: role,
          comercial_email: profile?.email ?? user.email ?? null,
          status: "pendiente",
          parent_id: editId,
          ...(isFixingApproved ? { recibo_numero: originalReciboNumero } : {}),
        });
        if (insErr) throw insErr;
        if (!isFixingApproved) {
          const { error: archErr } = await supabase
            .from("invoice_requests")
            .update({ archived_by_comercial: true })
            .eq("id", editId);
          if (archErr) throw archErr;
        }
        toast.success(isFixingApproved ? "Solicitud enviada a corrección" : "Solicitud corregida y reenviada");
        router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
      } else if (editId) {
        const { error } = await supabase.from("invoice_requests").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Solicitud actualizada");
        router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
      } else {
        const { error } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          created_by_role: role,
          comercial_email: profile?.email ?? user.email ?? null,
          fecha_pago_extraordinario: extra,
          status: approveNow ? "aprobada" : "pendiente",
          approved_by: approveNow ? user.id : null,
          approved_at: approveNow ? new Date().toISOString() : null,
          recibo_numero: approveNow ? String(Date.now() % 100000000) : null,
        });
        if (error) throw error;
        toast.success(approveNow ? "Recibo creado y aprobado" : "Solicitud enviada");
        router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
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
      <Section title={role === "cartera" ? "Datos de Cartera" : "Datos del Líder Comercial"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre Completo">
            <Input value={profile?.nombre_completo ?? ""} disabled />
          </Field>
          <Field label="Correo">
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </Field>
        </div>
      </Section>

      <Section title="Asignar Asesor">
        <Field label="Asesor Comercial *">
          <Select value={form.asesor_nombre} onValueChange={(v) => update("asesor_nombre", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona el asesor" /></SelectTrigger>
            <SelectContent>
              {asesorOptions.map((a) => (
                <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Datos del estudiante">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre Completo *">
            <Input required minLength={2} maxLength={200} value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
          </Field>
          <Field label="Número de Identificación *">
            <Input required minLength={4} maxLength={30} type="text" inputMode="numeric" value={form.identificacion} onChange={(e) => update("identificacion", e.target.value.replace(/\D/g, ""))} />
          </Field>
          {fieldVisible("email_estudiante") && (
            <Field label={fieldLabel("email_estudiante", "Correo Electrónico")}>
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
          <Field label="Tipo de Programa *">
            <Select value={form.tipo_programa} onValueChange={(v) => setForm((f) => ({ ...f, tipo_programa: v, duracion: v.toLowerCase().includes("especial") ? "3 cuatrimestres" : f.duracion }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nombre del Programa">
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
          <Field label="Fecha de Inicio">
            <Input value={form.fecha_inicio} onChange={(e) => update("fecha_inicio", e.target.value)} placeholder="Ej: 24/11/2026" />
          </Field>
          <Field label="Convocatoria">
            <Input value={form.convocatoria} onChange={(e) => update("convocatoria", e.target.value)} placeholder="Ej: NOVIEMBRE 2025" />
          </Field>
          <Field label="Duración">
            <Input value={form.duracion} onChange={(e) => update("duracion", e.target.value)} placeholder="Ej: 17 semanas" />
          </Field>
          {fieldVisible("fecha_fin") && (
            <Field label={fieldLabel("fecha_fin", "Fecha de Finalización")}>
              <Input value={form.fecha_fin} onChange={(e) => update("fecha_fin", e.target.value)} placeholder="Ej: Diciembre 2026" />
            </Field>
          )}
          <Field label="Periodo Académico *">
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
          {isMatriculaParcial ? (
            <Field label="Valor Parcial a Facturar (COP) *">
              <Input
                required
                type="number"
                min={0}
                value={form.valor_parcial}
                onChange={(e) => update("valor_parcial", e.target.value)}
                placeholder="Monto acordado a facturar"
              />
            </Field>
          ) : (
            <>
              <Field label="Descuento (%)">
                <Input type="number" min={0} max={100} step="0.01" value={form.descuento_pct} onChange={(e) => update("descuento_pct", e.target.value)} />
              </Field>
              <Field label="Descuento Bono (COP)">
                <Input type="number" min={0} step="1" value={form.descuento_bono} onChange={(e) => update("descuento_bono", e.target.value)} placeholder="0" />
              </Field>
            </>
          )}
          <Field label="Valor Total">
            <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
              {formatCOP(valorTotal)}
            </div>
            {isMatriculaParcial ? (
              <p className="mt-1 text-xs text-muted-foreground">Valor parcial acordado — no aplica descuento.</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCOP(valor)} − {formatCOP(descuento)} (desc.) − {formatCOP(descuentoBono)} (bono)
              </p>
            )}
          </Field>
          <Field label="Fecha Límite de Pago *">
            <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Adjuntos">
        <div className="space-y-4">
          {isAdmin && <HistoricalAttachmentsList items={historicalAttachments} />}
          {user && (
            <AttachmentsField value={attachments} onChange={setAttachments} userId={user.id} disabled={busy} />
          )}
        </div>
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
          {busy ? "Guardando..." : editId ? "Guardar cambios" : duplicateFromId ? "Duplicar" : isAdmin && autoApprove ? "Crear recibo aprobado" : "Enviar solicitud"}
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
