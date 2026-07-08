"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCOP, formatDate } from "@/lib/format";
import {
  FileDown, FilePlus, Inbox, Search, Pencil, Trash2, Copy, Wrench, Eye, ArrowLeft,
  Receipt, Globe, Landmark, Wallet, User, GraduationCap, DollarSign, Paperclip,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DetailSection, PreviewRow, StatusBadge } from "@/components/solicitudes/detail-panel";
import { cn } from "@/lib/utils";

type Status = "pendiente" | "aprobada" | "rechazada" | "corregida";

const CORRECTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const withinCorrectionWindow = (approvedAt: string | null) =>
  !!approvedAt && Date.now() - new Date(approvedAt).getTime() < CORRECTION_WINDOW_MS;
type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

const DOC_TYPE_LABELS: Record<string, string> = {
  orden_matricula: "Orden de Matrícula",
  factura_usa: "Factura USA",
  factura_colombia: "Factura Colombia",
  factura_paypal: "Factura PayPal",
};

const DOC_TYPE_ICONS: Record<string, typeof Receipt> = {
  orden_matricula: Receipt,
  factura_usa: Globe,
  factura_colombia: Landmark,
  factura_paypal: Wallet,
};

const STATUS_PILL: Record<Status, string> = {
  pendiente: "bg-amber-50 text-amber-700",
  aprobada: "bg-emerald-50 text-emerald-700",
  rechazada: "bg-rose-50 text-rose-700",
  corregida: "bg-blue-50 text-blue-700",
};

interface AttachmentItem { path: string; name: string; size: number; type: string }
interface Participante { nombre: string; cedula: string; email: string; telefono: string }

interface Req {
  id: string;
  status: Status;
  document_type: DocType | null;
  tipo_persona: string | null;
  valor_parcial: number | null;
  nombre: string;
  identificacion: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
  programa: string;
  tipo_programa: string | null;
  codigo_snies: string | null;
  nemonico: string | null;
  concepto: string | null;
  periodo: string;
  matricula: number;
  descuento_pct: number;
  descuento_bono: number;
  valor_total: number;
  valor_total_empresa: number | null;
  numero_participantes: number | null;
  participantes: Participante[] | null;
  recargo_total: number;
  fecha_limite_pago: string | null;
  fecha_pago_extraordinario: string | null;
  recibo_numero: string | null;
  recibo_fecha: string;
  created_at: string;
  approved_at: string | null;
  observaciones: string | null;
  rejection_reason: string | null;
  info_requested: string | null;
  comercial_nombre: string | null;
  comercial_email: string | null;
  asesor_nombre: string | null;
  template_id: string | null;
  codigo_estudiante: string | null;
  cohorte: string | null;
  plan_estudio: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horas_programa: number | null;
  duracion: string | null;
  convocatoria: string | null;
  attachments: AttachmentItem[] | null;
  approved_pdf_path: string | null;
  archived_by_comercial: boolean;
}

