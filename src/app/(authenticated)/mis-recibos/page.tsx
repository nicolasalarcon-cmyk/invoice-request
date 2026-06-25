"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCOP, formatDate } from "@/lib/format";
import { FileDown, FilePlus, Inbox, MessageSquare, Search, Pencil, Trash2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Status = "pendiente" | "aprobada" | "rechazada" | "requiere_info";
type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

interface AttachmentItem { path: string; name: string; size: number; type: string }

interface Req {
  id: string;
  status: Status;
  document_type: DocType | null;
  nombre: string;
  identificacion: string;
  programa: string;
  tipo_programa: string | null;
  concepto: string | null;
  periodo: string;
  matricula: number;
  descuento_pct: number;
  descuento_bono: number;
  valor_total: number;
  recargo_total: number;
  fecha_limite_pago: string | null;
  fecha_pago_extraordinario: string | null;
  recibo_numero: number | null;
  recibo_fecha: string;
  created_at: string;
  rejection_reason: string | null;
  info_requested: string | null;
  comercial_nombre: string | null;
  template_id: string | null;
  codigo_estudiante: string | null;
  codigo_snies: string | null;
  cohorte: string | null;
  plan_estudio: string | null;
  fecha_inicio: string | null;
  horas_programa: number | null;
  duracion: string | null;
  convocatoria: string | null;
  attachments: AttachmentItem[] | null;
  approved_pdf_path: string | null;
}

export default function MisRecibos() {
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("invoice_requests")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setItems((data ?? []) as unknown as Req[]);
      setLoading(false);
    })();
  }, [user]);

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
    const { generateInvoicePDF } = await import("@/lib/generate-invoice-pdf");
    await generateInvoicePDF(reqToPdfData(r));
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

  const deleteRequest = async (r: Req) => {
    if (!confirm(`¿Eliminar el recibo de ${r.nombre}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("invoice_requests").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Recibo eliminado");
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis recibos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Busca tus solicitudes y descarga los recibos aprobados.
          </p>
        </div>
        <Link href="/solicitar">
          <Button><FilePlus className="mr-2 h-4 w-4" /> Nueva solicitud</Button>
        </Link>
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
            <SelectItem value="requiere_info">Requiere info</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
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
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">{r.nombre}</h3>
                      <StatusBadge s={r.status} />
                      {r.recibo_numero && <span className="text-xs font-mono text-muted-foreground">#{r.recibo_numero}</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ID {r.identificacion} · {r.concepto ?? "Matrícula"} · {r.tipo_programa ?? ""} {r.programa} · {r.periodo}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Enviada {formatDate(r.created_at)}</p>
                    {r.status === "rechazada" && r.rejection_reason && (
                      <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                        Motivo: {r.rejection_reason}
                      </p>
                    )}
                    {r.status === "requiere_info" && r.info_requested && (
                      <p className="mt-2 rounded bg-accent px-2 py-1 text-xs text-accent-foreground">
                        <MessageSquare className="mr-1 inline h-3 w-3" /> El admin pide: {r.info_requested}
                      </p>
                    )}
                    {r.attachments && r.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.attachments.map((a) => (
                          <button
                            key={a.path}
                            type="button"
                            onClick={() => openAttachment(a.path)}
                            className="rounded bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-muted/70"
                          >
                            📎 {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor a pagar</p>
                    <p className="text-lg font-bold text-foreground">{formatCOP(r.valor_total)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  {(r.status === "pendiente" || r.status === "requiere_info") && (
                    <Link href={`/solicitar?id=${r.id}`}>
                      <Button size="sm" variant="secondary"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                    </Link>
                  )}
                  {r.status === "rechazada" && (
                    <Link href={`/solicitar?id=${r.id}`}>
                      <Button size="sm"><Pencil className="mr-2 h-4 w-4" /> Corregir y reenviar</Button>
                    </Link>
                  )}
                  {r.status === "aprobada" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => previewPdf(r)}>
                        <Eye className="mr-2 h-4 w-4" /> Vista previa
                      </Button>
                      <Button size="sm" onClick={() => downloadPdf(r)}>
                        <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                      </Button>
                    </>
                  )}
                  {(r.status === "aprobada" || r.status === "rechazada") && (
                    <Button size="sm" variant="destructive" onClick={() => deleteRequest(r)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
