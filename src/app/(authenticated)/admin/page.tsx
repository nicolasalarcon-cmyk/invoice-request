"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import {
  AlertTriangle, CheckCircle2, XCircle, FileDown, Inbox, Search, Pencil,
  FileText, Trash2, Eye, Copy, Wrench, ArrowLeft,
  Receipt, Globe, Landmark, Wallet, Calendar, X,
  type LucideIcon,
} from "lucide-react";
import { listTemplates, getTemplateDocType, type InvoiceTemplate } from "@/lib/invoice-template";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { deleteInvoiceFiles } from "@/lib/delete-invoice-files";
import { cn } from "@/lib/utils";
import { DetailSection, PreviewRow } from "@/components/solicitudes/detail-panel";

type Status = "pendiente" | "aprobada" | "rechazada" | "corregida";

const CORRECTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const withinCorrectionWindow = (approvedAt: string | null) =>
  !!approvedAt && Date.now() - new Date(approvedAt).getTime() < CORRECTION_WINDOW_MS;
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
  numero_inscripcion: string | null;
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
  valor_por_estudiante: number | null;
  lista_cerrada: boolean;
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
  approved_pdf_name: string | null;
  archived_by_comercial: boolean;
  archived_by_reviewer: boolean;
  created_by: string | null;
  created_by_role: string | null;
}

const isUploadFlow = (r: Req | null) =>
  r?.document_type === "factura_colombia" || r?.document_type === "factura_paypal";

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

const DOC_TYPE_LABELS: Record<string, string> = {
  orden_matricula: "Orden de Matrícula",
  factura_usa: "Factura USA",
  factura_colombia: "Factura Colombia",
  factura_paypal: "Factura PayPal",
};

const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  orden_matricula: Receipt,
  factura_usa: Globe,
  factura_colombia: Landmark,
  factura_paypal: Wallet,
};

const CREATOR_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrador",
  admin: "Administrador",
  financiera: "Financiera",
  cartera: "Cartera",
  comercial: "Líder Comercial",
};

