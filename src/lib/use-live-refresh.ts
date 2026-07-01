"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantiene una vista sincronizada con la tabla invoice_requests:
 * - Escucha cambios en tiempo real vía Supabase Realtime.
 * - Si el navegador puso la pestaña en segundo plano y el socket
 *   se cayó silenciosamente (común al volver de background/sleep),
 *   refresca igual al recuperar el foco/visibilidad, sin depender
 *   de que el usuario navegue a otra página y regrese.
 */
export function useLiveRefresh(channelName: string, reload: () => void, enabled: boolean) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, () => reloadRef.current())
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") reloadRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [channelName, enabled]);
}
