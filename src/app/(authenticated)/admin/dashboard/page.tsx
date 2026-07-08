"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, Clock, XCircle, Wrench } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from "recharts";

interface Row {
  status: string;
  comercial_nombre: string | null;
  asesor_nombre: string | null;
  nombre: string;
  identificacion: string;
  recibo_numero: string | null;
  programa: string;
  periodo: string;
  document_type: string | null;
  valor_total: number;
  created_at: string;
  rejection_reason: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; text: string }> = {
  pendiente:  { label: "Pendiente",  color: "#F59E0B", bg: "#FEF3C7", text: "#92400E" },
  aprobada:   { label: "Aprobada",   color: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  corregida:  { label: "Corregida",  color: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF" },
  rechazada:  { label: "Rechazada",  color: "#EF4444", bg: "#FEE2E2", text: "#991B1B" },
};
const STATUSES = ["pendiente", "aprobada", "corregida", "rechazada"] as const;

const DOC_META: Record<string, { label: string; color: string; bg: string }> = {
  orden_matricula:  { label: "Orden de Matrícula", color: "#6366F1", bg: "#EEF2FF" },
  factura_usa:      { label: "Factura USA",         color: "#8B5CF6", bg: "#F5F3FF" },
  factura_colombia: { label: "Factura Colombia",    color: "#F59E0B", bg: "#FEF3C7" },
  factura_paypal:   { label: "Factura PayPal",      color: "#14B8A6", bg: "#CCFBF1" },
};

const COMERCIAL_PALETTE = ["#6366F1","#8B5CF6","#EC4899","#3B82F6","#10B981","#F59E0B","#EF4444","#14B8A6"];

function docLabel(dt: string | null): string {
  return DOC_META[dt ?? ""]?.label ?? dt ?? "—";
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-2.5 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { canViewDashboard: isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [docSel, setDocSel] = useState<string[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("invoice_requests")
      .select("status,comercial_nombre,asesor_nombre,nombre,identificacion,recibo_numero,programa,periodo,document_type,valor_total,created_at,rejection_reason");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveRefresh("dashboard_inbox", load, isAdmin);

  const DOC_TYPES = ["orden_matricula", "factura_usa", "factura_colombia", "factura_paypal"] as const;

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusSel.length && !statusSel.includes(r.status)) return false;
      if (docSel.length && !docSel.includes(r.document_type ?? "")) return false;
      const d = r.created_at.slice(0, 10);
      if (desde && d < desde) return false;
      if (hasta && d > hasta) return false;
      if (ql) {
        const hay = [r.nombre, r.identificacion, r.comercial_nombre ?? "", String(r.recibo_numero ?? "")]
          .join(" ").toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, statusSel, docSel, desde, hasta]);

  const { byStatus, byDocType, byComercial, byAsesor, byRejectReason, byComercialRejected, timeline, totales } = useMemo(() => {
    const statusMap = new Map<string, number>();
    filtered.forEach((r) => statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1));
    const byStatus = Array.from(statusMap, ([name, value]) => ({ name, value }));

    const dtMap = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.document_type ?? "otro";
      dtMap.set(k, (dtMap.get(k) ?? 0) + 1);
    });
    const byDocType = Array.from(dtMap, ([name, value]) => ({ name, label: docLabel(name), value }));

    const comMap = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.comercial_nombre ?? "Sin asignar";
      comMap.set(k, (comMap.get(k) ?? 0) + 1);
    });
    const byComercial = Array.from(comMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const asesorMap = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.asesor_nombre ?? "Sin asignar";
      asesorMap.set(k, (asesorMap.get(k) ?? 0) + 1);
    });
    const byAsesor = Array.from(asesorMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const tlMap = new Map<string, number>();
    filtered.forEach((r) => {
      const d = r.created_at.slice(0, 10);
      tlMap.set(d, (tlMap.get(d) ?? 0) + 1);
    });
    const timeline = Array.from(tlMap, ([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totales = {
      total: filtered.length,
      aprobadas: filtered.filter((r) => r.status === "aprobada").length,
      corregidas: filtered.filter((r) => r.status === "corregida").length,
      pendientes: filtered.filter((r) => r.status === "pendiente").length,
      rechazadas: filtered.filter((r) => r.status === "rechazada").length,
    };

    const rejected = filtered.filter((r) => r.status === "rechazada");

    const reasonMap = new Map<string, number>();
    rejected.forEach((r) => {
      const k = (r.rejection_reason ?? "Sin motivo").split(" — ")[0];
      reasonMap.set(k, (reasonMap.get(k) ?? 0) + 1);
    });
    const byRejectReason = Array.from(reasonMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const comRejMap = new Map<string, number>();
    rejected.forEach((r) => {
      const k = r.comercial_nombre ?? "Sin asignar";
      comRejMap.set(k, (comRejMap.get(k) ?? 0) + 1);
    });
    const byComercialRejected = Array.from(comRejMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { byStatus, byDocType, byComercial, byAsesor, byRejectReason, byComercialRejected, timeline, totales };
  }, [filtered]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const clearFilters = () => { setQ(""); setStatusSel([]); setDocSel([]); setDesde(""); setHasta(""); };

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={totales.total}       icon={<FileText className="h-5 w-5" />}       accent="#6366F1" bg="#EEF2FF" />
        <StatCard label="Pendientes" value={totales.pendientes} icon={<Clock className="h-5 w-5" />}        accent="#F59E0B" bg="#FEF3C7" />
        <StatCard label="Aprobadas"  value={totales.aprobadas}  icon={<CheckCircle2 className="h-5 w-5" />} accent="#10B981" bg="#D1FAE5" />
        <StatCard label="Corregidas" value={totales.corregidas} icon={<Wrench className="h-5 w-5" />}      accent="#3B82F6" bg="#DBEAFE" />
        <StatCard label="Rechazadas" value={totales.rechazadas} icon={<XCircle className="h-5 w-5" />}      accent="#EF4444" bg="#FEE2E2" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Filtros</p>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground h-7">
            Limpiar
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, identificación…" className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Estado:</span>
          {STATUSES.map((s) => {
            const m = STATUS_META[s];
            const active = statusSel.includes(s);
            return (
              <button
                key={s} type="button"
                onClick={() => toggle(statusSel, setStatusSel, s)}
                className="rounded-full border px-3 py-0.5 text-xs font-medium transition-all"
                style={active
                  ? { backgroundColor: m.color, borderColor: m.color, color: "#fff" }
                  : { backgroundColor: "transparent", borderColor: "#e2e8f0", color: "#64748b" }
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Tipo de solicitud:</span>
          {DOC_TYPES.map((dt) => {
            const m = DOC_META[dt];
            const active = docSel.includes(dt);
            return (
              <button
                key={dt} type="button"
                onClick={() => toggle(docSel, setDocSel, dt)}
                className="rounded-full border px-3 py-0.5 text-xs font-medium transition-all"
                style={active
                  ? { backgroundColor: m.color, borderColor: m.color, color: "#fff" }
                  : { backgroundColor: "transparent", borderColor: "#e2e8f0", color: "#64748b" }
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Por estado" subtitle={`${filtered.length} solicitudes en total`}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={3} strokeWidth={0}>
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_META[entry.name]?.color ?? COMERCIAL_PALETTE[i]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { name: string; value: number };
                  const m = STATUS_META[d.name];
                  return (
                    <div className="rounded-xl border border-border bg-white px-4 py-2.5 shadow-lg">
                      <p className="text-xs font-semibold" style={{ color: m?.color }}>{m?.label ?? d.name}</p>
                      <p className="text-lg font-bold text-foreground">{d.value}</p>
                    </div>
                  );
                }}
              />
              <Legend formatter={(value) => STATUS_META[value]?.label ?? value} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Solicitudes por día" subtitle="Evolución en el tiempo">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTimeline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2.5} fill="url(#gradTimeline)"
                dot={{ fill: "#6366F1", r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#6366F1", strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por tipo de solicitud" subtitle="Distribución por documento">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDocType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {byDocType.map((d, i) => {
                  const c = DOC_META[d.name]?.color ?? COMERCIAL_PALETTE[i % COMERCIAL_PALETTE.length];
                  return (
                    <linearGradient key={d.name} id={`gradDoc${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.65} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { label: string; value: number; name: string };
                  const color = DOC_META[d.name]?.color ?? "#6366F1";
                  return (
                    <div className="rounded-xl border border-border bg-white px-4 py-2.5 shadow-lg">
                      <p className="text-xs font-semibold" style={{ color }}>{d.label}</p>
                      <p className="text-lg font-bold text-foreground">{d.value}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {byDocType.map((_, i) => (
                  <Cell key={i} fill={`url(#gradDoc${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ranking" subtitle="Por número de solicitudes">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byComercial} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
              <defs>
                {byComercial.map((_, i) => {
                  const c = COMERCIAL_PALETTE[i % COMERCIAL_PALETTE.length];
                  return (
                    <linearGradient key={i} id={`gradCom${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.55} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={96} fontSize={10} tick={{ fill: "#64748b" }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {byComercial.map((_, i) => (
                  <Cell key={i} fill={`url(#gradCom${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ranking por Asesor" subtitle="Por número de solicitudes">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byAsesor} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
              <defs>
                {byAsesor.map((_, i) => {
                  const c = COMERCIAL_PALETTE[i % COMERCIAL_PALETTE.length];
                  return (
                    <linearGradient key={i} id={`gradAse${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.55} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={96} fontSize={10} tick={{ fill: "#64748b" }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {byAsesor.map((_, i) => (
                  <Cell key={i} fill={`url(#gradAse${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rechazos por motivo" subtitle={`${totales.rechazadas} solicitud(es) rechazada(s)`}>
          {byRejectReason.length === 0 ? (
            <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Sin rechazos en este filtro.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRejectReason} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} fontSize={10} tick={{ fill: "#64748b" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 21) + "…" : v} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#EF4444" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Rechazos por comercial" subtitle="Quién acumula más solicitudes rechazadas">
          {byComercialRejected.length === 0 ? (
            <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Sin rechazos en este filtro.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byComercialRejected} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={96} fontSize={10} tick={{ fill: "#64748b" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#EF4444" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon, accent, bg }: {
  label: string; value: number; icon: React.ReactNode; accent: string; bg: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: `${accent}30` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</p>
          <p className="mt-2 text-4xl font-extrabold leading-none text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: bg, color: accent }}>{icon}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl" style={{ background: accent }} />
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
