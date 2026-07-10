import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AttachmentsField, HistoricalAttachmentsList, type AttachmentItem } from "./AttachmentsField";
import { listProgramas, type Programa } from "@/lib/programas";
import { listAsesores, type Asesor } from "@/lib/asesores";
import { listCohortesByNemonico, type CohorteRow } from "@/lib/sheets.functions";
import type { Json } from "@/integrations/supabase/types";

type TipoPersona = "" | "Persona Natural" | "Persona Jurídica";

const SECTION_TITLE_BY_ROLE: Record<string, string> = {
  super_admin: "Datos de Super Administrador",
  admin: "Datos de Administrador",
  financiera: "Datos de Financiera",
  cartera: "Datos de Cartera",
  comercial: "Datos del Líder Comercial",
};

interface Participant {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
}

const EMPTY_PARTICIPANT: Participant = { nombre: "", cedula: "", email: "", telefono: "" };

interface PpForm {
  tipo_persona: TipoPersona;
  asesor_nombre: string;
  // Persona Natural
  nombre: string;
  cedula: string;
  email_natural: string;
  telefono_natural: string;
  // Persona Jurídica
  empresa: string;
  nit: string;
  email_empresa: string;
  pais: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  numero_participantes: string;
  lista_cerrada: boolean;
  valor_por_estudiante: string;
  descuento_pct: string;
  // Shared
  programa: string;
  nemonico: string;
  cohorte: string;
  numero_inscripcion: string;
  fecha_inicio: string;
  valor: string;
  fecha_limite_pago: string;
}

const EMPTY: PpForm = {
  tipo_persona: "Persona Natural",
  asesor_nombre: "",
  nombre: "", cedula: "", email_natural: "", telefono_natural: "",
  empresa: "", nit: "", email_empresa: "", pais: "", direccion: "", ciudad: "", telefono: "",
  numero_participantes: "",
  lista_cerrada: true, valor_por_estudiante: "", descuento_pct: "0",
  programa: "", nemonico: "", cohorte: "", numero_inscripcion: "", fecha_inicio: "",
  valor: "", fecha_limite_pago: "",
};

