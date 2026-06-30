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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCOP } from "@/lib/format";
import { listProgramas, type Programa } from "@/lib/programas";
import { listCohortesByNemonico, type CohorteRow } from "@/lib/sheets.functions";
import { AttachmentsField, type AttachmentItem } from "./AttachmentsField";
import type { Json } from "@/integrations/supabase/types";

type TipoPersona = "" | "Persona Natural" | "Persona Jurídica";

interface Participant {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
}

const EMPTY_PARTICIPANT: Participant = { nombre: "", cedula: "", email: "", telefono: "" };

interface UsaForm {
  tipo_persona: TipoPersona;
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
  // Shared
  programa: string;
  nemonico: string;
  cohorte: string;
  fecha_inicio: string;
  valor: string;
  descuento_pct: string;
  fecha_limite_pago: string;
  observaciones: string;
}

const EMPTY: UsaForm = {
  tipo_persona: "",
  nombre: "", cedula: "", email_natural: "", telefono_natural: "",
  empresa: "", nit: "", email_empresa: "", pais: "", direccion: "",
  ciudad: "", telefono: "", numero_participantes: "",
  programa: "", nemonico: "", cohorte: "", fecha_inicio: "",
  valor: "", descuento_pct: "0", fecha_limite_pago: "", observaciones: "",
};