export default function MisRecibos() {
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [previewing, setPreviewing] = useState<Req | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "academico" | "pago" | "adjuntos">("general");

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("invoice_requests")
      .select("*")
      .eq("created_by", user.id)
      .eq("archived_by_comercial", false)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Req[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveRefresh("mis_recibos_inbox", load, !!user);

  const tipos = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.tipo_programa && s.add(i.tipo_programa));
    return [...s];
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tipoFilter !== "all" && r.tipo_programa !== tipoFilter) return false;
      if (!s) return true;
      return (
        r.nombre.toLowerCase().includes(s) ||
        r.identificacion.includes(s) ||
        String(r.recibo_numero ?? "").includes(s) ||
        (r.comercial_nombre ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, q, statusFilter, tipoFilter]);

  const reqToPdfData = (r: Req) => {
    const x = r as Req & {
      empresa?: string | null; nit?: string | null; direccion?: string | null;
      ciudad?: string | null; telefono?: string | null; pais?: string | null;
      email?: string | null; nemonico?: string | null;
    };
    return {
      recibo_numero: r.recibo_numero,
      recibo_fecha: r.recibo_fecha,
      nombre: r.nombre,
      identificacion: r.identificacion,
      codigo_estudiante: r.codigo_estudiante,
      programa: r.programa,
      codigo_snies: r.codigo_snies,
      periodo: r.periodo,
      cohorte: r.cohorte,
      plan_estudio: r.plan_estudio,
      fecha_inicio: r.fecha_inicio,
      horas_programa: r.horas_programa,
      duracion: r.duracion,
      convocatoria: r.convocatoria,
      matricula: Number(r.matricula),
      descuento_pct: Number(r.descuento_pct ?? 0),
      descuento_bono: Number(r.descuento_bono ?? 0),
      valor_total: Number(r.valor_total ?? 0),
      recargo_total: Number(r.recargo_total),
      fecha_limite_pago: r.fecha_limite_pago,
      fecha_pago_extraordinario: r.fecha_pago_extraordinario,
      template_id: r.template_id,
      tipo_programa: r.tipo_programa,
      document_type: r.document_type,
      tipo_persona: r.tipo_persona,
      valor_parcial: r.valor_parcial,
      empresa: x.empresa ?? null,
      cliente_nit: x.nit ?? null,
      direccion: x.direccion ?? null,
      ciudad: x.ciudad ?? null,
      telefono: x.telefono ?? null,
      pais: x.pais ?? null,
      email: x.email ?? null,
      nemonico: x.nemonico ?? null,
    };
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("recibo.pdf");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const previewPdf = async (r: Req) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewName(`recibo-${r.recibo_numero ?? "sin-numero"}-${r.identificacion}.pdf`);
    try {
      if (r.approved_pdf_path) {
        const { data, error } = await supabase.storage
          .from("invoice-files")
          .createSignedUrl(r.approved_pdf_path, 300);
        if (error || !data) throw error ?? new Error("no signed url");
        setPreviewUrl(data.signedUrl);
        return;
      }
      if (r.document_type === "factura_colombia" || r.document_type === "factura_paypal") {
        toast.error("Esta solicitud no tiene un PDF adjunto.");
        setPreviewOpen(false);
        return;
      }
      const { getInvoicePdfDataUrl } = await import("@/lib/generate-invoice-pdf");
      const url = await getInvoicePdfDataUrl(reqToPdfData(r));
      setPreviewUrl(url);
    } catch {
      toast.error("No se pudo generar la vista previa");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadPdf = async (r: Req) => {
    if (r.approved_pdf_path) {
      const { data, error } = await supabase.storage
        .from("invoice-files")
        .createSignedUrl(r.approved_pdf_path, 60);
      if (error || !data) return toast.error(error?.message ?? "No se pudo descargar");
      window.open(data.signedUrl, "_blank");
      return;
    }
    if (r.document_type === "factura_colombia" || r.document_type === "factura_paypal") {
      toast.error("Esta solicitud no tiene un PDF adjunto.");
      return;
    }
    const { generateInvoicePDF } = await import("@/lib/generate-invoice-pdf");
    await generateInvoicePDF(reqToPdfData(r));
  };

  const [responseViewOpen, setResponseViewOpen] = useState(false);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseNotesText, setResponseNotesText] = useState("");
  const [responseImages, setResponseImages] = useState<{ name: string; url: string }[]>([]);

  const openResponseView = async (r: Req) => {
    setResponseViewOpen(true);
    setResponseLoading(true);
    setResponseNotesText(r.observaciones ?? "");
    setResponseImages([]);
    try {
      const noteAttachments = (r.attachments ?? []).filter((a) => a.name.startsWith("Nota de aprobación"));
      const signed = await Promise.all(noteAttachments.map(async (a) => {
        const { data } = await supabase.storage.from("invoice-files").createSignedUrl(a.path, 300);
        return { name: a.name, url: data?.signedUrl ?? "" };
      }));
      setResponseImages(signed.filter((s) => s.url));
    } finally {
      setResponseLoading(false);
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "No se pudo abrir");
    window.open(data.signedUrl, "_blank");
  };

  const downloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = previewName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const archiveRequest = async (r: Req) => {
    if (!confirm(`¿Eliminar el recibo de ${r.nombre}? Esta acción no se puede deshacer.`)) return;
    const { data, error } = await supabase
      .from("invoice_requests")
      .update({ archived_by_comercial: true })
      .eq("id", r.id)
      .select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("No se pudo eliminar (permisos)."); return; }
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    setPreviewing((p) => p?.id === r.id ? null : p);
    toast.success("Recibo eliminado");
  };

  const duplicar = (r: Req) => {
    window.location.href = `/solicitar?duplicar=${r.id}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {!previewing && (
      <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/solicitar">
          <Button className="rounded-xl"><FilePlus className="mr-2 h-4 w-4" /> Nueva solicitud</Button>
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-xl bg-muted/40 pl-9" placeholder="Buscar por estudiante, recibo o asesor…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-44 rounded-xl bg-muted/40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">🟡 Pendiente</SelectItem>
              <SelectItem value="aprobada">🟢 Aprobada</SelectItem>
              <SelectItem value="corregida">🔵 Corregida</SelectItem>
              <SelectItem value="rechazada">🔴 Rechazada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-44 rounded-xl bg-muted/40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Sin resultados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const DocIcon = DOC_TYPE_ICONS[r.document_type ?? ""] ?? Receipt;
              return (
              <div
                key={r.id}
                onClick={() => { setPreviewing(r); setDetailTab("general"); }}
                className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
                      <DocIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{r.nombre}</span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", STATUS_PILL[r.status])}>
                          {r.status === "pendiente" ? "Pendiente" : r.status === "aprobada" ? "Aprobada" : r.status === "corregida" ? "Corregida" : "Rechazada"}
                        </span>
                        {r.recibo_numero && <span className="text-xs font-mono text-muted-foreground">#{r.recibo_numero}</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">{DOC_TYPE_LABELS[r.document_type ?? ""] ?? r.document_type ?? "—"}</span>
                        {" · "}ID {r.identificacion} · {r.concepto ?? "Matrícula"} · {r.tipo_programa ?? ""} {r.programa}
                      </p>
                      {r.status === "rechazada" && r.rejection_reason && (
                        <p className="mt-1 truncate text-xs text-rose-600">⚠️ {r.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor a pagar</p>
                    <p className="text-lg font-extrabold text-foreground">{formatCOP(r.valor_total)}</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Vista de detalle (ocupa toda la página, seccionada como un correo abierto) */}
      {previewing && (() => {
            const isPersonaFlow = previewing.document_type !== "orden_matricula";
            const isJuridica = previewing.tipo_persona === "Persona Jurídica";
            const participantes = previewing.participantes ?? [];
            const hasAttachments = (previewing.attachments && previewing.attachments.length > 0) || previewing.approved_pdf_path;
            const iniciales = previewing.nombre.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
            const TABS: { id: typeof detailTab; label: string; icon: typeof User }[] = [
              { id: "general", label: "General", icon: User },
              { id: "academico", label: "Académico", icon: GraduationCap },
              { id: "pago", label: "Pago", icon: DollarSign },
              { id: "adjuntos", label: "Adjuntos", icon: Paperclip },
            ];
            return (
              <div className="space-y-4 pb-6">
                <button
                  type="button"
                  onClick={() => setPreviewing(null)}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver a mis recibos
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{previewing.nombre}</h1>
                  <StatusBadge s={previewing.status} />
                  {previewing.recibo_numero && (
                    <span className="text-xs font-mono text-muted-foreground">#{previewing.recibo_numero}</span>
                  )}
                  <span className="text-xs text-muted-foreground">· {DOC_TYPE_LABELS[previewing.document_type ?? ""] ?? previewing.document_type ?? "—"}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Columna izquierda: resumen rápido */}
                  <div className="space-y-4 lg:col-span-1">
                    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <div className="absolute left-0 top-0 h-1.5 w-full bg-primary" />
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                          {iniciales || "—"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-foreground">{previewing.nombre}</p>
                          <p className="text-xs text-muted-foreground">ID {previewing.identificacion}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Tipo de solicitud</span>
                          <span className="text-right font-semibold text-foreground">{DOC_TYPE_LABELS[previewing.document_type ?? ""] ?? "—"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Concepto</span>
                          <span className="text-right font-semibold text-foreground">{previewing.concepto ?? "Matrícula"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Asesor Comercial</span>
                          <span className="text-right font-semibold text-foreground">{previewing.asesor_nombre ?? "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-md">
                      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/5" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">💰 Monto de solicitud</h4>
                      <p className="text-2xl font-extrabold tracking-tight">{formatCOP(previewing.valor_total_empresa ?? previewing.valor_total)}</p>
                      <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Descuento aplicado</span>
                          <span className="font-bold text-emerald-400">
                            {previewing.valor_parcial != null ? "—" : `${previewing.descuento_pct}% · ${formatCOP(previewing.descuento_bono ?? 0)}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Recargo por mora</span>
                          <span className="font-bold text-rose-400">{formatCOP(previewing.recargo_total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha: contenido seccionado por pestañas */}
                  <div className="lg:col-span-2">
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="flex gap-1 border-b border-border bg-muted/30 p-1">
                        {TABS.map((t) => {
                          const Icon = t.icon;
                          const active = detailTab === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setDetailTab(t.id)}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all",
                                active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" /> {t.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-6 space-y-6">
                        {detailTab === "general" && (
                          <>
                            <DetailSection title={isPersonaFlow ? "Datos del tercero" : "Datos del estudiante"}>
                              {isPersonaFlow && (
                                <div className="sm:col-span-2">
                                  <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                                    {previewing.tipo_persona ?? "Sin especificar"}
                                  </span>
                                </div>
                              )}
                              {isPersonaFlow && isJuridica ? (
                                <>
                                  <PreviewRow label="Empresa" value={previewing.empresa ?? previewing.nombre} />
                                  <PreviewRow label="Número de Identificación" value={previewing.nit ?? previewing.identificacion} />
                                  <PreviewRow label="País" value={previewing.pais ?? "—"} />
                                  <PreviewRow label="Ciudad" value={previewing.ciudad ?? "—"} />
                                  <div className="sm:col-span-2"><PreviewRow label="Dirección" value={previewing.direccion ?? "—"} /></div>
                                </>
                              ) : (
                                <>
                                  <PreviewRow label={isPersonaFlow ? "Nombre" : "Estudiante"} value={previewing.nombre} />
                                  <PreviewRow label="Identificación" value={previewing.identificacion} />
                                  {!isPersonaFlow && <PreviewRow label="Tipo de financiación" value={previewing.tipo_persona ?? "—"} />}
                                </>
                              )}
                              <PreviewRow label="Correo" value={previewing.email ?? "—"} />
                              <PreviewRow label="Teléfono" value={previewing.telefono ?? "—"} />
                            </DetailSection>

                            {participantes.length > 0 && (
                              <DetailSection title={`Participantes (${participantes.length})`} noGrid>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {participantes.map((p, i) => (
                                    <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
                                      <p className="font-semibold text-foreground">{i + 1}. {p.nombre || "—"}</p>
                                      {p.cedula && <p className="text-muted-foreground">ID: {p.cedula}</p>}
                                      {p.email && <p className="text-muted-foreground">{p.email}</p>}
                                      {p.telefono && <p className="text-muted-foreground">Tel: {p.telefono}</p>}
                                    </div>
                                  ))}
                                </div>
                              </DetailSection>
                            )}

                            <DetailSection title="Estado y seguimiento">
                              <PreviewRow label="Creada" value={formatDate(previewing.created_at)} />
                              {previewing.approved_at && <PreviewRow label="Aprobada" value={formatDate(previewing.approved_at)} />}
                              {previewing.observaciones && (
                                <div className="sm:col-span-2">
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Observaciones</p>
                                  <p className="mt-0.5 text-foreground">{previewing.observaciones}</p>
                                </div>
                              )}
                              {previewing.rejection_reason && (
                                <div className="sm:col-span-2 rounded-lg bg-destructive/10 px-3 py-2">
                                  <p className="text-xs uppercase tracking-wider text-destructive">⚠️ Motivo de rechazo</p>
                                  <p className="mt-0.5 text-destructive">{previewing.rejection_reason}</p>
                                </div>
                              )}
                            </DetailSection>
                          </>
                        )}

                        {detailTab === "academico" && (
                          <DetailSection title="Programa">
                            <PreviewRow label="Concepto" value={previewing.concepto ?? "—"} />
                            <PreviewRow label="Tipo de programa" value={previewing.tipo_programa ?? "—"} />
                            <div className="sm:col-span-2"><PreviewRow label="Programa" value={previewing.programa} /></div>
                            {!isPersonaFlow && <PreviewRow label="SNIES" value={previewing.codigo_snies ?? "—"} />}
                            {isPersonaFlow && <PreviewRow label="Nemónico" value={previewing.nemonico ?? "—"} />}
                            <PreviewRow label="Cohorte" value={previewing.cohorte ?? "—"} />
                            <PreviewRow label="Periodo" value={previewing.periodo} />
                            <PreviewRow label="Fecha inicio" value={previewing.fecha_inicio ?? "—"} />
                            {previewing.fecha_fin && <PreviewRow label="Fecha fin" value={previewing.fecha_fin} />}
                            {previewing.horas_programa != null && <PreviewRow label="Horas / duración" value={String(previewing.horas_programa)} />}
                            {previewing.convocatoria && <PreviewRow label="Convocatoria" value={previewing.convocatoria} />}
                          </DetailSection>
                        )}

                        {detailTab === "pago" && (
                          <DetailSection title="Valores">
                            {previewing.valor_parcial != null ? (
                              <>
                                <PreviewRow label="Valor de matrícula" value={formatCOP(previewing.matricula)} />
                                <PreviewRow label="Valor parcial a facturar" value={formatCOP(previewing.valor_parcial)} />
                              </>
                            ) : (
                              <>
                                <PreviewRow label="Matrícula" value={formatCOP(previewing.matricula)} />
                                <PreviewRow label="Descuento %" value={`${previewing.descuento_pct}%`} />
                                <PreviewRow label="Descuento bono" value={formatCOP(previewing.descuento_bono ?? 0)} />
                              </>
                            )}
                            <PreviewRow label="Valor total a pagar" value={formatCOP(previewing.valor_total)} />
                            {previewing.valor_total_empresa != null && (
                              <PreviewRow label="Valor total empresa" value={formatCOP(previewing.valor_total_empresa)} />
                            )}
                            <PreviewRow label="Recargo por mora" value={formatCOP(previewing.recargo_total)} />
                            <PreviewRow label="Límite de pago" value={previewing.fecha_limite_pago ?? "—"} />
                            <PreviewRow label="Pago extraordinario" value={previewing.fecha_pago_extraordinario ?? "—"} />
                          </DetailSection>
                        )}

                        {detailTab === "adjuntos" && (
                          !hasAttachments ? (
                            <p className="text-sm text-muted-foreground">Esta solicitud no tiene archivos adjuntos.</p>
                          ) : (
                            <DetailSection title="Adjuntos" noGrid>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {previewing.attachments?.map((a) => (
                                  <button
                                    key={a.path}
                                    type="button"
                                    onClick={() => openAttachment(a.path)}
                                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors"
                                  >
                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">📎 {a.name}</span>
                                    <span className="shrink-0 text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                                  </button>
                                ))}
                                {previewing.approved_pdf_path && (
                                  <button
                                    type="button"
                                    onClick={() => openAttachment(previewing.approved_pdf_path!)}
                                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs hover:bg-blue-100 transition-colors"
                                  >
                                    <FileDown className="h-4 w-4 shrink-0 text-blue-700" />
                                    <span className="min-w-0 flex-1 truncate font-medium text-blue-700">PDF oficial aprobado</span>
                                  </button>
                                )}
                              </div>
                            </DetailSection>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barra de acciones, fija al fondo de la pantalla */}
                <div className="sticky bottom-0 left-0 right-0 -mx-6 border-t border-border bg-card/95 px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {previewing.status === "pendiente" && (
                        <Link href={`/solicitar?id=${previewing.id}`} className="flex-1">
                          <Button className="w-full rounded-xl"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                        </Link>
                      )}
                      {previewing.status === "rechazada" && (
                        <Link href={`/solicitar?id=${previewing.id}`} className="flex-1">
                          <Button className="w-full rounded-xl"><Pencil className="mr-2 h-4 w-4" /> Corregir y reenviar</Button>
                        </Link>
                      )}
                    </div>
                    {(previewing.status === "aprobada" || previewing.status === "corregida") && (
                      <div className="flex flex-wrap gap-2">
                        {previewing.document_type === "factura_paypal" && !previewing.approved_pdf_path ? (
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openResponseView(previewing)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Respuesta
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => previewPdf(previewing)}>
                              <Eye className="mr-2 h-4 w-4" /> Vista previa
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => downloadPdf(previewing)}>
                              <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                            </Button>
                          </>
                        )}
                        {withinCorrectionWindow(previewing.approved_at) ? (
                          <Link href={`/solicitar?id=${previewing.id}`}>
                            <Button size="sm" variant="outline" className="rounded-xl">
                              <Wrench className="mr-2 h-4 w-4" /> Corregir
                            </Button>
                          </Link>
                        ) : (
                          <Button size="sm" variant="outline" className="rounded-xl" disabled title="Ya pasaron más de 3 días desde la aprobación — no se puede corregir.">
                            <Wrench className="mr-2 h-4 w-4" /> Corregir
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => duplicar(previewing)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicar
                        </Button>
                      </div>
                    )}
                    {(previewing.status === "aprobada" || previewing.status === "corregida" || previewing.status === "rechazada") && (
                      <Button size="sm" variant="destructive" className="w-full rounded-xl" onClick={() => archiveRequest(previewing)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

      <Dialog open={responseViewOpen} onOpenChange={setResponseViewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Respuesta de aprobación
            </DialogTitle>
          </DialogHeader>
          {responseLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="space-y-4">
              {responseNotesText ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{responseNotesText}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin nota de aprobación registrada.</p>
              )}
              {responseImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {responseImages.map((img) => (
                    <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                      <img src={img.url} alt={img.name} className="h-32 w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa del recibo</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] w-full overflow-hidden rounded border border-border bg-muted">
            {previewLoading || !previewUrl ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Generando vista previa…
              </div>
            ) : (
              <iframe src={previewUrl} title="Vista previa PDF" className="h-full w-full" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
            <Button onClick={downloadFromPreview} disabled={!previewUrl}>
              <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
