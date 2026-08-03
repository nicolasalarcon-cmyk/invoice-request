import { supabase } from "@/integrations/supabase/client";

/**
 * Avisa por correo (al líder comercial, con copia al asesor si aplica) que
 * una solicitud recién creada quedó pendiente de revisión. Es "best effort":
 * si falla, no debe bloquear ni revertir la creación de la solicitud —
 * por eso nunca lanza el error, solo lo deja pasar en silencio.
 *
 * El servidor vuelve a resolver todos los datos (correo, nombre, asesor)
 * directamente desde la fila en la base usando el service role, y verifica
 * que quien llama sea el propio creador — el cliente solo manda el id.
 */
export async function notifyRequestCreated(requestId: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await fetch("/api/admin/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind: "created", request_id: requestId }),
    });
  } catch {
    // Silencioso a propósito.
  }
}
