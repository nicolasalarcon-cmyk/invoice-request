import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export type Status = "pendiente" | "aprobada" | "rechazada" | "corregida";

export function DetailSection({ title, children, noGrid }: { title: string; children: ReactNode; noGrid?: boolean }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-4">
        {title}
      </h3>
      {noGrid ? children : <div className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">{children}</div>}
    </div>
  );
}

export function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-[15px] font-medium text-foreground">{value}</p>
    </div>
  );
}

export function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pendiente: { label: "Pendiente", variant: "secondary" },
    aprobada: { label: "Aprobada", variant: "default" },
    rechazada: { label: "Rechazada", variant: "destructive" },
    corregida: { label: "Corregida", variant: "outline" },
  };
  const m = map[s];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
