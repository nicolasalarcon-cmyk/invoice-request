import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileText, FileSpreadsheet, Globe2, DollarSign } from "lucide-react";
import { OrdenMatriculaForm } from "@/components/solicitar/OrdenMatriculaForm";
import { FacturaUsaForm } from "@/components/solicitar/FacturaUsaForm";
import { FacturaColombiaForm } from "@/components/solicitar/FacturaColombiaForm";
import { FacturaPaypalForm } from "@/components/solicitar/FacturaPaypalForm";

export const Route = createFileRoute("/_authenticated/solicitar")({
  component: SolicitarPage,
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
    tipo: typeof s.tipo === "string" ? s.tipo : undefined,
  }),
  head: () => ({ meta: [{ title: "Crear · UdeCataluña" }] }),
});

type DocType = "orden_matricula" | "factura_usa" | "factura_colombia" | "factura_paypal";

const OPTIONS: Array<{
  value: DocType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: "orden_matricula",  title: "Orden de Matrícula", icon: FileText,       color: "#6366F1" },
  { value: "factura_usa",      title: "Factura USA",        icon: Globe2,         color: "#8B5CF6" },
  { value: "factura_colombia", title: "Factura Colombia",   icon: FileSpreadsheet, color: "#F59E0B" },
  { value: "factura_paypal",   title: "Factura PayPal",     icon: DollarSign,     color: "#14B8A6" },
];

function SolicitarPage() {
  const { user, isAdmin, isComercial, loading } = useAuth();
  const { id: editId, tipo: tipoSearch } = useSearch({ from: "/_authenticated/solicitar" });
  const [docType, setDocType] = useState<DocType>(
    (tipoSearch as DocType) ?? "orden_matricula",
  );
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  useEffect(() => {
    if (!editId || !user) return;
    setLoadingEdit(true);
    supabase
      .from("invoice_requests")
      .select("document_type")
      .eq("id", editId)
      .maybeSingle()
      .then(({ data }) => {
        const dt = (data as { document_type?: string } | null)?.document_type as DocType | undefined;
        if (dt) setDocType(dt);
        setLoadingEdit(false);
      });
  }, [editId, user]);

  if (loading) {
    return <main className="mx-auto max-w-4xl px-6 py-8 text-sm text-muted-foreground">Cargando…</main>;
  }
  if (!isComercial && !isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-muted-foreground">Tu cuenta no tiene permisos.</p>
      </main>
    );
  }

  const titleByType: Record<DocType, string> = {
    orden_matricula: "Orden de Matrícula",
    factura_usa: "Factura USA",
    factura_colombia: "Factura Colombia",
    factura_paypal: "Factura PayPal",
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {editId ? `Editar · ${titleByType[docType]}` : "Crear"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {editId
          ? "Modifica los datos de esta solicitud."
          : "Selecciona el tipo de documento a crear. El formulario aparecerá debajo."}
      </p>

      {!editId && (
        <div className="mt-6 flex flex-wrap gap-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = docType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDocType(opt.value)}
                className="flex items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-semibold transition-all focus:outline-none shadow-sm"
                style={selected
                  ? { backgroundColor: opt.color, borderColor: opt.color, color: "#fff" }
                  : { backgroundColor: "transparent", borderColor: "#e2e8f0", color: "#64748b" }
                }
              >
                <Icon className="h-4 w-4" />
                {opt.title}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {loadingEdit ? (
          <p className="text-sm text-muted-foreground">Cargando solicitud…</p>
        ) : docType === "orden_matricula" ? (
          <OrdenMatriculaForm editId={editId} />
        ) : docType === "factura_usa" ? (
          <FacturaUsaForm editId={editId} />
        ) : docType === "factura_colombia" ? (
          <FacturaColombiaForm editId={editId} />
        ) : (
          <FacturaPaypalForm editId={editId} />
        )}
      </div>
    </main>
  );
}
