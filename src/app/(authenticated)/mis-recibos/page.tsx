"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatCOP, formatDate } from "@/lib/format";
import {
  FileDown, Inbox, Search, Pencil, Trash2, Copy, Wrench, Eye, ArrowLeft,
  Receipt, Globe, Landmark, Wallet,
  Calendar, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DetailSection, PreviewRow } from "@/components/solicitudes/detail-panel";
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

const formatCedula = (id: string) => {
  const digits = (id ?? "").replace(/\D/g, "");
  if (!digits) return id ?? "—";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const buildRecuento = (r: Req) => {
  const nemonico = (r.nemonico ?? "").trim();
  const cohorte = (r.cohorte ?? "").trim();
  // Si el cohorte ya trae el nemónico como prefijo (ej. "DIACONT07"), no lo dupliquemos.
  const cohorteCode = nemonico && cohorte.toUpperCase().startsWith(nemonico.toUpperCase())
    ? cohorte
    : `${nemonico}${cohorte}`;
  const cohorteLine = `${cohorteCode} ${r.programa ?? ""}`.trim();
  const participantesList = r.participantes && r.participantes.length > 0
    ? r.participantes
    : [{ nombre: r.nombre, cedula: r.identificacion, email: "", telefono: "" }];
  return participantesList
    .map((p) => `${cohorteLine}\nParticipante ${p.nombre} ${formatCedula(p.cedula)}`)
    .join("\n\n");
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
  numero_inscripcion: string | null;
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
  valor_por_estudiante: number | null;
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
  const [tipoFilter, setTipoFilter] = useState<"all" | DocType>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [previewing, setPreviewing] = useState<Req | null>(null);

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

  useEffect(() => {
    const handler = () => setPreviewing(null);
    window.addEventListener("app:reset-inbox", handler);
    return () => window.removeEventListener("app:reset-inbox", handler);
  }, []);

  useLiveRefresh("mis_recibos_inbox", load, !!user);

  const visibleItems = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return items;
    return items.filter((r) =>
      r.nombre.toLowerCase().includes(s) ||
      r.identificacion.includes(s) ||
      String(r.recibo_numero ?? "").includes(s) ||
      (r.comercial_nombre ?? "").toLowerCase().includes(s) ||
      (r.asesor_nombre ?? "").toLowerCase().includes(s) ||
      (r.programa ?? "").toLowerCase().includes(s) ||
      (r.tipo_programa ?? "").toLowerCase().includes(s) ||
      (r.concepto ?? "").toLowerCase().includes(s) ||
      (DOC_TYPE_LABELS[r.document_type ?? ""] ?? "").toLowerCase().includes(s),
    );
  }, [items, q]);

  const statusCounts = useMemo(() => ({
    all: visibleItems.length,
    pendiente: visibleItems.filter((r) => r.status === "pendiente").length,
    aprobada: visibleItems.filter((r) => r.status === "aprobada").length,
    corregida: visibleItems.filter((r) => r.status === "corregida").length,
    rechazada: visibleItems.filter((r) => r.status === "rechazada").length,
  }), [visibleItems]);

  const tipoPendingCounts = useMemo(() => {
    const counts: Partial<Record<DocType, number>> = {};
    visibleItems.forEach((r) => {
      if (r.status !== "pendiente" || !r.document_type) return;
      counts[r.document_type] = (counts[r.document_type] ?? 0) + 1;
    });
    return counts;
  }, [visibleItems]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    return visibleItems.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tipoFilter !== "all" && r.document_type !== tipoFilter) return false;
      if (fromTs && new Date(r.created_at).getTime() < fromTs) return false;
      return true;
    });
  }, [visibleItems, statusFilter, tipoFilter, dateFrom]);

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
      valor_total_empresa: r.valor_total_empresa ? Number(r.valor_total_empresa) : null,
      valor_por_estudiante: r.valor_por_estudiante ? Number(r.valor_por_estudiante) : null,
      numero_participantes: r.numero_participantes,
      participantes: r.participantes,
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
    <main className="mx-auto max-w-7xl px-6 py-4">
      {!previewing && (
      <>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl bg-muted/40 pl-9"
              placeholder="Buscar por estudiante, ID, recibo, asesor, comercial, programa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 h-10 transition-all",
            dateFrom ? "border-primary bg-primary/5" : "border-transparent bg-muted/40",
          )}>
            <Calendar className={cn("h-4 w-4", dateFrom ? "text-primary" : "text-muted-foreground")} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={cn(
                "w-[9.5rem] bg-transparent text-sm outline-none",
                dateFrom ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            />
            {dateFrom && (
              <button
                type="button"
                onClick={() => setDateFrom("")}
                className="text-muted-foreground hover:text-foreground"
                title="Quitar filtro de fecha"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { id: "all" as const, label: "Todas", icon: "📋" },
            { id: "pendiente" as const, label: "Pendientes", icon: "🟡" },
            { id: "aprobada" as const, label: "Aprobadas", icon: "🟢" },
            { id: "corregida" as const, label: "Corregidas", icon: "🔵" },
            { id: "rechazada" as const, label: "Rechazadas", icon: "🔴" },
          ]).map((c) => {
            const active = statusFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                <span>{c.icon}</span> {c.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-bold",
                  active ? "bg-white/20" : "bg-background",
                )}>
                  {statusCounts[c.id]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            { id: "orden_matricula" as const, label: "Orden de Matrícula", icon: Receipt },
            { id: "factura_usa" as const, label: "Factura USA", icon: Globe },
            { id: "factura_colombia" as const, label: "Factura Colombia", icon: Landmark },
            { id: "factura_paypal" as const, label: "Factura PayPal", icon: Wallet },
          ]).map((t) => {
            const active = tipoFilter === t.id;
            const Icon = t.icon;
            const pendientes = statusFilter === "pendiente" ? (tipoPendingCounts[t.id] ?? 0) : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoFilter(active ? "all" : t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                  active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
                {pendientes > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    active ? "bg-white/20" : "bg-amber-100 text-amber-700",
                  )}>
                    {pendientes}
                  </span>
                )}
              </button>
            );
          })}
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
              return (
              <div
                key={r.id}
                onClick={() => setPreviewing(r)}
                className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:bg-muted/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="block truncate text-lg font-bold text-foreground">{r.nombre}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_PILL[r.status])}>
                        {r.status === "pendiente" ? "Pendiente" : r.status === "aprobada" ? "Aprobada" : r.status === "corregida" ? "Corregida" : "Rechazada"}
                      </span>
                      {r.recibo_numero && <span className="text-sm font-mono text-muted-foreground">#{r.recibo_numero}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
                      <span className="font-bold text-foreground/80">{DOC_TYPE_LABELS[r.document_type ?? ""] ?? r.document_type ?? "—"}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span>ID {r.identificacion}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="truncate">{r.concepto ?? "Matrícula"} · {r.tipo_programa ?? ""} {r.programa}</span>
                    </div>
                    {r.status === "rechazada" && r.rejection_reason && (
                      <p className="w-fit rounded-lg border border-rose-100/60 bg-rose-50/50 px-2.5 py-1 text-sm font-medium text-rose-600">
                        Motivo: {r.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center justify-center text-center md:pl-4">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Valor a pagar</span>
                  <span className="text-xl font-extrabold text-foreground">{formatCOP(r.valor_total)}</span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Vista de detalle (ocupa toda la página, seccionada como un correo abierto — misma estructura que la Bandeja) */}
      {previewing && (() => {
            const isPersonaFlow = previewing.document_type !== "orden_matricula";
            const isJuridica = previewing.tipo_persona === "Persona Jurídica";
            const participantes = previewing.participantes ?? [];
            const hasAttachments = (previewing.attachments && previewing.attachments.length > 0) || previewing.approved_pdf_path;
            return (
              <div className="space-y-3 pb-4">
                {/* Barra de acciones — arriba, para que se vea de una */}
                <div className="rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPreviewing(null)}>
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Mis recibos
                    </Button>
                    {previewing.status === "pendiente" && (
                      <Link href={`/solicitar?id=${previewing.id}`}>
                        <Button size="sm" variant="outline" className="rounded-full">
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                      </Link>
                    )}
                    {previewing.status === "rechazada" && (
                      <Link href={`/solicitar?id=${previewing.id}`}>
                        <Button size="sm" variant="outline" className="rounded-full">
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Corregir y reenviar
                        </Button>
                      </Link>
                    )}
                    {(previewing.status === "aprobada" || previewing.status === "corregida") && (
                      previewing.document_type === "factura_paypal" && !previewing.approved_pdf_path ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => openResponseView(previewing)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver Respuesta
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => previewPdf(previewing)}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> Vista previa
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadPdf(previewing)}>
                            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Descargar PDF
                          </Button>
                        </>
                      )
                    )}
                    {(previewing.status === "aprobada" || previewing.status === "corregida") && (
                      withinCorrectionWindow(previewing.approved_at) ? (
                        <Link href={`/solicitar?id=${previewing.id}`}>
                          <Button size="sm" variant="outline" className="rounded-full">
                            <Wrench className="mr-1.5 h-3.5 w-3.5" /> Corregir
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-full" disabled title="Ya pasaron más de 3 días desde la aprobación — no se puede corregir.">
                          <Wrench className="mr-1.5 h-3.5 w-3.5" /> Corregir
                        </Button>
                      )
                    )}
                    {(previewing.status === "aprobada" || previewing.status === "corregida") && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => duplicar(previewing)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                      </Button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {(previewing.status === "aprobada" || previewing.status === "corregida" || previewing.status === "rechazada") && (
                        <Button size="sm" variant="outline" className="rounded-full text-red-700 border-red-200 hover:bg-red-700 hover:text-white" onClick={() => archiveRequest(previewing)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenido: todas las secciones, sin pestañas */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="p-5 space-y-5">
                        <>
                            {previewing.document_type === "factura_colombia" && (
                              <DetailSection title="Recuento" noGrid>
                                <div className="space-y-2">
                                  <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                                    {buildRecuento(previewing)}
                                  </pre>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(buildRecuento(previewing));
                                      toast.success("Recuento copiado");
                                    }}
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar recuento
                                  </Button>
                                </div>
                              </DetailSection>
                            )}

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
                                  {previewing.numero_participantes != null && (
                                    <PreviewRow label="N° de Participantes" value={String(previewing.numero_participantes)} />
                                  )}
                                </>
                              ) : (
                                <>
                                  <PreviewRow label={isPersonaFlow ? "Nombre" : "Estudiante"} value={previewing.nombre} />
                                  <PreviewRow label="Identificación" value={previewing.identificacion} />
                                  {!isPersonaFlow && <PreviewRow label="Tipo de financiación" value={previewing.tipo_persona ?? "—"} />}
                                  {(previewing.pais || previewing.direccion || previewing.ciudad) && (
                                    <>
                                      <PreviewRow label="País" value={previewing.pais ?? "—"} />
                                      <PreviewRow label="Ciudad" value={previewing.ciudad ?? "—"} />
                                      <div className="sm:col-span-2"><PreviewRow label="Dirección" value={previewing.direccion ?? "—"} /></div>
                                    </>
                                  )}
                                </>
                              )}
                              <PreviewRow label="Correo" value={previewing.email ?? "—"} />
                              <PreviewRow label="Teléfono" value={previewing.telefono ?? "—"} />
                              {previewing.numero_inscripcion && (
                                <PreviewRow label="N° de Inscripción" value={previewing.numero_inscripcion} />
                              )}
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
                              <PreviewRow label="Líder Comercial" value={previewing.comercial_nombre ?? "—"} />
                              <PreviewRow label="Correo Líder Comercial" value={previewing.comercial_email ?? "—"} />
                              {previewing.asesor_nombre && (
                                <PreviewRow label="Asesor Comercial" value={previewing.asesor_nombre} />
                              )}
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

                            <DetailSection title="Programa">
                            <PreviewRow label="Concepto" value={previewing.concepto ?? "—"} />
                            <PreviewRow label="Tipo de programa" value={previewing.tipo_programa ?? "—"} />
                            <div className="sm:col-span-2"><PreviewRow label="Programa" value={previewing.programa} /></div>
                            {!isPersonaFlow && previewing.plan_estudio && (
                              <div className="sm:col-span-2"><PreviewRow label="Nombre del Diplomado" value={previewing.plan_estudio} /></div>
                            )}
                            {!isPersonaFlow && <PreviewRow label="SNIES" value={previewing.codigo_snies ?? "—"} />}
                            {isPersonaFlow && <PreviewRow label="Nemónico" value={previewing.nemonico ?? "—"} />}
                            <PreviewRow label="Cohorte" value={previewing.cohorte ?? "—"} />
                            <PreviewRow label="Periodo" value={previewing.periodo} />
                            <PreviewRow label="Fecha inicio" value={previewing.fecha_inicio ?? "—"} />
                            {previewing.fecha_fin && <PreviewRow label="Fecha fin" value={previewing.fecha_fin} />}
                            {(previewing.duracion || previewing.horas_programa != null) && (
                              <PreviewRow label="Duración" value={previewing.duracion ?? String(previewing.horas_programa)} />
                            )}
                            {previewing.convocatoria && <PreviewRow label="Convocatoria" value={previewing.convocatoria} />}
                          </DetailSection>

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
                            {previewing.valor_por_estudiante != null && (
                              <PreviewRow label="Valor por estudiante" value={formatCOP(previewing.valor_por_estudiante)} />
                            )}
                            <PreviewRow label="Recargo por mora" value={formatCOP(previewing.recargo_total)} />
                            <PreviewRow label="Límite de pago" value={previewing.fecha_limite_pago ?? "—"} />
                            <PreviewRow label="Pago extraordinario" value={previewing.fecha_pago_extraordinario ?? "—"} />
                          </DetailSection>

                            {(!hasAttachments ? (
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
                          ))}
                        </>
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
