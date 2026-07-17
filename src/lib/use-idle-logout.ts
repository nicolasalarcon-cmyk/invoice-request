"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
const STORAGE_KEY = "lastActivityAt";
// Evita escribir en localStorage en cada mousemove — basta con marcar la
// actividad cada pocos segundos para que el cálculo siga siendo preciso.
const WRITE_THROTTLE_MS = 5000;

/**
 * Cierra la sesión automáticamente tras `timeoutMs` de inactividad real.
 * Guarda la marca de tiempo de la última actividad en localStorage para que,
 * si el navegador (o el PC) se cerró por completo y se vuelve a abrir horas
 * después, se calcule el tiempo real transcurrido en vez de reiniciar el
 * conteo desde cero.
 */
export function useIdleLogout(enabled: boolean, timeoutMs = 60 * 60 * 1000) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let lastWrite = 0;

    const logout = async () => {
      localStorage.removeItem(STORAGE_KEY);
      await supabase.auth.signOut();
      router.replace("/login");
    };

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(logout, Math.max(delay, 0));
    };

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      localStorage.setItem(STORAGE_KEY, String(now));
    };

    const reset = () => {
      markActivity();
      schedule(timeoutMs);
    };

    // Al montar (incluye reabrir el navegador tras haberlo cerrado del
    // todo): si ya pasó más de `timeoutMs` desde la última actividad real
    // registrada, cierra sesión de inmediato en vez de darle otra hora completa.
    const lastActivity = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    const elapsed = lastActivity ? Date.now() - lastActivity : 0;
    if (lastActivity && elapsed >= timeoutMs) {
      logout();
    } else {
      lastWrite = Date.now();
      localStorage.setItem(STORAGE_KEY, String(lastWrite));
      schedule(timeoutMs - elapsed);
    }

    // Si otra pestaña registra actividad, sincroniza el temporizador de esta.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      schedule(timeoutMs - (Date.now() - Number(e.newValue)));
    };
    window.addEventListener("storage", onStorage);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset));

    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [enabled, timeoutMs, router]);
}