export function FacturaUsaForm({ editId, duplicateFromId }: { editId?: string; duplicateFromId?: string }) {
  const { user, canApprove, canViewAllRequests, isComercial, profile } = useAuth();
  const isAdmin = canApprove;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<UsaForm>(EMPTY);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [openProg, setOpenProg] = useState(false);
  const [cohortes, setCohortes] = useState<CohorteRow[]>([]);
  const [loadingCohortes, setLoadingCohortes] = useState(false);
  const [manualProg, setManualProg] = useState(false);

  useEffect(() => {
    listProgramas().then(setProgramas).catch(() => setProgramas([]));
  }, []);

  const loadFormData = async (sourceId: string, isEdit: boolean) => {
    const { data, error } = await supabase.from("invoice_requests").select("*").eq("id", sourceId).maybeSingle();
    if (error || !data) return;
    const d = data as Record<string, unknown>;
    if (isEdit) setOriginalStatus(data.status);
    const att = (d.attachments as AttachmentItem[] | null) ?? [];
    setAttachments(Array.isArray(att) ? att : []);
    const parts = (d.participantes as Participant[] | null) ?? [];
    setParticipants(Array.isArray(parts) ? parts : []);
    const tipoPersona = (d.tipo_persona as TipoPersona) || "Persona Jurídica";
    const isNatural = tipoPersona === "Persona Natural";
    setForm({
      tipo_persona: tipoPersona,
      nombre: isNatural ? (data.nombre ?? "") : "",
      cedula: isNatural ? (data.identificacion ?? "") : "",
      email_natural: isNatural ? (data.email ?? "") : "",
      telefono_natural: isNatural ? ((d.telefono as string) ?? "") : "",
      empresa: (d.empresa as string) ?? "",
      nit: (d.nit as string) ?? "",
      email_empresa: !isNatural ? (data.email ?? "") : "",
      pais: (d.pais as string) ?? "",
      direccion: (d.direccion as string) ?? "",
      ciudad: (d.ciudad as string) ?? "",
      telefono: !isNatural ? ((d.telefono as string) ?? "") : "",
      numero_participantes: d.numero_participantes != null ? String(d.numero_participantes) : "",
      programa: data.programa ?? "",
      nemonico: (d.nemonico as string) ?? "",
      cohorte: data.cohorte ?? "",
      fecha_inicio: data.fecha_inicio ?? "",
      valor: String(data.matricula ?? ""),
      descuento_pct: String(data.descuento_pct ?? 0),
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

  // Sync participants array length when numero_participantes changes
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

  const update = <K extends keyof UsaForm>(k: K, v: UsaForm[K]) =>
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

  const { valorNum, descuentoPct, descuentoFlat, computedTotal, computedTotalEmpresa } = useMemo(() => {
    const v = Number(form.valor) || 0;
    const pct = Math.min(Math.max(Number(form.descuento_pct) || 0, 0), 100);
    const flat = Math.round(v * pct / 100);
    const total = Math.max(v - flat, 0);
    const n = Math.max(Number(form.numero_participantes) || 1, 1);
    return { valorNum: v, descuentoPct: pct, descuentoFlat: flat, computedTotal: total, computedTotalEmpresa: total * n };
  }, [form.valor, form.descuento_pct, form.numero_participantes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.tipo_persona) { toast.error("Selecciona el tipo de persona."); return; }
    setBusy(true);
    try {
      const today = new Date();
      const baseLimite = form.fecha_limite_pago || new Date(today.getTime() + 4 * 86400000).toISOString().slice(0, 10);
      const periodo = `${today.getFullYear()}`;
      const isNatural = form.tipo_persona === "Persona Natural";
      const isJuridica = form.tipo_persona === "Persona Jurídica";

      const payload = {
        document_type: "factura_usa",
        tipo_persona: form.tipo_persona,
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
        participantes: (isJuridica ? participants : []) as unknown as Json,
        tipo_programa: "Factura USA",
        programa: form.programa,
        nemonico: form.nemonico || null,
        codigo_snies: null,
        cohorte: form.cohorte || null,
        plan_estudio: form.programa,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: null, horas_programa: null, duracion: null, convocatoria: null,
        periodo,
        concepto: "Factura USA",
        matricula: valorNum,
        descuento: descuentoFlat,
        descuento_pct: descuentoPct,
        descuento_bono: descuentoFlat,
        valor_total: computedTotal,
        valor_total_empresa: isJuridica ? computedTotalEmpresa : null,
        recargo_total: Math.round(computedTotal * 1.1),
        fecha_limite_pago: baseLimite,
        observaciones: form.observaciones || null,
        attachments,
      };

      if (editId) {
        const next = { ...payload } as typeof payload & {
          status?: "pendiente"; info_requested?: null; rejection_reason?: null;
        };
        if ((originalStatus === "requiere_info" || originalStatus === "rechazada") && !isAdmin) {
          next.status = "pendiente";
          next.info_requested = null;
          next.rejection_reason = null;
        }
        const { error } = await supabase.from("invoice_requests").update(next).eq("id", editId);
        if (error) throw error;
        toast.success("Solicitud actualizada");
        router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
      } else {
        const { error } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          comercial_email: profile?.email ?? user.email ?? null,
          status: "pendiente",
        });
        if (error) throw error;
        toast.success("Solicitud enviada");
        router.push(canViewAllRequests ? "/admin" : "/mis-recibos");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const isJuridica = form.tipo_persona === "Persona Jurídica";
  const numParticipantes = Math.max(Number(form.numero_participantes) || 1, 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── COMERCIAL ── */}
      <Section title="Datos del comercial">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre Completo">
            <Input value={profile?.nombre_completo ?? ""} disabled />
          </Field>
          <Field label="Correo">
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </Field>
        </div>
      </Section>

      {/* ── TIPO DE PERSONA ── */}
      <Section title="Tipo de persona">
        <Field label="Selecciona el tipo de persona *">
          <Select value={form.tipo_persona} onValueChange={(v) => update("tipo_persona", v as TipoPersona)}>
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
            <Field label="Número de Identificación *">
              <Input required maxLength={50} value={form.cedula} onChange={(e) => update("cedula", e.target.value)} />
            </Field>
            <Field label="Correo electrónico">
              <Input type="email" maxLength={200} value={form.email_natural} onChange={(e) => update("email_natural", e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input maxLength={50} value={form.telefono_natural} onChange={(e) => update("telefono_natural", e.target.value)} />
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
              <Field label="NIT">
                <Input maxLength={50} value={form.nit} onChange={(e) => update("nit", e.target.value)} />
              </Field>
              <Field label="Correo electrónico">
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
                <Input required maxLength={50} value={form.telefono} onChange={(e) => update("telefono", e.target.value)} />
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
            </div>
          </Section>

          {/* ── PARTICIPANTES DINÁMICOS ── */}
          {participants.map((p, i) => (
            <Section key={i} title={`Participante ${i + 1}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre Completo *">
                  <Input required maxLength={300} value={p.nombre} onChange={(e) => updateParticipant(i, "nombre", e.target.value)} />
                </Field>
                <Field label="Número de Identificación *">
                  <Input required maxLength={50} value={p.cedula} onChange={(e) => updateParticipant(i, "cedula", e.target.value)} />
                </Field>
                <Field label="Correo electrónico">
                  <Input type="email" maxLength={200} value={p.email} onChange={(e) => updateParticipant(i, "email", e.target.value)} />
                </Field>
                <Field label="Teléfono">
                  <Input maxLength={50} value={p.telefono} onChange={(e) => updateParticipant(i, "telefono", e.target.value)} />
                </Field>
              </div>
            </Section>
          ))}
        </>
      )}

      {/* ── SECCIONES COMPARTIDAS (solo cuando hay tipo seleccionado) ── */}
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
                        <CommandEmpty>
                          {programas.length === 0 ? "Aún no hay programas en el catálogo." : "Sin resultados."}
                        </CommandEmpty>
                        <CommandGroup>
                          {programas.map((p) => {
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
              <Field label="Fecha de inicio">
                <Input value={form.fecha_inicio} onChange={(e) => update("fecha_inicio", e.target.value)} placeholder="Ej: 24/11/2026" />
              </Field>
            </div>
          </Section>

          {/* Factura */}
          <Section title="Datos de la factura">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor Total del Programa *">
                <Input required type="number" min={0} value={form.valor} onChange={(e) => update("valor", e.target.value)} />
              </Field>
              <Field label="Descuento (%)">
                <Input type="number" min={0} max={100} step="0.01" value={form.descuento_pct} onChange={(e) => update("descuento_pct", e.target.value)} />
              </Field>

              {isJuridica ? (
                <>
                  <Field label="Valor Total a Pagar por Participante">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                      {formatCOP(computedTotal)}
                    </div>
                    {descuentoFlat > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCOP(valorNum)} − {formatCOP(descuentoFlat)} ({descuentoPct}%)
                      </p>
                    )}
                  </Field>
                  <Field label="Valor Total a Pagar por la Empresa">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                      {formatCOP(computedTotalEmpresa)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCOP(computedTotal)} × {numParticipantes} participante(s)
                    </p>
                  </Field>
                </>
              ) : (
                <Field label="Valor Total a Pagar">
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                    {formatCOP(computedTotal)}
                  </div>
                  {descuentoFlat > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCOP(valorNum)} − {formatCOP(descuentoFlat)} ({descuentoPct}%)
                    </p>
                  )}
                </Field>
              )}

              <Field label="Fecha de Vencimiento de la Factura *">
                <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Adjuntos */}
          <Section title="Adjuntos">
            {user && (
              <AttachmentsField value={attachments} onChange={setAttachments} userId={user.id} disabled={busy} />
            )}
          </Section>

          {/* Observaciones */}
          <Section title="Observaciones">
            <Textarea rows={3} value={form.observaciones} onChange={(e) => update("observaciones", e.target.value)} placeholder="Notas opcionales para el administrador" />
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
