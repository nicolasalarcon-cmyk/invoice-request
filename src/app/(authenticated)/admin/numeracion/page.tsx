"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { deleteInvoiceFiles } from "@/lib/delete-invoice-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP, formatDate } from "@/lib/format";
import { ChevronDown, ChevronRight, Download, FileDown, Paperclip, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import React from "react";

type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";
type Status = "pendiente" | "aprobada" | "rechazada" | "corregida";

interface Attachment { path: string; name: string; }
interface Participant { nombre: string; cedula: string; email: string; telefono: string; }

interface Row {
  id: string;
  document_type: DocType;
  status: Status;
  recibo_numero: string | null;
  recibo_fecha: string;
  created_at: string;
  nombre: string;
  identificacion: string;
  codigo_estudiante: string | null;
  codigo_snies: string | null;
  periodo: string | null;
  plan_estudio: string | null;
  horas_programa: number | null;
  duracion: string | null;
  convocatoria: string | null;
  descuento_bono: number | null;
  recargo_total: number | null;
  fecha_pago_extraordinario: string | null;
  template_id: string | null;
  nemonico: string | null;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  nit: string | null;
  tipo_persona: string | null;
  valor_parcial: number | null;
  programa: string | null;
  concepto: string | null;
  tipo_programa: string | null;
  cohorte: string | null;
  fecha_inicio: string | null;
  fecha_limite_pago: string | null;
  pais: string | null;
  direccion: string | null;
  ciudad: string | null;
  numero_participantes: number | null;
  matricula: number;
  descuento_pct: number;
  descuento: number;
  valor_total: number;
  valor_total_empresa: number | null;
  observaciones: string | null;
  rejection_reason: string | null;
  comercial_nombre: string | null;
  comercial_email: string | null;
  asesor_nombre: string | null;
  approved_at: string | null;
  approved_pdf_path: string | null;
  attachments: Attachment[];
  participantes: Participant[];
}

const DOC_LABELS: Record<DocType, string> = {
  orden_matricula:  "Orden de Matrícula",
  factura_usa:      "Factura USA",
  factura_colombia: "Factura Colombia",
  factura_paypal:   "Factura PayPal",
};

const STATUS_LABELS: Record<Status, string> = {
  pendiente:     "Pendiente",
  aprobada:      "Aprobada",
  rechazada:     "Rechazada",
  corregida:     "Corregida",
};

const STATUS_COLORS: Record<Status, string> = {
  pendiente:     "bg-amber-100 text-amber-800",
  aprobada:      "bg-green-100 text-green-800",
  rechazada:     "bg-red-100 text-red-800",
  corregida:     "bg-blue-100 text-blue-800",
};

export default function Numeracion() {
  const { canViewNumeracion: isAdmin, canDelete } = useAuth();
  const [rows, setRows]               = useState<Row[]>([]);
  const [loading, setLoading]         = useState(true);
  const [q, setQ]                     = useState("");
  const [filterDoc, setFilterDoc]     = useState<DocType | "">("");
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from("invoice_requests")
      .select(`
        id,document_type,status,recibo_numero,recibo_fecha,created_at,
        nombre,identificacion,codigo_estudiante,codigo_snies,periodo,
        plan_estudio,horas_programa,duracion,convocatoria,descuento_bono,
        recargo_total,fecha_pago_extraordinario,template_id,nemonico,
        email,telefono,empresa,nit,tipo_persona,valor_parcial,
        programa,concepto,tipo_programa,cohorte,fecha_inicio,fecha_limite_pago,
        pais,direccion,ciudad,numero_participantes,matricula,
        descuento_pct,descuento,valor_total,valor_total_empresa,
        observaciones,rejection_reason,comercial_nombre,comercial_email,asesor_nombre,
        approved_at,approved_pdf_path,attachments,participantes
      `)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveRefresh("numeracion_inbox", () => load(true), isAdmin);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterDoc)    list = list.filter((r) => r.document_type === filterDoc);
    if (filterStatus) list = list.filter((r) => r.status === filterStatus);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((r) => {
        if (
          String(r.recibo_numero ?? "").includes(s) ||
          r.nombre.toLowerCase().includes(s) ||
          r.identificacion.toLowerCase().includes(s) ||
          (r.empresa ?? "").toLowerCase().includes(s) ||
          (r.nit ?? "").toLowerCase().includes(s) ||
          (r.email ?? "").toLowerCase().includes(s) ||
          (r.telefono ?? "").toLowerCase().includes(s) ||
          (r.comercial_nombre ?? "").toLowerCase().includes(s) ||
          (r.comercial_email ?? "").toLowerCase().includes(s) ||
          (r.programa ?? "").toLowerCase().includes(s) ||
          (r.concepto ?? "").toLowerCase().includes(s) ||
          (r.cohorte ?? "").toLowerCase().includes(s) ||
          (r.ciudad ?? "").toLowerCase().includes(s) ||
          (r.observaciones ?? "").toLowerCase().includes(s)
        ) return true;
        // buscar dentro de participantes
        const parts = Array.isArray(r.participantes) ? (r.participantes as Participant[]) : [];
        return parts.some((p) =>
          (p.nombre ?? "").toLowerCase().includes(s) ||
          (p.cedula ?? "").toLowerCase().includes(s) ||
          (p.email ?? "").toLowerCase().includes(s) ||
          (p.telefono ?? "").toLowerCase().includes(s),
        );
      });
    }
    return list;
  }, [rows, filterDoc, filterStatus, q]);

  const counts = useMemo(() => ({
    total:     filtered.length,
    aprobada:  filtered.filter((r) => r.status === "aprobada").length,
    corregida: filtered.filter((r) => r.status === "corregida").length,
    pendiente: filtered.filter((r) => r.status === "pendiente").length,
    rechazada: filtered.filter((r) => r.status === "rechazada").length,
  }), [filtered]);

  const removeRow = async (r: Row) => {
    if (!confirm(`¿Eliminar definitivamente el registro de ${r.nombre}${r.recibo_numero ? ` (#${r.recibo_numero})` : ""}? Esto también borrará los archivos adjuntos.`)) return;
    await deleteInvoiceFiles(r.attachments, r.approved_pdf_path);
    const { error } = await supabase.from("invoice_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(path, 60);
    if (error || !data) return toast.error("No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank");
  };

  const rowToPdfData = (r: Row) => ({
    recibo_numero: r.recibo_numero, recibo_fecha: r.recibo_fecha, nombre: r.nombre,
    identificacion: r.identificacion, codigo_estudiante: r.codigo_estudiante,
    programa: r.programa ?? "", codigo_snies: r.codigo_snies, periodo: r.periodo ?? "",
    cohorte: r.cohorte, plan_estudio: r.plan_estudio, fecha_inicio: r.fecha_inicio,
    horas_programa: r.horas_programa, duracion: r.duracion, convocatoria: r.convocatoria,
    matricula: Number(r.matricula), descuento_pct: Number(r.descuento_pct ?? 0),
    descuento_bono: Number(r.descuento_bono ?? 0), valor_total: Number(r.valor_total ?? 0),
    valor_total_empresa: r.valor_total_empresa ? Number(r.valor_total_empresa) : null,
    numero_participantes: r.numero_participantes,
    participantes: r.participantes,
    recargo_total: Number(r.recargo_total ?? 0), fecha_limite_pago: r.fecha_limite_pago,
    fecha_pago_extraordinario: r.fecha_pago_extraordinario, template_id: r.template_id,
    tipo_programa: r.tipo_programa, document_type: r.document_type, tipo_persona: r.tipo_persona,
    valor_parcial: r.valor_parcial,
    empresa: r.empresa, cliente_nit: r.nit, direccion: r.direccion,
    ciudad: r.ciudad, telefono: r.telefono, pais: r.pais,
    email: r.email, nemonico: r.nemonico, observaciones: r.observaciones,
    concepto: r.concepto,
  });

  const downloadInvoice = async (r: Row) => {
    if (r.approved_pdf_path) return openFile(r.approved_pdf_path);
    try {
      const { generateInvoicePDF } = await import("@/lib/generate-invoice-pdf");
      await generateInvoicePDF(rowToPdfData(r));
    } catch {
      toast.error("No se pudo generar el documento");
    }
  };

  const exportXLSX = () => {
    const data = filtered.map((r) => ({
      "N° Consecutivo":       r.recibo_numero ?? "",
      "Estado":               STATUS_LABELS[r.status] ?? r.status,
      "Tipo":                 DOC_LABELS[r.document_type] ?? r.document_type,
      "Fecha solicitud":      formatDate(r.created_at),
      "Fecha aprobación":     r.approved_at ? formatDate(r.approved_at) : "",
      "Nombre / Empresa":     r.nombre,
      "Identificación / NIT": r.identificacion,
      "Email":                r.email ?? "",
      "Teléfono":             r.telefono ?? "",
      "Empresa":              r.empresa ?? "",
      "Número de Identificación": r.nit ?? "",
      "Tipo persona":         r.tipo_persona ?? "",
      "Programa":             r.programa ?? "",
      "Concepto":             r.concepto ?? "",
      "Tipo programa":        r.tipo_programa ?? "",
      "Cohorte":              r.cohorte ?? "",
      "Fecha inicio":         r.fecha_inicio ?? "",
      "Fecha límite pago":    r.fecha_limite_pago ?? "",
      "País":                 r.pais ?? "",
      "Ciudad":               r.ciudad ?? "",
      "Dirección":            r.direccion ?? "",
      "N° Participantes":     r.numero_participantes ?? "",
      "Descuento %":          r.descuento_pct,
      "Descuento valor":      r.descuento,
      "Valor por participante": Number(r.valor_total),
      "Valor empresa":        r.valor_total_empresa ?? "",
      "Comercial":            r.comercial_nombre ?? "",
      "Email comercial":      r.comercial_email ?? "",
      "Asesor Comercial":     r.asesor_nombre ?? "",
      "Observaciones":        r.observaciones ?? "",
      "Motivo de rechazo":    r.rejection_reason ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Numeracion");
    XLSX.writeFile(wb, `numeracion-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Numeración</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico completo de todas las solicitudes.</p>
        </div>
        <Button onClick={exportXLSX}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
      </div>

      {/* ── BUSCADOR ── */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10 w-full" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* ── FILTROS ── */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Tipo:</span>
          <Chip label="Todas" active={filterDoc === ""}              onClick={() => setFilterDoc("")} />
          <Chip label="Orden de Matrícula" active={filterDoc === "orden_matricula"}  onClick={() => setFilterDoc("orden_matricula")} />
          <Chip label="Factura USA"        active={filterDoc === "factura_usa"}       onClick={() => setFilterDoc("factura_usa")} />
          <Chip label="Factura Colombia"   active={filterDoc === "factura_colombia"}  onClick={() => setFilterDoc("factura_colombia")} />
          <Chip label="Factura PayPal"     active={filterDoc === "factura_paypal"}    onClick={() => setFilterDoc("factura_paypal")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Estado:</span>
          <Chip label="Todos"         active={filterStatus === ""}              onClick={() => setFilterStatus("")} />
          <Chip label="Pendiente"     active={filterStatus === "pendiente"}     onClick={() => setFilterStatus("pendiente")} />
          <Chip label="Aprobada"      active={filterStatus === "aprobada"}      onClick={() => setFilterStatus("aprobada")} />
          <Chip label="Corregida"     active={filterStatus === "corregida"}     onClick={() => setFilterStatus("corregida")} />
          <Chip label="Rechazada"     active={filterStatus === "rechazada"}     onClick={() => setFilterStatus("rechazada")} />
        </div>
      </div>

      {/* ── CONTADORES ── */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{counts.total}</strong> resultado(s)</span>
        <span className="text-green-700"><strong>{counts.aprobada}</strong> aprobadas</span>
        <span className="text-blue-700"><strong>{counts.corregida}</strong> corregidas</span>
        <span className="text-amber-700"><strong>{counts.pendiente}</strong> pendientes</span>
        <span className="text-red-700"><strong>{counts.rechazada}</strong> rechazadas</span>
      </div>

      {/* ── TABLA ── */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-6 px-3 py-2" />
                <th className="px-3 py-2">N°</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Nombre / Empresa</th>
                <th className="px-3 py-2">ID / NIT</th>
                <th className="px-3 py-2">Programa</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Asesor</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Sin resultados.</td></tr>
              )}
              {filtered.map((r) => {
                const isExpanded     = expandedId === r.id;
                const attachments   = Array.isArray(r.attachments)   ? (r.attachments as Attachment[])   : [];
                const participantes = Array.isArray(r.participantes)  ? (r.participantes as Participant[]) : [];
                return (
                  <React.Fragment key={r.id}>
                    {/* ── FILA PRINCIPAL ── */}
                    <tr
                      className={cn(
                        "border-t border-border cursor-pointer transition-colors hover:bg-muted/30",
                        isExpanded && "bg-muted/20",
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.recibo_numero ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[r.status])}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{DOC_LABELS[r.document_type] ?? r.document_type}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.nombre}>{r.nombre}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.identificacion}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-xs" title={r.programa ?? ""}>{r.programa ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.concepto ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatCOP(r.valor_total)}</td>
                      <td className="px-3 py-2 text-xs max-w-[120px] truncate">{r.comercial_nombre ?? "—"}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {(r.status === "aprobada" || r.status === "corregida") && (
                            <Button size="sm" variant="ghost" title="Descargar factura aprobada" onClick={() => downloadInvoice(r)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" title="Eliminar registro" onClick={() => removeRow(r)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── FILA DETALLE (expandible) ── */}
                    {isExpanded && (
                      <tr className="border-t border-dashed border-border bg-muted/10">
                        <td colSpan={12} className="px-6 py-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            <Detail label="Tipo de persona"     value={r.tipo_persona} />
                            <Detail label="Email"               value={r.email} />
                            <Detail label="Teléfono"            value={r.telefono} />
                            <Detail label="Empresa"             value={r.empresa} />
                            <Detail label="Número de Identificación" value={r.nit} />
                            <Detail label="País"                value={r.pais} />
                            <Detail label="Ciudad"              value={r.ciudad} />
                            <Detail label="Dirección"           value={r.direccion} />
                            <Detail label="Tipo de programa"    value={r.tipo_programa} />
                            <Detail label="Cohorte"             value={r.cohorte} />
                            <Detail label="Fecha de inicio"     value={r.fecha_inicio} />
                            <Detail label="Fecha límite pago"   value={r.fecha_limite_pago} />
                            <Detail label="Fecha aprobación"    value={r.approved_at ? formatDate(r.approved_at) : null} />
                            <Detail label="N° Participantes"    value={r.numero_participantes != null ? String(r.numero_participantes) : null} />
                            <Detail label="Descuento"           value={r.descuento_pct > 0 ? `${r.descuento_pct}% · ${formatCOP(r.descuento)}` : null} />
                            <Detail label="Valor total empresa" value={r.valor_total_empresa != null ? formatCOP(r.valor_total_empresa) : null} />
                            <Detail label="Correo Líder Comercial" value={r.comercial_email} />
                            <Detail label="Asesor Comercial"    value={r.asesor_nombre} />

                            {r.observaciones && (
                              <div className="space-y-0.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Observaciones</p>
                                <p className="text-sm">{r.observaciones}</p>
                              </div>
                            )}

                            {r.status === "rechazada" && r.rejection_reason && (
                              <div className="space-y-0.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                                <p className="text-[10px] font-semibold uppercase text-red-700">Motivo de rechazo</p>
                                <p className="text-sm text-red-700">{r.rejection_reason}</p>
                              </div>
                            )}

                            {participantes.length > 0 && (
                              <div className="space-y-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                                <button
                                  type="button"
                                  onClick={() => setShowParticipants(showParticipants === r.id ? null : r.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showParticipants === r.id
                                    ? <ChevronDown className="h-3 w-3" />
                                    : <ChevronRight className="h-3 w-3" />}
                                  Ver participantes ({participantes.length})
                                </button>
                                {showParticipants === r.id && (
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {participantes.map((p, i) => (
                                      <div key={i} className="rounded border border-border bg-background px-3 py-2 text-xs space-y-0.5">
                                        <p className="font-semibold text-foreground">{i + 1}. {p.nombre || "—"}</p>
                                        {p.cedula   && <p className="text-muted-foreground">ID: {p.cedula}</p>}
                                        {p.email    && <p className="text-muted-foreground">{p.email}</p>}
                                        {p.telefono && <p className="text-muted-foreground">Tel: {p.telefono}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {attachments.length > 0 && (
                              <div className="space-y-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                                  <Paperclip className="h-3 w-3" /> Adjuntos del comercial
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {attachments.map((a) => (
                                    <button
                                      key={a.path}
                                      type="button"
                                      onClick={() => openFile(a.path)}
                                      className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-primary hover:bg-muted"
                                    >
                                      <Download className="h-3 w-3" /> {a.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