export function FacturaPaypalForm({ editId, duplicateFromId }: { editId?: string; duplicateFromId?: string }) {
  const { user, role, canApprove, canViewAllRequests, isComercial, profile, loading: authLoading } = useAuth();
  const isAdmin = canApprove;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PpForm>(EMPTY);
  const [participants, setParticipants] = useState<Participant[]>([]);
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
    listProgramas().then(setProgramas).catch(() => setProgramas([]));
    listAsesores().then(setAsesores).catch(() => setAsesores([]));
  }, []);

  const asesorOptions = asesores;

  const loadFormData = async (sourceId: string, isEdit: boolean) => {
    const { data, error } = await supabase.from("invoice_requests").select("*").eq("id", sourceId).maybeSingle();
    if (error || !data) return;
    const d = data as Record<string, unknown>;
    if (isEdit) { setOriginalStatus(data.status); setOriginalReciboNumero(data.recibo_numero ?? null); setOriginalApprovedAt(data.approved_at ?? null); }
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
    const parts = (d.participantes as Participant[] | null) ?? [];
    setParticipants(Array.isArray(parts) ? parts : []);
    const tipoPersona = (d.tipo_persona as TipoPersona) || "Persona Natural";
    const isNatural = tipoPersona === "Persona Natural";
    setForm({
      tipo_persona: tipoPersona,
      asesor_nombre: (d.asesor_nombre as string) ?? "",
      nombre: isNatural ? (data.nombre ?? "") : "",
      cedula: isNatural ? (data.identificacion ?? "") : "",
      email_natural: isNatural ? (data.email ?? "") : "",
      telefono_natural: isNatural ? ((d.telefono as string) ?? "") : "",
      empresa: !isNatural ? (data.nombre ?? "") : "",
      nit: !isNatural ? (data.identificacion ?? "") : "",
      email_empresa: !isNatural ? (data.email ?? "") : "",
      pais: (d.pais as string) ?? "",
      direccion: (d.direccion as string) ?? "",
      ciudad: (d.ciudad as string) ?? "",
      telefono: !isNatural ? ((d.telefono as string) ?? "") : "",
      numero_participantes: d.numero_participantes != null ? String(d.numero_participantes) : "",
      lista_cerrada: (d.lista_cerrada as boolean | null) ?? true,
      valor_por_estudiante: d.valor_por_estudiante != null ? String(d.valor_por_estudiante) : "",
      descuento_pct: String(d.descuento_pct ?? 0),
      programa: data.programa ?? "",
      nemonico: (d.nemonico as string) ?? "",
      cohorte: data.cohorte ?? "",
      numero_inscripcion: (d.numero_inscripcion as string) ?? "",
      fecha_inicio: data.fecha_inicio ?? "",
      valor: String(data.valor_total ?? ""),
      fecha_limite_pago: data.fecha_limite_pago ?? "",
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

  // Sync participants array length with numero_participantes
  useEffect(() => {
    if (form.tipo_persona !== "Persona Jurídica") return;
    const n = Math.max(0, Math.min(100, Number(form.numero_participantes) || 0));
    setParticipants((prev) => {
      if (prev.length === n) return prev;
      if (prev.length < n) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => ({ ...EMPTY_PARTICIPANT }))];
      }
      return prev.slice(0, n);
    });
  }, [form.numero_participantes, form.tipo_persona]);

  const update = <K extends keyof PpForm>(k: K, v: PpForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const updateParticipant = (idx: number, key: keyof Participant, value: string) =>
    setParticipants((prev) => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));

  const pickPrograma = (p: Programa) => {
    setForm((f) => ({ ...f, programa: p.nombre, nemonico: p.nemonico ?? "", cohorte: "", fecha_inicio: "" }));
    setOpenProg(false);
    setManualProg(false);
    setCohortes([]);
    if (p.nemonico) {
      setLoadingCohortes(true);
      listCohortesByNemonico(p.nemonico)
        .then(setCohortes).catch(() => setCohortes([]))
        .finally(() => setLoadingCohortes(false));
    }
  };

  const pickCohorte = (c: CohorteRow) => {
    setForm((f) => ({ ...f, cohorte: c.codigo, fecha_inicio: c.fecha_inicio }));
  };

  const valorNum = Number(form.valor) || 0;

  // Persona Jurídica + lista abierta: cobro por participante (valor por
  // estudiante menos descuento, multiplicado por el número de participantes).
  const numParticipantes = Math.max(0, Number(form.numero_participantes) || 0);
  const isJuridicaAbierta = form.tipo_persona === "Persona Jurídica" && !form.lista_cerrada;
  const { valorPorEstudianteNum, valorTotalPorEstudiante, valorTotalEmpresa } = useMemo(() => {
    const vpe = Number(form.valor_por_estudiante) || 0;
    const pct = Math.min(Math.max(Number(form.descuento_pct) || 0, 0), 100);
    const totalPorEstudiante = Math.max(vpe - Math.round((vpe * pct) / 100), 0);
    return {
      valorPorEstudianteNum: vpe,
      valorTotalPorEstudiante: totalPorEstudiante,
      valorTotalEmpresa: totalPorEstudiante * numParticipantes,
    };
  }, [form.valor_por_estudiante, form.descuento_pct, numParticipantes]);
  // Lista cerrada: valor por estudiante es solo informativo (valor total ÷ participantes).
  const valorPorEstudianteInformativo = form.tipo_persona === "Persona Jurídica" && form.lista_cerrada && numParticipantes > 0
    ? Math.round(valorNum / numParticipantes)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.tipo_persona) { toast.error("Selecciona el tipo de persona."); return; }
    if (role === "comercial" && !form.asesor_nombre) { toast.error("Selecciona el asesor comercial correspondiente."); return; }
    if (role === "cartera" && !form.numero_inscripcion.trim()) { toast.error("El número de inscripción es obligatorio."); return; }
    setBusy(true);
    try {
      const periodo = `${new Date().getFullYear()}`;
      const isNatural = form.tipo_persona === "Persona Natural";
      const isJuridica = form.tipo_persona === "Persona Jurídica";
      const isAbierta = isJuridica && !form.lista_cerrada;

      const payload = {
        document_type: "factura_paypal",
        tipo_persona: form.tipo_persona,
        asesor_nombre: form.asesor_nombre || null,
        nombre: isNatural ? form.nombre : form.empresa,
        identificacion: isNatural ? form.cedula : (form.nit || form.empresa.slice(0, 20)),
        email: isNatural ? (form.email_natural || null) : (form.email_empresa || null),
        telefono: isNatural ? (form.telefono_natural || null) : (form.telefono || null),
        empresa: isNatural ? null : (form.empresa || null),
        nit: isNatural ? null : (form.nit || null),
        pais: isNatural ? null : (form.pais || null),
        direccion: isNatural ? null : (form.direccion || null),
        ciudad: isNatural ? null : (form.ciudad || null),
        numero_participantes: isJuridica && form.numero_participantes ? Number(form.numero_participantes) : null,
        participantes: (isAbierta ? participants : []) as unknown as Json,
        lista_cerrada: isJuridica ? form.lista_cerrada : true,
        tipo_programa: "Factura PayPal",
        programa: form.programa || form.nemonico,
        nemonico: form.nemonico || null,
        numero_inscripcion: form.numero_inscripcion || null,
        codigo_snies: null,
        cohorte: form.cohorte || null,
        plan_estudio: form.programa || form.nemonico,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: null, horas_programa: null, duracion: null, convocatoria: null,
        periodo,
        concepto: "Factura PayPal",
        matricula: isAbierta ? valorPorEstudianteNum : valorNum,
        descuento: isAbierta ? (valorPorEstudianteNum - valorTotalPorEstudiante) : 0,
        descuento_pct: isAbierta ? (Number(form.descuento_pct) || 0) : 0,
        descuento_bono: isAbierta ? (valorPorEstudianteNum - valorTotalPorEstudiante) : 0,
        valor_total: isAbierta ? valorTotalPorEstudiante : valorNum,
        valor_total_empresa: isJuridica ? (isAbierta ? valorTotalEmpresa : valorNum) : null,
        valor_por_estudiante: isJuridica ? (isAbierta ? valorTotalPorEstudiante : (valorPorEstudianteInformativo || null)) : null,
        recargo_total: isAbierta ? valorTotalEmpresa : valorNum,
        fecha_limite_pago: form.fecha_limite_pago,
        observaciones: null,
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
      } else if (editId) {
        const { error } = await supabase.from("invoice_requests").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Solicitud actualizada");
      } else {
        const { error } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          created_by_role: role,
          comercial_email: profile?.email ?? user.email ?? null,
          status: "pendiente",
        });
        if (error) throw error;
        toast.success("Solicitud enviada");
      }
      router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const isJuridica = form.tipo_persona === "Persona Jurídica";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── COMERCIAL ── */}
      <Section title={authLoading ? "" : (SECTION_TITLE_BY_ROLE[role ?? ""] ?? "Datos del Líder Comercial")}>
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
        <Field label={role === "comercial" ? "Asesor Comercial *" : "Asesor Comercial"}>
          <Select
            value={form.asesor_nombre || "__none__"}
            onValueChange={(v) => update("asesor_nombre", v === "__none__" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona el asesor" /></SelectTrigger>
            <SelectContent>
              {role !== "comercial" && <SelectItem value="__none__">Sin asignar</SelectItem>}
              {asesorOptions.map((a) => (
                <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* ── TIPO DE PERSONA ── */}
      {/* Restricción temporal: Factura PayPal solo admite Persona Natural por ahora.
          Quitar el "disabled" reactiva Persona Jurídica cuando se habilite. */}
      <Section title="Tipo de persona">
        <Field label="Selecciona el Tipo de Persona *">
          <Select value={form.tipo_persona} onValueChange={(v) => update("tipo_persona", v as TipoPersona)} disabled>
            <SelectTrigger><SelectValue placeholder="Selecciona una opción…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Persona Natural">Persona Natural</SelectItem>
              <SelectItem value="Persona Jurídica">Persona Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* ── PERSONA NATURAL ── */}
      {form.tipo_persona === "Persona Natural" && (
        <Section title="Datos del estudiante">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre Completo *">
              <Input required maxLength={300} value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
            </Field>
            <Field label="Número de Identificación">
              <Input maxLength={50} type="text" inputMode="numeric" value={form.cedula} onChange={(e) => update("cedula", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label={role === "cartera" ? "N° de Inscripción *" : "N° de Inscripción"}>
              <Input required={role === "cartera"} maxLength={100} value={form.numero_inscripcion} onChange={(e) => update("numero_inscripcion", e.target.value)} />
            </Field>
            <Field label="Correo Electrónico">
              <Input type="email" maxLength={200} value={form.email_natural} onChange={(e) => update("email_natural", e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input maxLength={50} type="text" inputMode="numeric" value={form.telefono_natural} onChange={(e) => update("telefono_natural", e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
        </Section>
      )}

      {/* ── PERSONA JURÍDICA ── */}
      {isJuridica && (
        <>
          <Section title="Datos de la empresa">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre de la Empresa *">
                <Input required maxLength={200} value={form.empresa} onChange={(e) => update("empresa", e.target.value)} />
              </Field>
              <Field label="Número de Identificación">
                <Input maxLength={50} value={form.nit} onChange={(e) => update("nit", e.target.value.replace(/[^\d-]/g, ""))} />
              </Field>
              <Field label="Correo Electrónico">
                <Input type="email" maxLength={200} value={form.email_empresa} onChange={(e) => update("email_empresa", e.target.value)} />
              </Field>
              <Field label="País *">
                <Input required maxLength={100} value={form.pais} onChange={(e) => update("pais", e.target.value)} />
              </Field>
              <Field label="Dirección *">
                <Input required maxLength={300} value={form.direccion} onChange={(e) => update("direccion", e.target.value)} />
              </Field>
              <Field label="Ciudad *">
                <Input required maxLength={150} value={form.ciudad} onChange={(e) => update("ciudad", e.target.value)} />
              </Field>
              <Field label="Teléfono *">
                <Input required maxLength={50} type="text" inputMode="numeric" value={form.telefono} onChange={(e) => update("telefono", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="N° de Participantes *">
                <Input
                  required
                  type="number"
                  min={1}
                  max={100}
                  value={form.numero_participantes}
                  onChange={(e) => update("numero_participantes", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.lista_cerrada}
                    onChange={(e) => update("lista_cerrada", e.target.checked)}
                  />
                  Lista Cerrada
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.lista_cerrada
                    ? "Solo se registra el número de participantes, sin sus datos individuales."
                    : "Se piden los datos de cada participante y se cobra por estudiante."}
                </p>
              </div>
            </div>
          </Section>

          {/* ── PARTICIPANTES DINÁMICOS ── */}
          {!form.lista_cerrada && participants.map((p, i) => (
            <Section key={i} title={`Participante ${i + 1}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre Completo *">
                  <Input required maxLength={300} value={p.nombre} onChange={(e) => updateParticipant(i, "nombre", e.target.value)} />
                </Field>
                <Field label="Número de Identificación *">
                  <Input required maxLength={50} type="text" inputMode="numeric" value={p.cedula} onChange={(e) => updateParticipant(i, "cedula", e.target.value.replace(/\D/g, ""))} />
                </Field>
              </div>
            </Section>
          ))}
        </>
      )}

      {/* ── SECCIONES COMPARTIDAS ── */}
      {form.tipo_persona && (
        <>
          {/* Programa */}
          <Section title="Datos del programa">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Programa *">
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
                        <CommandEmpty>{programas.length === 0 ? "Aún no hay programas." : "Sin resultados."}</CommandEmpty>
                        <CommandGroup>
                          {programas.map((prog) => {
                            const snies = prog.codigo_snies?.match(/\b(\d{5,7})\b/)?.[1] ?? null;
                            return (
                              <CommandItem key={prog.id} value={`${prog.nemonico ?? ""} ${prog.nombre}`} onSelect={() => pickPrograma(prog)} className="flex items-center gap-2 py-2">
                                <Check className={cn("h-3.5 w-3.5 shrink-0", form.programa === prog.nombre ? "opacity-100" : "opacity-0")} />
                                {prog.nemonico && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{prog.nemonico}</span>}
                                <span className="flex-1 truncate text-sm">{prog.nombre}</span>
                                {snies && <span className="shrink-0 text-xs text-muted-foreground">SNIES {snies}</span>}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div className="border-t p-1">
                      <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => { setManualProg(true); update("programa", ""); setOpenProg(false); setCohortes([]); }}>
                        ✏ Otro / escribir manualmente
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
                {manualProg && (
                  <Input className="mt-2" autoFocus value={form.programa} onChange={(e) => update("programa", e.target.value)} placeholder="Escribe el nombre del programa" />
                )}
              </Field>
              <Field label="Cohorte">
                {cohortes.length > 0 ? (
                  <Select value={form.cohorte} onValueChange={(v) => { const c = cohortes.find((x) => x.codigo === v); if (c) pickCohorte(c); }}>
                    <SelectTrigger><SelectValue placeholder={loadingCohortes ? "Cargando…" : "Selecciona cohorte"} /></SelectTrigger>
                    <SelectContent>
                      {cohortes.map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} · inicio {c.fecha_inicio} · {c.convocatoria}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.cohorte} onChange={(e) => update("cohorte", e.target.value)} placeholder={loadingCohortes ? "Cargando cohortes…" : "Selecciona un programa o escribe manualmente"} />
                )}
              </Field>
              <Field label="Fecha de Inicio">
                <Input value={form.fecha_inicio} onChange={(e) => update("fecha_inicio", e.target.value)} placeholder="Ej: 24/11/2026" />
              </Field>
            </div>
          </Section>

          {/* Factura */}
          <Section title="Datos de la factura">
            <div className="grid gap-4 sm:grid-cols-2">
              {isJuridicaAbierta ? (
                <>
                  <Field label="Valor por Estudiante *">
                    <Input required type="number" min={0} value={form.valor_por_estudiante} onChange={(e) => update("valor_por_estudiante", e.target.value)} />
                  </Field>
                  <Field label="Descuento (%)">
                    <Input type="number" min={0} max={100} step="0.01" value={form.descuento_pct} onChange={(e) => update("descuento_pct", e.target.value)} />
                  </Field>
                  <Field label="Valor Total por Estudiante">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                      ${valorTotalPorEstudiante.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                    </div>
                  </Field>
                  <Field label="Valor Total a Pagar por la Empresa">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                      ${valorTotalEmpresa.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ${valorTotalPorEstudiante.toLocaleString("es-CO")} × {numParticipantes} participante(s)
                    </p>
                  </Field>
                  <Field label="Fecha Límite de Pago *">
                    <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Valor *">
                    <Input required type="number" min={0} value={form.valor} onChange={(e) => update("valor", e.target.value)} />
                  </Field>

                  <Field label="Valor Total a Pagar">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                      ${valorNum.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                    </div>
                  </Field>

                  {isJuridica && numParticipantes > 0 && (
                    <Field label="Valor por Estudiante">
                      <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                        ${valorPorEstudianteInformativo.toLocaleString("es-CO")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Informativo: valor total ÷ {numParticipantes} participante(s).</p>
                    </Field>
                  )}

                  <Field label="Fecha Límite de Pago *">
                    <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          </Section>

          {/* Adjuntos */}
          <Section title="Adjuntos">
            <div className="space-y-4">
              {isAdmin && <HistoricalAttachmentsList items={historicalAttachments} />}
              {user && (
                <AttachmentsField value={attachments} onChange={setAttachments} userId={user.id} disabled={busy} />
              )}
            </div>
          </Section>
        </>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy || (!isComercial && !isAdmin) || !form.tipo_persona}>
          {busy ? "Guardando..." : editId ? "Guardar cambios" : duplicateFromId ? "Duplicar" : "Enviar solicitud"}
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
