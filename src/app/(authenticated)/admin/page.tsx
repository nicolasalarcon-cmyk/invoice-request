"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCOP, formatDate } from "@/lib/format";
import {
  AlertTriangle, CheckCircle2, XCircle, FileDown, Inbox, Search, Pencil,
  FileText, Trash2, Eye, Copy, BookOpen, Wrench,
} from "lucide-react";
import { listTemplates, getTemplateDocType, type InvoiceTemplate } from "@/lib/invoice-template";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { deleteInvoiceFiles } from "@/lib/delete-invoice-files";
import { cn } from "@/lib/utils";

type Status = "pendiente" | "aprobada" | "rechazada" | "requiere_info";
type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

const REJECT_OPTIONS = [
  { category: "Datos del tercero incompletos o incorrectos", description: "NIT, razón social, dirección o contacto inválidos, etc." },
  { category: "Documentos soporte faltantes", description: "Orden de compra, contrato, cotización o acta pendiente" },
  { category: "Programa no válido", description: "Código inexistente, inactivo o equivocado" },
  { category: "Monto o concepto no corresponde", description: "Valor o descripción no coinciden con lo pactado" },
  { category: "Solicitud duplicada", description: "Ya existe una solicitud activa para el mismo proveedor/concepto" },
  { category: "Falta aprobación interna", description: "Requiere visto bueno de un superior o comité" },
  { category: "Otra razón", description: null },
] as const;

interface AttachmentItem { path: string; name: string; size: number; type: string }

interface Participante { nombre: string; cedula: string; email: string; telefono: string }

interface Req {
  id: string;
  status: Status;
  document_type: DocType | null;
  nombre: string;
  identificacion: string;
  email: string | null;
  telefono: string | null;
  tipo_persona: string | null;
  valor_parcial: number | null;
  empresa: string | null;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
  codigo_estudiante: string | null;
  programa: string;
  codigo_snies: string | null;
  nemonico: string | null;
  periodo: string;
  cohorte: string | null;
  plan_estudio: string | null;
  tipo_programa: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horas_programa: number | null;
  duracion: string | null;
  convocatoria: string | null;
  concepto: string | null;
  observaciones: string | null;
  matricula: number;
  descuento: number;
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
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  info_requested: string | null;
  comercial_nombre: string | null;
  comercial_email: string | null;
  asesor_nombre: string | null;
  template_id: string | null;
  parent_id: string | null;
  attachments: AttachmentItem[] | null;
  approved_pdf_path: string | null;
  archived_by_comercial: boolean;
}

const isUploadFlow = (r: Req | null) =>
  r?.document_type === "factura_colombia" || r?.document_type === "factura_paypal";

const DOC_TYPE_LABELS: Record<string, string> = {
  orden_matricula: "Orden de Matrícula",
  factura_usa: "Factura USA",
  factura_colombia: "Factura Colombia",
  factura_paypal: "Factura PayPal",
};

