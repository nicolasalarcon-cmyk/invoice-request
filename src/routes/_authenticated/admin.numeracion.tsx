import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCOP, formatDate } from "@/lib/format";
import { Download, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/numeracion")({
  component: Numeracion,
  head: () => ({ meta: [{ title: "Numeración · Admin" }] }),
});

type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

interface Row {
  id: string;
  document_type: DocType;
  recibo_numero: number | null;
  recibo_fecha: string;
  nombre: string;
  identificacion: string;
  programa: string | null;
  concepto: string | null;
  valor_total: number;
  comercial_nombre: string | null;
  approved_at: string | null;
}

const TABS: Array<{ value: DocType; label: string }> = [
  { value: "orden_matricula", label: "Orden de Matrícula" },
  { value: "factura_usa", label: "Facturas USA" },
  { value: "factura_colombia", label: "Facturas Colombia" },
  { value: "factura_paypal", label: "Facturas PayPal" },
];

function Numeracion() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<DocType>("orden_matricula");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoice_requests")
      .select("id,document_type,recibo_numero,recibo_fecha,nombre,identificacion,programa,concepto,valor_total,comercial_nombre,approved_at")
      .eq("status", "aprobada")
      .order("recibo_numero", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const rowsByTab = useMemo(() => rows.filter((r) => (r.document_type ?? "orden_matricula") === tab), [rows, tab]);

  const filtered = useMemo(() => {
    if (!q) return rowsByTab;
    const s = q.toLowerCase();
    return rowsByTab.filter((r) =>
      String(r.recibo_numero ?? "").includes(s) ||
      r.nombre.toLowerCase().includes(s) ||
      r.identificacion.includes(s) ||
      (r.comercial_nombre ?? "").toLowerCase().includes(s),
    );
  }, [rowsByTab, q]);

  const removeRow = async (r: Row) => {
    if (!confirm(`¿Eliminar definitivamente el registro de ${r.nombre}${r.recibo_numero ? ` (#${r.recibo_numero})` : ""}?`)) return;
    const { error } = await supabase.from("invoice_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const exportXLSX = () => {
    const label = TABS.find((t) => t.value === tab)?.label ?? "Numeracion";
    const data = filtered.map((r) => ({
      "N°": r.recibo_numero ?? "",
      "Fecha": formatDate(r.recibo_fecha),
      "Nombre": r.nombre,
      "Identificación": r.identificacion,
      "Programa": r.programa ?? "",
      "Concepto": r.concepto ?? "",
      "Valor": Number(r.valor_total),
      "Asesor": r.comercial_nombre ?? "",
      "Aprobado": r.approved_at ? formatDate(r.approved_at) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 28));
    XLSX.writeFile(wb, `numeracion-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Sin permisos.</p>;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Numeración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de documentos aprobados por tipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-64 pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button onClick={exportXLSX}><Download className="mr-2 h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DocType)} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <span className="ml-2 rounded-full bg-muted px-2 text-[10px] font-mono">
                {rows.filter((r) => (r.document_type ?? "orden_matricula") === t.value).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">N°</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Programa</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Asesor</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{r.recibo_numero ?? "—"}</td>
                        <td className="px-3 py-2">{formatDate(r.recibo_fecha)}</td>
                        <td className="px-3 py-2">{r.nombre}</td>
                        <td className="px-3 py-2">{r.identificacion}</td>
                        <td className="px-3 py-2">{r.programa ?? "—"}</td>
                        <td className="px-3 py-2">{r.concepto ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{formatCOP(r.valor_total)}</td>
                        <td className="px-3 py-2">{r.comercial_nombre ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => removeRow(r)} title="Eliminar registro">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin resultados.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