const STATUS_PILL: Record<Status, string> = {
  pendiente: "bg-amber-50 text-amber-700",
  aprobada: "bg-emerald-50 text-emerald-700",
  rechazada: "bg-rose-50 text-rose-700",
  corregida: "bg-blue-50 text-blue-700",
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
  const { user, role, isCartera, canApprove, canDelete, canViewAllRequests, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [tipoFilter, setTipoFilter] = useState<"all" | DocType>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [approving, setApproving] = useState<Req | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [approvalPdf, setApprovalPdf] = useState<File | null>(null);
  const [manualReciboNumero, setManualReciboNumero] = useState<string>("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalImages, setApprovalImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [rejectCategory, setRejectCategory] = useState("");
  const [rejectOtherText, setRejectOtherText] = useState("");
  const [previewing, setPreviewing] = useState<Req | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState("");
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [responseViewOpen, setResponseViewOpen] = useState(false);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseNotesText, setResponseNotesText] = useState("");
  const [responseImages, setResponseImages] = useState<{ name: string; url: string }[]>([]);

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

  useEffect(() => {
    const handler = () => setPreviewing(null);
    window.addEventListener("app:reset-inbox", handler);
    return () => window.removeEventListener("app:reset-inbox", handler);
  }, []);

  useLiveRefresh("invoice_requests_inbox", () => load(true), canViewAllRequests);

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

  // No notificar cuando quien creó la solicitud es un rol interno
  // (admin/super_admin/financiera) probando por su cuenta — solo tiene
  // sentido avisar cuando quien la creó fue un comercial de verdad.
  const shouldNotify = (r: Req) =>
    !!r.comercial_email
    && r.created_by_role !== "admin"
    && r.created_by_role !== "super_admin"
    && r.created_by_role !== "financiera";

  // Base visible para el rol actual, antes de aplicar el filtro de estado —
  // sirve tanto para la lista final como para los contadores de cada chip.
  const visibleForRole = useMemo(() => {
    const s = q.toLowerCase().trim();
    return items.filter((r) => {
      // "Eliminar" de Financiera/Cartera solo oculta de su propia vista,
      // no afecta lo que ve Admin/SuperAdmin.
      if (r.archived_by_reviewer && (role === "financiera" || role === "cartera")) return false;
      if (!s) return true;
      return (
        r.nombre.toLowerCase().includes(s) ||
        r.identificacion.includes(s) ||
        String(r.recibo_numero ?? "").includes(s) ||
        (r.comercial_nombre ?? "").toLowerCase().includes(s) ||
        (r.comercial_email ?? "").toLowerCase().includes(s) ||
        (r.asesor_nombre ?? "").toLowerCase().includes(s) ||
        (r.programa ?? "").toLowerCase().includes(s) ||
        (r.tipo_programa ?? "").toLowerCase().includes(s) ||
        (r.concepto ?? "").toLowerCase().includes(s) ||
        (DOC_TYPE_LABELS[r.document_type ?? ""] ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, q, role]);

  const statusCounts = useMemo(() => ({
    all: visibleForRole.length,
    pendiente: visibleForRole.filter((r) => r.status === "pendiente").length,
    aprobada: visibleForRole.filter((r) => r.status === "aprobada").length,
    corregida: visibleForRole.filter((r) => r.status === "corregida").length,
    rechazada: visibleForRole.filter((r) => r.status === "rechazada").length,
  }), [visibleForRole]);

  // Cuántas solicitudes pendientes hay de cada tipo de documento — para el
  // filtro por tipo, así se ve de un vistazo dónde hay trabajo por hacer.
  const tipoPendingCounts = useMemo(() => {
    const counts: Partial<Record<DocType, number>> = {};
    visibleForRole.forEach((r) => {
      if (r.status !== "pendiente" || !r.document_type) return;
      counts[r.document_type] = (counts[r.document_type] ?? 0) + 1;
    });
    return counts;
  }, [visibleForRole]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    return visibleForRole.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tipoFilter !== "all" && r.document_type !== tipoFilter) return false;
      if (fromTs && new Date(r.created_at).getTime() < fromTs) return false;
      return true;
    });
  }, [visibleForRole, statusFilter, tipoFilter, dateFrom]);

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
    setApprovalNotes("");
    approvalImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setApprovalImages([]);
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

  const handleNotesPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length === 0) return;
    e.preventDefault();
    setApprovalImages((prev) => [
      ...prev,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removeApprovalImage = (index: number) => {
    setApprovalImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const openRejectDialog = (r: Req) => {
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

  // Al aprobar (definitivamente) una solicitud que viene de una corrección,
  // los archivos de la solicitud anterior (rechazada) ya cumplieron su función
  // de soporte durante la revisión — se eliminan de Storage y de la base para
  // no acumular versiones viejas, dejando solo los últimos archivos subidos.
  const purgeSupersededAttachments = async (r: Req) => {
    if (!r.parent_id) return;
    const parent = itemsById.get(r.parent_id);
    if (!parent) return;
    // Al corregir una solicitud ya aprobada, los adjuntos que no se
    // reemplazan quedan cargados con la MISMA ruta de Storage que el
    // "padre". Si se borraran igual, la solicitud corregida (ya vigente)
    // se quedaría con referencias a archivos que ya no existen. Por eso
    // solo se borran las rutas del padre que el hijo ya no usa.
    const childPaths = new Set([
      ...(r.attachments ?? []).map((a) => a.path),
      ...(r.approved_pdf_path ? [r.approved_pdf_path] : []),
    ]);
    const paths = [
      ...(parent.attachments ?? []).map((a) => a.path),
      ...(parent.approved_pdf_path ? [parent.approved_pdf_path] : []),
    ].filter((p) => !childPaths.has(p));
    if (paths.length > 0) {
      await supabase.storage.from("invoice-files").remove(paths).catch(() => {});
    }
    await supabase.from("invoice_requests").update({ attachments: [], approved_pdf_path: null, approved_pdf_name: null }).eq("id", parent.id);
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
      const uploadedNoteImages: AttachmentItem[] = [];
      for (let i = 0; i < approvalImages.length; i++) {
        const { file } = approvalImages[i];
        const ext = file.name.includes(".") ? file.name.split(".").pop() : (file.type.split("/")[1] || "png");
        const path = `approved/${r.id}-nota-${i}.${ext}`;
        const { error: imgErr } = await supabase.storage
          .from("invoice-files")
          .upload(path, file, { contentType: file.type || "image/png", upsert: true });
        if (imgErr) throw imgErr;
        uploadedNoteImages.push({ path, name: `Nota de aprobación — imagen ${i + 1}.${ext}`, size: file.size, type: file.type });
      }
      const notesText = approvalNotes.trim();
      let reciboNumero = manualReciboNumero.trim();
      if (!reciboNumero && r.document_type === "factura_paypal") {
        const { count, error: countError } = await supabase
          .from("invoice_requests")
          .select("id", { count: "exact", head: true })
          .eq("document_type", "factura_paypal")
          .not("recibo_numero", "is", null)
          .neq("recibo_numero", "");
        if (countError) throw countError;
        reciboNumero = String((count ?? 0) + 1);
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("invoice_requests")
        .update({
          status: isCorrectionOfApproved(r) ? "corregida" : "aprobada",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          recibo_numero: reciboNumero,
          ...(pdfPath ? { approved_pdf_path: pdfPath, approved_pdf_name: approvalPdf!.name } : {}),
          ...(uploadedNoteImages.length > 0 ? { attachments: [...(r.attachments ?? []), ...uploadedNoteImages] as any } : {}),
          ...(notesText ? { observaciones: [r.observaciones, `📎 Nota de aprobación (PayPal): ${notesText}`].filter(Boolean).join("\n\n") } : {}),
        })
        .eq("id", r.id);
      if (error) throw error;
      await purgeSupersededAttachments(r);
      toast.success(pdfPath ? "Solicitud aprobada con PDF adjunto" : "Solicitud aprobada");
      if (shouldNotify(r)) {
        try {
          await sendInvoiceEmail({ kind: "approved", comercial_email: r.comercial_email!, nombre: r.nombre, recibo_numero: reciboNumero, pdfBase64 });
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
      setApprovalNotes("");
      approvalImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setApprovalImages([]);
      setPreviewing((p) => p?.id === r.id ? null : p);
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
    const reciboFecha = today.toISOString().slice(0, 10);
    const limite = r.fecha_limite_pago ?? new Date(today.getTime() + (tpl?.dias_limite ?? 4) * 86400000).toISOString().slice(0, 10);
    const extra = new Date(new Date(limite).getTime() + (tpl?.dias_extraordinario ?? 7) * 86400000).toISOString().slice(0, 10);

    const notesText = approvalNotes.trim();
    const { error } = await supabase
      .from("invoice_requests")
      .update({
        status: isCorrectionOfApproved(r) ? "corregida" : "aprobada",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        recibo_numero: reciboNumero,
        recibo_fecha: reciboFecha,
        fecha_limite_pago: limite,
        fecha_pago_extraordinario: extra,
        template_id: selectedTemplate || null,
        ...(notesText ? { observaciones: [r.observaciones, `📎 Nota de aprobación: ${notesText}`].filter(Boolean).join("\n\n") } : {}),
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await purgeSupersededAttachments(r);
    toast.success("Solicitud aprobada");

    if (shouldNotify(r)) {
      try {
        const { getPdfBase64 } = await import("@/lib/generate-invoice-pdf");
        const approved = {
          ...reqToPdfData(r),
          recibo_numero: reciboNumero,
          recibo_fecha: reciboFecha,
          fecha_limite_pago: limite,
          fecha_pago_extraordinario: extra,
          template_id: selectedTemplate || null,
        };
        const base64 = await getPdfBase64(approved);
        await sendInvoiceEmail({ kind: "approved", comercial_email: r.comercial_email!, nombre: r.nombre, recibo_numero: reciboNumero, pdfBase64: base64 });
        toast.success("Notificación de aprobación enviada");
      } catch (e) {
        toast.error("No se pudo enviar la notificación: " + (e instanceof Error ? e.message : ""));
      }
    } else {
      toast.message("Esta solicitud no tiene correo de comercial registrado — no se envió notificación");
    }

    setApproving(null);
    setApprovalNotes("");
    setPreviewing((p) => p?.id === r.id ? null : p);
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
    if (shouldNotify(rejecting)) {
      try {
        await sendInvoiceEmail({ kind: "rejected", comercial_email: rejecting.comercial_email!, nombre: rejecting.nombre, recibo_numero: rejecting.recibo_numero, rejection_reason: reason });
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
    setPreviewing((p) => p?.id === rejecting.id ? null : p);
    load();
  };

  const removeRequest = async (r: Req) => {
    if (!confirm(`¿Eliminar definitivamente la factura de ${r.nombre}${r.recibo_numero ? ` (#${r.recibo_numero})` : ""}? Esto también borrará los archivos adjuntos.`)) return;
    await deleteInvoiceFiles(r.attachments, r.approved_pdf_path);
    const { error } = await supabase.from("invoice_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Factura eliminada");
    setPreviewing((p) => p?.id === r.id ? null : p);
    load();
  };

  // "Eliminar" para Financiera/Cartera: solo oculta de su propia vista
  // (no borra nada, ni afecta lo que ve Admin/SuperAdmin ni el comercial).
  const hideForReviewer = async (r: Req) => {
    if (!confirm(`¿Ocultar la solicitud de ${r.nombre} de tu bandeja? Seguirá visible para Admin.`)) return;
    const { data, error } = await supabase
      .from("invoice_requests")
      .update({ archived_by_reviewer: true })
      .eq("id", r.id)
      .select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      toast.error("No se pudo ocultar la solicitud (permisos).");
      return;
    }
    setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, archived_by_reviewer: true } : x));
    setPreviewing((p) => p?.id === r.id ? null : p);
    toast.success("Solicitud ocultada de tu bandeja");
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
    if (isUploadFlow(r)) {
      toast.error("Esta solicitud no tiene un PDF adjunto.");
      return;
    }
    const { generateInvoicePDF } = await import("@/lib/generate-invoice-pdf");
    await generateInvoicePDF(reqToPdfData(r));
  };

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
      valor_por_estudiante: r.valor_por_estudiante ? Number(r.valor_por_estudiante) : null,
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

      <div className="mt-3">
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
              const alertN = cedAlerts.get(r.identificacion);
              return (
                <div
                  key={r.id}
                  onClick={() => setPreviewing(r)}
                  className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:bg-muted/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
                >
                  {/* Caja de información e identidad */}
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="block truncate text-lg font-bold text-foreground">{r.nombre}</span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_PILL[r.status])}>
                          {r.status === "pendiente" ? "Pendiente" : r.status === "aprobada" ? "Aprobada" : r.status === "corregida" ? "Corregida" : "Rechazada"}
                        </span>
                        {r.recibo_numero && <span className="text-sm font-mono text-muted-foreground">#{r.recibo_numero}</span>}
                        {r.parent_id && (
                          isCorrectionOfApproved(r)
                            ? <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Corrección solicitada</span>
                            : <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">Relanzada</span>
                        )}
                        {alertN && alertN >= 2 && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700" title={`${alertN} facturas con esta cédula en los últimos 7 días`}>
                            <AlertTriangle className="h-3 w-3" /> {alertN} en 7 días
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
                        <span className="font-bold text-foreground/80">{DOC_TYPE_LABELS[r.document_type ?? ""] ?? r.document_type ?? "—"}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>ID {r.identificacion}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">{r.concepto ?? "Matrícula"}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">{r.comercial_nombre ?? "—"}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{formatDateTime(r.created_at)}</span>
                      </div>
                      {r.status === "rechazada" && r.rejection_reason && (
                        <p className="w-fit rounded-lg border border-rose-100/60 bg-rose-50/50 px-2.5 py-1 text-sm font-medium text-rose-600">
                          Motivo: {r.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Panel de precio */}
                  <div className="flex shrink-0 flex-col items-center justify-center text-center md:pl-4">
                    <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Valor a pagar</span>
                    <span className="text-xl font-extrabold text-foreground">{formatCOP(r.valor_total_empresa ?? r.valor_total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Aprobar */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aprobar Solicitud</DialogTitle>
          </DialogHeader>
          {isUploadFlow(approving) ? (() => {
            const isPaypal = approving?.document_type === "factura_paypal";
            return (
            <>
              <p className="text-sm text-muted-foreground">
                Ingresa el consecutivo con el que salió la factura en la plataforma externa.
                {isPaypal ? " Adjuntar el PDF es opcional." : " Puedes adjuntar el PDF si lo tienes disponible."}
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
                <label className="text-sm font-medium">N° Consecutivo{isPaypal ? " (opcional)" : " *"}</label>
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
                    : isPaypal
                    ? "Si lo dejas vacío, se asignará automáticamente según el conteo de Facturas PayPal ya numeradas."
                    : "Quedará registrado en la sección Numeración."}
                </p>
              </div>
              {isPaypal && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nota de aprobación</label>
                  <p className="text-xs text-muted-foreground">
                    Escribe el detalle de la transacción y pega aquí capturas de pantalla (Ctrl+V) si las tienes. Opcional.
                  </p>
                  <textarea
                    className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Ej: Pago confirmado en PayPal, ID de transacción 8LK..., pega aquí la captura de la transacción"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    onPaste={handleNotesPaste}
                  />
                  {approvalImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {approvalImages.map((img, i) => (
                        <div key={img.previewUrl} className="group relative h-16 w-16 overflow-hidden rounded-md border border-border">
                          <img src={img.previewUrl} alt={`Imagen pegada ${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeApprovalImage(i)}
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            title="Quitar imagen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">Sube aquí tu factura{isPaypal ? " (opcional)" : " *"}</label>
                <Input type="file" onChange={(e) => setApprovalPdf(e.target.files?.[0] ?? null)} />
                {approvalPdf && <p className="text-xs text-muted-foreground">{approvalPdf.name} · {(approvalPdf.size / 1024).toFixed(0)} KB</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproving(null)}>Cancelar</Button>
                <Button onClick={confirmApproveUpload} disabled={!isPaypal && (!manualReciboNumero.trim() || !approvalPdf)}>Aprobar</Button>
              </DialogFooter>
            </>
            );
          })() : (
            <>
              <p className="text-sm text-muted-foreground">
                Se generará el PDF para <strong>{approving?.nombre}</strong>.
              </p>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nota de aprobación (opcional)</label>
                <Textarea
                  rows={3}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Deja aquí una nota opcional sobre esta aprobación…"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproving(null)}>Cancelar</Button>
                <Button onClick={confirmApprove}>Aprobar</Button>
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

      {/* Vista de detalle (ocupa toda la página, seccionada como un correo abierto) */}
      {previewing && (() => {
            const isPersonaFlow = previewing.document_type !== "orden_matricula";
            const isJuridica = previewing.tipo_persona === "Persona Jurídica";
            // Cartera puede editar/corregir/duplicar solo lo que ella misma creó; el resto de roles no tiene esta restricción.
            const canEditThis = !isCartera || previewing.created_by === user?.id;
            const participantes = previewing.participantes ?? [];
            const historicalAttachments = previewing.parent_id
              ? itemsById.get(previewing.parent_id)?.attachments ?? []
              : [];
            const hasCurrentAttachments = (previewing.attachments && previewing.attachments.length > 0) || previewing.approved_pdf_path;
            const hasHistoricalAttachments = historicalAttachments.length > 0;
            const TypeIcon = DOC_TYPE_ICONS[previewing.document_type ?? ""] ?? FileText;
            return (
              <div className="space-y-3 pb-4">
                {/* Barra de acciones — arriba, para que se vea de una */}
                <div className="rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPreviewing(null)}>
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Bandeja
                    </Button>
                    {(previewing.document_type === "orden_matricula" || previewing.document_type === "factura_usa") && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => openPdfPreview(previewing)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver PDF
                      </Button>
                    )}
                    {canEditThis && (previewing.status === "aprobada" || previewing.status === "corregida") ? (
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
                    ) : canEditThis && (
                      <Link href={`/solicitar?id=${previewing.id}`}>
                        <Button size="sm" variant="outline" className="rounded-full">
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                      </Link>
                    )}
                    {(previewing.status === "aprobada" || previewing.status === "corregida") && (
                      previewing.document_type === "factura_paypal" && !previewing.approved_pdf_path ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => openResponseView(previewing)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver Respuesta
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadPdf(previewing)}>
                          <FileDown className="mr-1.5 h-3.5 w-3.5" /> Descargar PDF
                        </Button>
                      )
                    )}
                    {canEditThis && (previewing.status === "aprobada" || previewing.status === "corregida") && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => duplicar(previewing)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                      </Button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {(role === "financiera" || role === "cartera")
                        && (previewing.status === "aprobada" || previewing.status === "rechazada" || previewing.status === "corregida")
                        && !previewing.archived_by_reviewer && (
                        <Button size="sm" variant="outline" className="rounded-full text-red-700 border-red-200 hover:bg-red-700 hover:text-white" onClick={() => hideForReviewer(previewing)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="outline" className="rounded-full text-red-700 border-red-200 hover:bg-red-700 hover:text-white" onClick={() => removeRequest(previewing)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar definitivamente
                        </Button>
                      )}
                      {!isCartera && canApprove && previewing.status === "pendiente" && (
                        <>
                          <Button size="sm" className="rounded-full bg-rose-600 hover:bg-rose-700 text-white border-0" onClick={() => openRejectDialog(previewing)}>
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Rechazar Solicitud
                          </Button>
                          <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => openApprove(previewing)}>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Aprobar Solicitud
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenido: todas las secciones, sin pestañas */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="p-5 space-y-4">
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                              <TypeIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-base font-bold text-foreground">
                                {DOC_TYPE_LABELS[previewing.document_type ?? ""] ?? previewing.document_type ?? "—"}
                              </span>
                              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_PILL[previewing.status])}>
                                {previewing.status === "pendiente" ? "Pendiente" : previewing.status === "aprobada" ? "Aprobada" : previewing.status === "corregida" ? "Corregida" : "Rechazada"}
                              </span>
                            </div>
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
                                <div className="sm:col-span-full">
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
                                  <div className="sm:col-span-full"><PreviewRow label="Dirección" value={previewing.direccion ?? "—"} /></div>
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
                                      <div className="sm:col-span-full"><PreviewRow label="Dirección" value={previewing.direccion ?? "—"} /></div>
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
                              <PreviewRow label={CREATOR_ROLE_LABELS[previewing.created_by_role ?? ""] ?? "Líder Comercial"} value={previewing.comercial_nombre ?? "—"} />
                              <PreviewRow label={`Correo ${CREATOR_ROLE_LABELS[previewing.created_by_role ?? ""] ?? "Líder Comercial"}`} value={previewing.comercial_email ?? "—"} />
                              {previewing.asesor_nombre && (
                                <PreviewRow label="Asesor Comercial" value={previewing.asesor_nombre} />
                              )}
                              <PreviewRow label="Creada" value={formatDate(previewing.created_at)} />
                              {previewing.approved_at && <PreviewRow label="Aprobada" value={formatDate(previewing.approved_at)} />}
                              {previewing.observaciones && (
                                <div className="sm:col-span-full">
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Observaciones</p>
                                  <p className="mt-0.5 text-foreground">{previewing.observaciones}</p>
                                </div>
                              )}
                              {previewing.rejection_reason && (
                                <div className="sm:col-span-full rounded-lg bg-destructive/10 px-3 py-2">
                                  <p className="text-xs uppercase tracking-wider text-destructive">⚠️ Motivo de rechazo</p>
                                  <p className="mt-0.5 text-destructive">{previewing.rejection_reason}</p>
                                </div>
                              )}
                            </DetailSection>

                            <DetailSection title="Programa">
                            <PreviewRow label="Concepto" value={previewing.concepto ?? "—"} />
                            <PreviewRow label="Tipo de programa" value={previewing.tipo_programa ?? "—"} />
                            <div className="sm:col-span-full">
                              <PreviewRow
                                label="Programa"
                                value={!isPersonaFlow ? (previewing.nemonico || previewing.programa) : previewing.programa}
                              />
                            </div>
                            {!isPersonaFlow && previewing.plan_estudio && (
                              <div className="sm:col-span-full"><PreviewRow label="Nombre del Diplomado" value={previewing.plan_estudio} /></div>
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
                                <PreviewRow label="Descuento %" value={`${previewing.descuento_pct}%`} />
                                <PreviewRow label="Descuento bono" value={formatCOP(previewing.descuento_bono ?? 0)} />
                                <PreviewRow label="Valor Total" value={formatCOP(previewing.matricula - previewing.descuento - (previewing.descuento_bono ?? 0))} />
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

                            {(!hasCurrentAttachments && !hasHistoricalAttachments ? (
                            <p className="text-sm text-muted-foreground">Esta solicitud no tiene archivos adjuntos.</p>
                          ) : (
                            <DetailSection title="Adjuntos" noGrid>
                              <div className="space-y-3">
                                {hasHistoricalAttachments && (
                                  <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Archivos de la solicitud rechazada original (historial)
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {historicalAttachments.map((a) => (
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
                                    </div>
                                  </div>
                                )}
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
                              </div>
                            </DetailSection>
                          ))}
                        </>
                      </div>
                </div>
              </div>
            );
          })()}

      {/* Dialog: Ver Respuesta (aprobación PayPal sin PDF) */}
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

