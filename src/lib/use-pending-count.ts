import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cuenta de solicitudes pendientes con suscripción Realtime.
 * Se actualiza solo cuando llegan nuevas o cambian de estado.
 */
export function usePendingCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refresh = async () => {
      const { count: c } = await supabase
        .from("invoice_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente");
      if (!cancelled) setCount(c ?? 0);
    };

    refresh();

    const channel = supabase
      .channel("invoice_requests_pending")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_requests" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return count;
}
