import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { notifyAdminsNewRequest } from "@/lib/email.functions";
import { AttachmentsField, type AttachmentItem } from "./AttachmentsField";
import { listProgramas, type Programa } from "@/lib/programas";
import { listCohortesByNemonico, type CohorteRow } from "@/lib/sheets.functions";

interface PpForm {
  nombre: string;
  cedula: string;
  programa: string;
  nemonico: string;
  cohorte: string;
  numero_inscripcion: string;
  fecha_inicio: string;
  email: string;
  pais: string;
  valor: string;
  fecha_limite_pago: string;
}

const EMPTY: PpForm = {
  nombre: "", cedula: "", programa: "", nemonico: "", cohorte: "",
  numero_inscripcion: "", fecha_inicio: "", email: "", pais: "", valor: "", fecha_limite_pago: "",
};

export function FacturaPaypalForm({ editId }: { editId?: string }) {
  const { user, isAdmin, isComercial, profile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PpForm>(EMPTY);
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

  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data, error } = await supabase.from("invoice_requests").select("*").eq("id", editId).maybeSingle();
      if (error || !data) return;
      const d = data as Record<string, unknown>;
      setOriginalStatus(data.status);
      setForm({
        nombre: data.nombre ?? "",
        cedula: data.identificacion ?? "",
        programa: data.programa ?? "",
        nemonico: (d.nemonico as string) ?? "",
        cohorte: data.cohorte ?? "",
        numero_inscripcion: (d.numero_inscripcion as string) ?? "",
        fecha_inicio: data.fecha_inicio ?? "",
        email: data.email ?? "",
        pais: (d.pais as string) ?? "",
        valor: String(data.valor_total ?? ""),
        fecha_limite_pago: data.fecha_limite_pago ?? "",
      });
      const att = (d.attachments as AttachmentItem[] | null) ?? [];
      setAttachments(Array.isArray(att) ? att : []);
    })();
  }, [editId, user]);

  const update = <K extends keyof PpForm>(k: K, v: PpForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const valor = Number(form.valor) || 0;
      const periodo = `${new Date().getFullYear()}`;
      const payload = {
        document_type: "factura_paypal",
        nombre: form.nombre,
        identificacion: form.cedula,
        email: form.email,
        tipo_programa: "Factura PayPal",
        programa: form.programa || form.nemonico,
        nemonico: form.nemonico,
        numero_inscripcion: form.numero_inscripcion,
        pais: form.pais,
        codigo_snies: null, cohorte: form.cohorte || null, plan_estudio: form.programa || form.nemonico,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: null, horas_programa: null, duracion: null, convocatoria: null,
        periodo,
        concepto: "Factura PayPal",
        matricula: valor,
        descuento: 0, descuento_pct: 0, descuento_bono: 0,
        valor_total: valor,
        recargo_total: valor,
        fecha_limite_pago: form.fecha_limite_pago,
        observaciones: null,
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
      } else {
        const { error } = await supabase.from("invoice_requests").insert({
          ...payload,
          created_by: user.id,
          comercial_nombre: profile?.nombre_completo ?? null,
          comercial_email: profile?.email ?? user.email ?? null,
          status: "pendiente",
        });
        if (error) throw error;
        notifyAdminsNewRequest({ data: {
          nombre: payload.nombre, identificacion: payload.identificacion,
          programa: payload.programa, valor_total: payload.valor_total,
          comercial_nombre: profile?.nombre_completo ?? null,
        } }).catch((e) => console.warn("notify admins failed", e));
        toast.success("Solicitud enviada");
      }
      navigate({ to: isAdmin ? "/admin" : "/mis-recibos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <Section title="Datos del participante">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Participante *">
            <Input required maxLength={300} value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
          </Field>
          <Field label="Cédula *">
            <Input required maxLength={50} value={form.cedula} onChange={(e) => update("cedula", e.target.value)} />
          </Field>
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
                      {programas.map((p) => {
                        const snies = p.codigo_snies?.match(/\b(\d{5,7})\b/)?.[1] ?? null;
                        return (
                          <CommandItem key={p.id} value={`${p.nemonico ?? ""} ${p.nombre}`} onSelect={() => pickPrograma(p)} className="flex items-center gap-2 py-2">
                            <Check className={cn("h-3.5 w-3.5 shrink-0", form.programa === p.nombre ? "opacity-100" : "opacity-0")} />
                            {p.nemonico && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{p.nemonico}</span>}
                            <span className="flex-1 truncate text-sm">{p.nombre}</span>
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
          <Field label="N° de Inscripción *">
            <Input required maxLength={100} value={form.numero_inscripcion} onChange={(e) => update("numero_inscripcion", e.target.value)} />
          </Field>
          <Field label="Correo *">
            <Input required type="email" maxLength={200} value={form.email} onChange={(e) => update("email", e.target.value)} />
          </Field>
          <Field label="País *">
            <Input required maxLength={100} value={form.pais} onChange={(e) => update("pais", e.target.value)} />
          </Field>
          <Field label="Valor *">
            <Input required type="number" min={0} value={form.valor} onChange={(e) => update("valor", e.target.value)} />
          </Field>
          <Field label="Fecha Límite de Pago *">
            <Input required type="date" value={form.fecha_limite_pago} onChange={(e) => update("fecha_limite_pago", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Adjuntos">
        {user && (
          <AttachmentsField value={attachments} onChange={setAttachments} userId={user.id} />
        )}
      </Section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy || (!isComercial && !isAdmin)}>
          {busy ? "Guardando..." : editId ? "Guardar cambios" : "Enviar solicitud"}
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
