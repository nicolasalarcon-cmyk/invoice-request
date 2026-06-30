"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePendingCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const load = async () => {
      const { count: n } = await supabase
        .from("invoice_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendiente");
      if (mounted) setCount(n ?? 0);
    };

    load();

    const channel = supabase
      .channel("pending_count_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, load)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return count;
}
