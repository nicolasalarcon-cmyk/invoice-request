"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  FileText, Trash2, Eye, Copy, BookOpen,
} from "lucide-react";
import { listTemplates, type InvoiceTemplate } from "@/lib/invoice-template";

type Status = "pendiente" | "aprobada" | "rechazada" | "requiere_info";
type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

interface AttachmentItem { path: string; name: string; size: number; type: string }

interface Req {
  id: string;
  status: Status;
  document_type: DocType | null;
  nombre: string;
  identificacion: string;
  email: string | null;
  codigo_estudiante: string | null;
  programa: string;
  codigo_snies: string | null;
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
  participantes: { nombre: string; cedula: string; email: string; telefono: string }[] | null;
  recargo_total: number;
  fecha_limite_pago: string | null;
  fecha_pago_extraordinario: string | null;
  recibo_numero: number | null;
  recibo_fecha: string;
  approved_at: string | null;
  created_at: string;
  rejection_reason: string | null;
  info_requested: string | null;
  comercial_nombre: string | null;
  comercial_email: string | null;
  template_id: string | null;
  parent_id: string | null;
  attachments: AttachmentItem[] | null;
  approved_pdf_path: string | null;
}

const isUploadFlow = (r: Req | null) =>
  r?.document_type === "factura_colombia" || r?.document_type === "factura_paypal";