async function sendInvoiceEmail(data: {
  kind?: "approved" | "rejected";
  comercial_email: string;
  nombre: string;
  recibo_numero: string | null;
  pdfBase64?: string;
  rejection_reason?: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sin sesión");
  const res = await fetch("/api/admin/send-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error ?? "Error enviando correo");
}

export default function AdminPanel() {
  const { isCartera, canApprove, canDelete, canViewAllRequests, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [approving, setApproving] = useState<Req | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [approvalPdf, setApprovalPdf] = useState<File | null>(null);
  const [manualReciboNumero, setManualReciboNumero] = useState<string>("");
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [rejectCategory, setRejectCategory] = useState("");
  const [rejectOtherText, setRejectOtherText] = useState("");
  const [previewing, setPreviewing] = useState<Req | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState("");
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data, error }, tpls] = await Promise.all([
      supabase.from("invoice_requests").select("*").order("created_at", { ascending: false }),
      listTemplates(),
    ]);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Req[]);
    setTemplates(tpls);
    setLoading(false);
  };

  useEffect(() => { if (canViewAllRequests) load(); }, [canViewAllRequests]);

  useLiveRefresh("invoice_requests_inbox", () => load(true), canViewAllRequests);

  const tipos: { value: string; label: string }[] = [
    { value: "orden_matricula", label: "Orden de Matrícula" },
    { value: "factura_usa",     label: "Factura USA" },
    { value: "factura_colombia", label: "Factura Colombia" },
    { value: "factura_paypal",  label: "Factura Paypal" },
  ];

  const cedAlerts = useMemo(() => {
    const byCed = new Map<string, Req[]>();
    const weekAgo = Date.now() - 7 * 86400000;
    items.forEach((r) => {
      if (r.archived_by_comercial) return;
      if (new Date(r.created_at).getTime() < weekAgo) return;
      const arr = byCed.get(r.identificacion) ?? [];
      arr.push(r);
      byCed.set(r.identificacion, arr);
    });
    const out = new Map<string, number>();
    byCed.forEach((arr, ced) => { if (arr.length >= 2) out.set(ced, arr.length); });
    return out;
  }, [items]);

  const itemsById = useMemo(() => new Map(items.map((r) => [r.id, r])), [items]);

  const isCorrectionOfApproved = (r: Req) => {
    if (!r.parent_id) return false;
    const parent = itemsById.get(r.parent_id);
    return !!parent?.rejection_reason?.startsWith("Corrección solicitada tras aprobación");
  };

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tipoFilter !== "all" && r.document_type !== tipoFilter) return false;
      if (fromTs && new Date(r.created_at).getTime() < fromTs) return false;
      if (!s) return true;
      return (
        r.nombre.toLowerCase().includes(s) ||
        r.identificacion.includes(s) ||
        String(r.recibo_numero ?? "").includes(s) ||
        (r.comercial_nombre ?? "").toLowerCase().includes(s) ||
        (r.comercial_email ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, q, statusFilter, tipoFilter, dateFrom]);

  if (authLoading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (!canViewAllRequests) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Tu cuenta no tiene acceso a esta sección.</p>
      </main>
    );
  }

  const openApprove = (r: Req) => {
    setApproving(r);
    setApprovalPdf(null);
    if (isUploadFlow(r)) {
      setManualReciboNumero(r.recibo_numero != null ? String(r.recibo_numero) : "");
      setSelectedTemplate("");
      return;
    }
    const docTemplates = templates.filter((t) => getTemplateDocType(t) === r.document_type);
    const matchTipo = docTemplates.find((t) => t.is_default && t.default_for === r.tipo_programa);
    const matchAny = docTemplates.find((t) => t.is_default && !t.default_for);
    setSelectedTemplate(
      (r.template_id && docTemplates.some((t) => t.id === r.template_id) ? r.template_id : null)
      ?? matchTipo?.id ?? matchAny?.id ?? docTemplates[0]?.id ?? "",
    );
  };

  const assertNotStale = async (r: Req) => {
    const { data, error } = await supabase.from("invoice_requests").select("updated_at").eq("id", r.id).single();
    if (error) { toast.error(error.message); return false; }
    if (data.updated_at !== r.updated_at) {
      toast.error("Esta solicitud se modificó mientras la revisabas. Actualiza los datos antes de continuar.");
      load();
      return false;
    }
    return true;
  };

  const confirmApproveUpload = async () => {
    if (!approving) return;
    const r = approving;
    if (!(await assertNotStale(r))) return;
    try {
      let pdfPath: string | null = null;
      let pdfBase64: string | undefined;
      if (approvalPdf) {
        const ext = approvalPdf.name.includes(".") ? approvalPdf.name.split(".").pop() : "bin";
        const path = `approved/${r.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("invoice-files")
          .upload(path, approvalPdf, { contentType: approvalPdf.type || "application/octet-stream", upsert: true });
        if (upErr) throw upErr;
        pdfPath = path;
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(approvalPdf);
        });
        pdfBase64 = dataUrl.split(",")[1];
      }
      const reciboNumero = manualReciboNumero.trim();
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("invoice_requests")
        .update({
          status: "aprobada",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          recibo_numero: reciboNumero,
          ...(pdfPath ? { approved_pdf_path: pdfPath } : {}),
        })
        .eq("id", r.id);
      if (error) throw error;
      toast.success(pdfPath ? "Solicitud aprobada con PDF adjunto" : "Solicitud aprobada");
      if (r.comercial_email) {
        try {
          await sendInvoiceEmail({ kind: "approved", comercial_email: r.comercial_email, nombre: r.nombre, recibo_numero: reciboNumero, pdfBase64 });
          toast.success("Notificación enviada al comercial");
        } catch (e) {
          toast.error("No se pudo enviar la notificación: " + (e instanceof Error ? e.message : ""));
        }
      } else {
        toast.message("Esta solicitud no tiene correo de comercial registrado — no se envió notificación");
      }
      setApproving(null);
      setApprovalPdf(null);
      setManualReciboNumero("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aprobar");
    }
  };

  const confirmApprove = async () => {
    if (!approving) return;
    const r = approving;
    if (!(await assertNotStale(r))) return;
    const tpl = templates.find((t) => t.id === selectedTemplate);
    const user = (await supabase.auth.getUser()).data.user;
    const reciboNumero = r.recibo_numero ?? String(Date.now() % 100000000);
    const today = new Date();
    const limite = r.fecha_limite_pago ?? new Date(today.getTime() + (tpl?.dias_limite ?? 4) * 86400000).toISOString().slice(0, 10);
    const extra = new Date(new Date(limite).getTime() + (tpl?.dias_extraordinario ?? 7) * 86400000).toISOString().slice(0, 10);

    const { error } = await supabase
      .from("invoice_requests")
      .update({
        status: "aprobada",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        recibo_numero: reciboNumero,
        fecha_limite_pago: limite,
        fecha_pago_extraordinario: extra,
        template_id: selectedTemplate || null,
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Solicitud aprobada");

    if (r.comercial_email) {
      try {
        const { getPdfBase64 } = await import("@/lib/generate-invoice-pdf");
        const approved = {
          ...reqToPdfData(r),
          recibo_numero: reciboNumero,
          fecha_limite_pago: limite,
          fecha_pago_extraordinario: extra,
          template_id: selectedTemplate || null,
        };
        const base64 = await getPdfBase64(approved);
        await sendInvoiceEmail({ kind: "approved", comercial_email: r.comercial_email, nombre: r.nombre, recibo_numero: reciboNumero, pdfBase64: base64 });
        toast.success("Notificación de aprobación enviada");
      } catch (e) {
        toast.error("No se pudo enviar la notificación: " + (e instanceof Error ? e.message : ""));
      }
    } else {
      toast.message("Esta solicitud no tiene correo de comercial registrado — no se envió notificación");
    }

    setApproving(null);
    load();
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (!rejectCategory) { toast.error("Selecciona el motivo del rechazo."); return; }
    if (rejectCategory === "Otra razón" && !rejectOtherText.trim()) {
      toast.error("Describe el motivo específico."); return;
    }
    if (!(await assertNotStale(rejecting))) return;
    const opt = REJECT_OPTIONS.find(o => o.category === rejectCategory);
    const extra = rejectOtherText.trim();
    const reason = rejectCategory === "Otra razón"
      ? `Otra razón — ${extra}`
      : `${rejectCategory} — ${opt?.description ?? ""}${extra ? ` · ${extra}` : ""}`;
    const { error } = await supabase
      .from("invoice_requests")
      .update({ status: "rechazada", rejection_reason: reason })
      .eq("id", rejecting.id);
    if (error) return toast.error(error.message);
    toast.success("Solicitud rechazada — el comercial puede corregirla y reenviarla");
    if (rejecting.comercial_email) {
      try {
        await sendInvoiceEmail({ kind: "rejected", comercial_email: rejecting.comercial_email, nombre: rejecting.nombre, recibo_numero: rejecting.recibo_numero, rejection_reason: reason });
        toast.success("Notificación enviada al comercial");
      } catch (e) {
        toast.error("No se pudo enviar la notificación: " + (e instanceof Error ? e.message : ""));
      }
    } else {
      toast.message("Esta solicitud no tiene correo de comercial registrado — no se envió notificación");
    }
    setRejecting(null);
    setRejectCategory("");
    setRejectOtherText("");
    load();
  };

  const removeRequest = async (r: Req) => {
    if (!confirm(`¿Eliminar definitivamente la factura de ${r.nombre}${r.recibo_numero ? ` (#${r.recibo_numero})` : ""}? Esto también borrará los archivos adjuntos.`)) return;
    await deleteInvoiceFiles(r.attachments, r.approved_pdf_path);
    const { error } = await supabase.from("invoice_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Factura eliminada");
    load();
  };

  const duplicar = (r: Req) => {
    window.location.href = `/solicitar?duplicar=${r.id}`;
  };

  const downloadPdf = async (r: Req) => {
    if (r.approved_pdf_path) {
      const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(r.approved_pdf_path, 60);
      if (error || !data) return toast.error(error?.message ?? "No se pudo descargar");
      window.open(data.signedUrl, "_blank");
      return;
    }
    const { generateInvoicePDF } = await import("@/lib/generate-invoice-pdf");
    await generateInvoicePDF(reqToPdfData(r));
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "No se pudo abrir");
    window.open(data.signedUrl, "_blank");
  };

  const reqToPdfData = (r: Req) => {
    const x = r as Req & {
      empresa?: string | null; nit?: string | null; direccion?: string | null;
      ciudad?: string | null; telefono?: string | null; pais?: string | null; nemonico?: string | null;
    };
    return {
      recibo_numero: r.recibo_numero, recibo_fecha: r.recibo_fecha, nombre: r.nombre,
      identificacion: r.identificacion, codigo_estudiante: r.codigo_estudiante,
      programa: r.programa, codigo_snies: r.codigo_snies, periodo: r.periodo,
      cohorte: r.cohorte, plan_estudio: r.plan_estudio, fecha_inicio: r.fecha_inicio,
      horas_programa: r.horas_programa, duracion: r.duracion, convocatoria: r.convocatoria,
      matricula: Number(r.matricula), descuento_pct: Number(r.descuento_pct ?? 0),
      descuento_bono: Number(r.descuento_bono ?? 0), valor_total: Number(r.valor_total ?? 0),
      valor_total_empresa: r.valor_total_empresa ? Number(r.valor_total_empresa) : null,
      numero_participantes: r.numero_participantes,
      participantes: r.participantes,
      recargo_total: Number(r.recargo_total), fecha_limite_pago: r.fecha_limite_pago,
      fecha_pago_extraordinario: r.fecha_pago_extraordinario, template_id: r.template_id,
      tipo_programa: r.tipo_programa, document_type: r.document_type, tipo_persona: r.tipo_persona,
      valor_parcial: r.valor_parcial,
      empresa: x.empresa ?? null, cliente_nit: x.nit ?? null, direccion: x.direccion ?? null,
      ciudad: x.ciudad ?? null, telefono: x.telefono ?? null, pais: x.pais ?? null,
      email: r.email, nemonico: x.nemonico ?? null, observaciones: r.observaciones,
      concepto: r.concepto,
    };
  };

  const openPdfPreview = async (r: Req) => {
    setPdfPreviewOpen(true);
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    setPdfPreviewName(`recibo-${r.recibo_numero ?? "borrador"}-${r.identificacion}.pdf`);
    try {
      if (r.approved_pdf_path) {
        const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(r.approved_pdf_path, 300);
        if (error || !data) throw error ?? new Error("no signed url");
        setPdfPreviewUrl(data.signedUrl);
        return;
      }
      const { getInvoicePdfDataUrl } = await import("@/lib/generate-invoice-pdf");
      const url = await getInvoicePdfDataUrl(reqToPdfData(r));
      setPdfPreviewUrl(url);
    } catch (err) {
      console.error("Error generando vista previa PDF:", err);
      toast.error("No se pudo generar la vista previa");
      setPdfPreviewOpen(false);
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bandeja de solicitudes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todas las solicitudes en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/programas"><Button variant="outline" size="sm"><BookOpen className="mr-2 h-4 w-4" /> Programas</Button></Link>
          <Link href="/admin/numeracion"><Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> Numeración</Button></Link>
          <Button variant="outline" size="sm" onClick={() => load()}>Actualizar</Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por estudiante, recibo o asesor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          {dateFrom && <Button variant="ghost" size="sm" onClick={() => setDateFrom("")}>×</Button>}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Sin resultados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const alertN = cedAlerts.get(r.identificacion);
              return (
                <div key={r.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setPreviewing(r)} className="truncate font-semibold text-foreground hover:underline text-left">
                          {r.nombre}
                        </button>
                        <StatusBadge s={r.status} />
                        {r.recibo_numero && <span className="text-xs font-mono text-muted-foreground">#{r.recibo_numero}</span>}
                        {r.parent_id && (
                          isCorrectionOfApproved(r)
                            ? <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Corrección solicitada</Badge>
                            : <Badge variant="outline" className="text-xs">Relanzada</Badge>
                        )}
                        {alertN && alertN >= 2 && (
                          <Badge variant="destructive" className="gap-1" title={`${alertN} facturas con esta cédula en los últimos 7 días`}>
                            <AlertTriangle className="h-3 w-3" /> {alertN} en 7 días
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{DOC_TYPE_LABELS[r.document_type ?? ""] ?? r.document_type ?? "—"}</span>
                        {" · "}ID {r.identificacion} · {r.concepto ?? "Matrícula"} · {r.tipo_programa ?? ""} {r.programa} · {r.periodo}
                      </p>
                      {r.comercial_nombre && (
                        <p className="text-xs text-muted-foreground">Comercial: {r.comercial_nombre} ({r.comercial_email})</p>
                      )}
                      {r.asesor_nombre && (
                        <p className="text-xs text-muted-foreground">Asesor: {r.asesor_nombre}</p>
                      )}
                      {r.observaciones && (
                        <p className="mt-2 rounded bg-muted px-2 py-1 text-xs text-foreground">Obs: {r.observaciones}</p>
                      )}
                      {r.status === "rechazada" && r.rejection_reason && (
                        <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">Motivo: {r.rejection_reason}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Enviada {formatDate(r.created_at)}
                        {r.approved_at && ` · Aprobada ${formatDate(r.approved_at)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Valor a pagar</p>
                      <p className="text-lg font-bold text-foreground">{formatCOP(r.valor_total_empresa ?? r.valor_total)}</p>
                      <p className="text-xs text-muted-foreground">
                        Valor {formatCOP(r.matricula)} · Desc. {Number(r.descuento_pct ?? 0)}%
                        {Number(r.descuento_bono ?? 0) > 0 && ` · Bono ${formatCOP(r.descuento_bono)}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    {!isCartera && canApprove && (r.status === "pendiente" || r.status === "requiere_info") && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => openApprove(r)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                        </Button>
                        <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white border-0" onClick={() => {
                          setRejecting(r);
                          const existing = r.rejection_reason ?? "";
                          const match = REJECT_OPTIONS.find(o => existing.startsWith(o.category));
                          if (match) {
                            setRejectCategory(match.category);
                            if (match.category === "Otra razón") {
                              setRejectOtherText(existing.replace("Otra razón — ", ""));
                            } else {
                              const prefix = `${match.category} — ${match.description ?? ""}`;
                              const rest = existing.startsWith(prefix) ? existing.slice(prefix.length) : "";
                              setRejectOtherText(rest.startsWith(" · ") ? rest.slice(3) : "");
                            }
                          } else if (existing) {
                            setRejectCategory("Otra razón");
                            setRejectOtherText(existing);
                          } else {
                            setRejectCategory(""); setRejectOtherText("");
                          }
                        }}>
                          <XCircle className="mr-2 h-4 w-4" /> Rechazar
                        </Button>

                      </>
                    )}
                    {(r.document_type === "orden_matricula" || r.document_type === "factura_usa") && (
                      <Button size="sm" variant="outline" className="border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-blue-600 hover:text-white" onClick={() => openPdfPreview(r)}>
                        <Eye className="mr-2 h-4 w-4" /> Ver PDF
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-blue-600 hover:text-white" onClick={() => setPreviewing(r)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver Datos
                    </Button>
                    {!isCartera && (
                      <Link href={`/solicitar?id=${r.id}`}>
                        <Button size="sm" variant="outline" className="border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-indigo-600 hover:text-white">
                          {r.status === "aprobada"
                            ? <><Wrench className="mr-2 h-4 w-4" /> Corregir</>
                            : <><Pencil className="mr-2 h-4 w-4" /> Editar</>}
                        </Button>
                      </Link>
                    )}
                    {r.status === "aprobada" && (
                      <Button size="sm" variant="outline" className="border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-blue-600 hover:text-white" onClick={() => downloadPdf(r)}>
                        <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                      </Button>
                    )}
                    {!isCartera && r.status === "aprobada" && (
                      <Button size="sm" variant="outline" className="border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-slate-600 hover:text-white" onClick={() => duplicar(r)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicar
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" className="ml-auto bg-red-800 hover:bg-red-900 text-white border-0" onClick={() => removeRequest(r)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aprobar */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Solicitud</DialogTitle>
          </DialogHeader>
          {isUploadFlow(approving) ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ingresa el consecutivo con el que salió la factura en la plataforma externa. Puedes adjuntar el PDF si lo tienes disponible.
              </p>
              {approving?.attachments && (approving.attachments as {path:string;name:string}[]).length > 0 && (
                <div className="rounded border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Adjuntos del comercial:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {(approving.attachments as {path:string;name:string}[]).map((a) => (
                      <li key={a.path}>
                        <button type="button" className="text-primary hover:underline" onClick={() => openAttachment(a.path)}>{a.name}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">N° Consecutivo *</label>
                <Input
                  type={approving?.document_type === "factura_colombia" ? "text" : "number"}
                  min={approving?.document_type === "factura_colombia" ? undefined : 1}
                  placeholder={approving?.document_type === "factura_colombia" ? "Ej: FC-1042" : "Ej: 1042"}
                  value={manualReciboNumero}
                  onChange={(e) => setManualReciboNumero(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {approving?.document_type === "factura_colombia"
                    ? "Puede incluir letras y números. Quedará registrado en la sección Numeración."
                    : "Quedará registrado en la sección Numeración."}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Sube aquí tu factura *</label>
                <Input type="file" onChange={(e) => setApprovalPdf(e.target.files?.[0] ?? null)} />
                {approvalPdf && <p className="text-xs text-muted-foreground">{approvalPdf.name} · {(approvalPdf.size / 1024).toFixed(0)} KB</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproving(null)}>Cancelar</Button>
                <Button onClick={confirmApproveUpload} disabled={!manualReciboNumero.trim() || !approvalPdf}>Aprobar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Elige la plantilla con la que se generará el PDF para <strong>{approving?.nombre}</strong>.
              </p>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Plantilla" /></SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => getTemplateDocType(t) === approving?.document_type)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id!}>
                        {t.nombre}{t.is_default && (t.default_for ? ` · default ${t.default_for}` : " · default")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproving(null)}>Cancelar</Button>
                <Button onClick={confirmApprove} disabled={!selectedTemplate}>Aprobar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setRejectCategory(""); setRejectOtherText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">Selecciona el motivo — el comercial lo verá con la explicación completa.</p>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {REJECT_OPTIONS.map((opt) => (
              <label
                key={opt.category}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${rejectCategory === opt.category ? "border-destructive bg-destructive/5" : "hover:bg-muted/50"}`}
              >
                <input
                  type="radio"
                  name="rejectCategory"
                  value={opt.category}
                  checked={rejectCategory === opt.category}
                  onChange={() => { setRejectCategory(opt.category); setRejectOtherText(""); }}
                  className="mt-0.5 accent-destructive"
                />
                <div>
                  <p className="text-sm font-medium leading-tight">{opt.category}</p>
                  {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
                </div>
              </label>
            ))}
            {rejectCategory && (
              <Textarea
                rows={3}
                value={rejectOtherText}
                onChange={(e) => setRejectOtherText(e.target.value)}
                placeholder={rejectCategory === "Otra razón" ? "Describe el motivo específico..." : "Agrega detalles adicionales para el comercial (opcional)..."}
                className="mt-1"
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setRejectCategory(""); setRejectOtherText(""); }}>Cancelar</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white border-0" onClick={confirmReject} disabled={!rejectCategory || (rejectCategory === "Otra razón" && !rejectOtherText.trim())}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver Datos */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto p-0 gap-0">
          {previewing && (() => {
            const isPersonaFlow = previewing.document_type !== "orden_matricula";
            const isJuridica = previewing.tipo_persona === "Persona Jurídica";
            const participantes = previewing.participantes ?? [];
            return (
              <>
                <DialogHeader className="px-6 py-4 border-b border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle>{previewing.nombre}</DialogTitle>
                    <StatusBadge s={previewing.status} />
                    {previewing.recibo_numero && (
                      <span className="text-xs font-mono text-muted-foreground">#{previewing.recibo_numero}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {DOC_TYPE_LABELS[previewing.document_type ?? ""] ?? previewing.document_type ?? "—"}
                  </p>
                </DialogHeader>

                <div className="space-y-7 px-8 py-6">
                  <DetailSection title={isPersonaFlow ? "Datos del tercero" : "Datos del estudiante"}>
                    {isPersonaFlow && (
                      <div className="sm:col-span-2">
                        <span className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          isJuridica ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700",
                        )}>
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
                    <PreviewRow label="Asesor Comercial" value={previewing.asesor_nombre ?? "—"} />
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
                        <p className="text-xs uppercase tracking-wider text-destructive">Motivo de rechazo</p>
                        <p className="mt-0.5 text-destructive">{previewing.rejection_reason}</p>
                      </div>
                    )}
                  </DetailSection>

                  {((previewing.attachments && previewing.attachments.length > 0) || previewing.approved_pdf_path) && (
                    <DetailSection title="Adjuntos" noGrid>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {previewing.attachments?.map((a) => (
                          <button
                            key={a.path}
                            type="button"
                            onClick={() => openAttachment(a.path)}
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.name}</span>
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
                  )}
                </div>
              </>
            );
          })()}
          <DialogFooter className="px-6 py-3 border-t border-border">
            <Button variant="outline" onClick={() => setPreviewing(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver PDF */}
      <Dialog open={pdfPreviewOpen} onOpenChange={(o) => { if (!o) { setPdfPreviewOpen(false); setPdfPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Ver PDF — {pdfPreviewName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewLoading ? (
              <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
                Generando vista previa…
              </div>
            ) : pdfPreviewUrl ? (
              <iframe src={pdfPreviewUrl} title="Ver PDF" className="h-full w-full border-0" />
            ) : null}
          </div>
          <DialogFooter className="px-6 py-3 border-t border-border shrink-0">
            {pdfPreviewUrl && (
              <a href={pdfPreviewUrl} download={pdfPreviewName}>
                <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Descargar</Button>
              </a>
            )}
            <Button variant="outline" onClick={() => { setPdfPreviewOpen(false); setPdfPreviewUrl(null); }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function DetailSection({ title, children, noGrid }: { title: string; children: ReactNode; noGrid?: boolean }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-4">
        {title}
      </h3>
      {noGrid ? children : <div className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">{children}</div>}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-[15px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pendiente: { label: "Pendiente", variant: "secondary" },
    aprobada: { label: "Aprobada", variant: "default" },
    rechazada: { label: "Rechazada", variant: "destructive" },
    requiere_info: { label: "Requiere info", variant: "outline" },
  };
  const m = map[s];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
