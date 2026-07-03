"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

/** Cierra la sesión automáticamente tras `timeoutMs` de inactividad (sin mouse/teclado/scroll). */
export function useIdleLogout(enabled: boolean, timeoutMs = 60 * 60 * 1000) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const logout = async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    };

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [enabled, timeoutMs, router]);
}