async function sendInvoiceEmail(data: {
  to: string; cc?: string | null; nombre: string; recibo_numero: number | null; pdfBase64: string;
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
  const { isAdmin, loading: authLoading } = useAuth();
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
  const [rejectReason, setRejectReason] = useState("");
  const [previewing, setPreviewing] = useState<Req | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState("");
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, tpls] = await Promise.all([
      supabase.from("invoice_requests").select("*").order("created_at", { ascending: false }),
      listTemplates(),
    ]);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Req[]);
    setTemplates(tpls);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("invoice_requests_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

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
      if (new Date(r.created_at).getTime() < weekAgo) return;
      const arr = byCed.get(r.identificacion) ?? [];
      arr.push(r);
      byCed.set(r.identificacion, arr);
    });
    const out = new Map<string, number>();
    byCed.forEach((arr, ced) => { if (arr.length >= 2) out.set(ced, arr.length); });
    return out;
  }, [items]);

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
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Tu cuenta no tiene rol de administrador.</p>
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
    const matchTipo = templates.find((t) => t.is_default && t.default_for === r.tipo_programa);
    const matchAny = templates.find((t) => t.is_default && !t.default_for);
    setSelectedTemplate(r.template_id ?? matchTipo?.id ?? matchAny?.id ?? templates[0]?.id ?? "");
  };

  const confirmApproveUpload = async () => {
    if (!approving) return;
    const r = approving;
    try {
      let pdfPath: string | null = null;
      if (approvalPdf) {
        const ext = approvalPdf.name.includes(".") ? approvalPdf.name.split(".").pop() : "bin";
        const path = `approved/${r.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("invoice-files")
          .upload(path, approvalPdf, { contentType: approvalPdf.type || "application/octet-stream", upsert: true });
        if (upErr) throw upErr;
        pdfPath = path;
      }
      const reciboNumero = Number(manualReciboNumero);
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
    const tpl = templates.find((t) => t.id === selectedTemplate);
    const user = (await supabase.auth.getUser()).data.user;
    const reciboNumero = r.recibo_numero ?? Date.now() % 100000000;
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

    if (r.email) {
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
        await sendInvoiceEmail({ to: r.email, cc: r.comercial_email ?? null, nombre: r.nombre, recibo_numero: reciboNumero, pdfBase64: base64 });
        toast.success("Recibo enviado al estudiante y al asesor por correo");
      } catch (e) {
        toast.error("No se pudo enviar el correo al estudiante: " + (e instanceof Error ? e.message : ""));
      }
    } else {
      toast.message("El estudiante no tiene correo registrado — no se envió email");
    }

    setApproving(null);
    load();
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) { toast.error("Escribe el motivo del rechazo."); return; }
    const { error } = await supabase
      .from("invoice_requests")
      .update({ status: "rechazada", rejection_reason: rejectReason.trim() })
      .eq("id", rejecting.id);
    if (error) return toast.error(error.message);
    toast.success("Solicitud rechazada — el comercial puede corregirla y reenviarla");
    setRejecting(null);
    load();
  };

  const removeRequest = async (r: Req) => {
    if (!confirm(`¿Eliminar definitivamente la factura de ${r.nombre}${r.recibo_numero ? ` (#${r.recibo_numero})` : ""}?`)) return;
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
      tipo_programa: r.tipo_programa, document_type: r.document_type,
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
    } catch {
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
          <Button variant="outline" size="sm" onClick={load}>Actualizar</Button>
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
                        {r.parent_id && <Badge variant="outline" className="text-xs">Relanzada</Badge>}
                        {alertN && alertN >= 2 && (
                          <Badge variant="destructive" className="gap-1" title={`${alertN} facturas con esta cédula en los últimos 7 días`}>
                            <AlertTriangle className="h-3 w-3" /> {alertN} en 7 días
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        ID {r.identificacion} · {r.concepto ?? "Matrícula"} · {r.tipo_programa ?? ""} {r.programa} · {r.periodo}
                      </p>
                      {r.comercial_nombre && (
                        <p className="text-xs text-muted-foreground">Comercial: {r.comercial_nombre} ({r.comercial_email})</p>
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
                    <Button size="sm" variant="ghost" onClick={() => setPreviewing(r)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver
                    </Button>
                    <Link href={`/solicitar?id=${r.id}`}>
                      <Button size="sm" variant="ghost"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                    </Link>
                    {(r.status === "pendiente" || r.status === "requiere_info") && (
                      <>
                        <Button size="sm" onClick={() => openApprove(r)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejecting(r); setRejectReason(r.rejection_reason ?? ""); }}>
                          <XCircle className="mr-2 h-4 w-4" /> Rechazar
                        </Button>
                      </>
                    )}
                    {(r.document_type === "orden_matricula" || r.document_type === "factura_usa") && (
                      <Button size="sm" variant="secondary" onClick={() => openPdfPreview(r)}>
                        <Eye className="mr-2 h-4 w-4" /> Vista previa PDF
                      </Button>
                    )}
                    {r.status === "aprobada" && (
                      <>
                        <Button size="sm" onClick={() => downloadPdf(r)}>
                          <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => duplicar(r)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="destructive" className="ml-auto" onClick={() => removeRequest(r)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </Button>
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
                  type="number"
                  min={1}
                  placeholder="Ej: 1042"
                  value={manualReciboNumero}
                  onChange={(e) => setManualReciboNumero(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Quedará registrado en la sección Numeración.</p>
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
                  {templates.map((t) => (
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
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar solicitud</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Explica al comercial qué debe corregir.</p>
          <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ej: El valor de la matrícula no coincide con el programa, corrige y reenvía." autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vista previa */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle de la solicitud</DialogTitle></DialogHeader>
          {previewing && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <PreviewRow label="Estudiante" value={previewing.nombre} />
              <PreviewRow label="Identificación" value={previewing.identificacion} />
              <PreviewRow label="Correo" value={previewing.email ?? "—"} />
              <PreviewRow label="Concepto" value={previewing.concepto ?? "—"} />
              <PreviewRow label="Tipo de programa" value={previewing.tipo_programa ?? "—"} />
              <PreviewRow label="Programa" value={previewing.programa} />
              <PreviewRow label="SNIES" value={previewing.codigo_snies ?? "—"} />
              <PreviewRow label="Cohorte" value={previewing.cohorte ?? "—"} />
              <PreviewRow label="Plan de estudio" value={previewing.plan_estudio ?? "—"} />
              <PreviewRow label="Periodo" value={previewing.periodo} />
              <PreviewRow label="Fecha inicio" value={previewing.fecha_inicio ?? "—"} />
              <PreviewRow label="Fecha fin" value={previewing.fecha_fin ?? "—"} />
              <PreviewRow label="Horas / duración" value={String(previewing.horas_programa ?? "—")} />
              <PreviewRow label="Matrícula" value={formatCOP(previewing.matricula)} />
              <PreviewRow label="Descuento %" value={`${previewing.descuento_pct}%`} />
              <PreviewRow label="Descuento bono" value={formatCOP(previewing.descuento_bono ?? 0)} />
              <PreviewRow label="Valor total" value={formatCOP(previewing.valor_total)} />
              <PreviewRow label="Recargo" value={formatCOP(previewing.recargo_total)} />
              <PreviewRow label="Límite de pago" value={previewing.fecha_limite_pago ?? "—"} />
              <PreviewRow label="Pago extraordinario" value={previewing.fecha_pago_extraordinario ?? "—"} />
              <PreviewRow label="N° Recibo" value={previewing.recibo_numero ? `#${previewing.recibo_numero}` : "—"} />
              <PreviewRow label="Estado" value={previewing.status} />
              <PreviewRow label="Comercial" value={`${previewing.comercial_nombre ?? "—"} (${previewing.comercial_email ?? "—"})`} />
              <PreviewRow label="Creada" value={formatDate(previewing.created_at)} />
              {previewing.observaciones && <div className="sm:col-span-2"><PreviewRow label="Observaciones" value={previewing.observaciones} /></div>}
              {previewing.rejection_reason && <div className="sm:col-span-2"><PreviewRow label="Motivo rechazo" value={previewing.rejection_reason} /></div>}
              {previewing.attachments && previewing.attachments.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Adjuntos del comercial</p>
                  <ul className="mt-1 space-y-1">
                    {previewing.attachments.map((a) => (
                      <li key={a.path}>
                        <button type="button" className="text-sm text-primary hover:underline" onClick={() => openAttachment(a.path)}>
                          📎 {a.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {previewing.approved_pdf_path && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">PDF oficial aprobado</p>
                  <button type="button" className="mt-1 text-sm text-primary hover:underline" onClick={() => openAttachment(previewing.approved_pdf_path!)}>
                    📄 Ver PDF aprobado
                  </button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewing(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vista previa PDF */}
      <Dialog open={pdfPreviewOpen} onOpenChange={(o) => { if (!o) { setPdfPreviewOpen(false); setPdfPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Vista previa — {pdfPreviewName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewLoading ? (
              <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
                Generando vista previa…
              </div>
            ) : pdfPreviewUrl ? (
              <iframe src={pdfPreviewUrl} title="Vista previa PDF" className="h-full w-full border-0" />
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-foreground">{value}</p>
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
