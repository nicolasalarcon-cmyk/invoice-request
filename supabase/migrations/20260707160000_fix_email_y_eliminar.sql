-- Bug 1: snapshot del rol de quien crea la solicitud, para no notificar por
-- correo cuando quien crea Y aprueba/rechaza es un rol interno
-- (admin/super_admin/financiera) probando por su cuenta.
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS created_by_role text;

-- Bug 2a: la politica de archivado del comercial ("Eliminar" = ocultar de su
-- propia vista) nunca se actualizo para incluir el estado "corregida" (se
-- agrego despues en otra migracion). Por eso el UPDATE fallaba en silencio
-- por RLS y el registro reaparecia al recargar la pagina.
DROP POLICY IF EXISTS "Comerciales can archive own finalized requests" ON public.invoice_requests;
CREATE POLICY "Comerciales can archive own finalized requests"
ON public.invoice_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status, 'corregida'::invoice_status)
)
WITH CHECK (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status, 'corregida'::invoice_status)
);

-- Bug 2b: nuevo "Eliminar" (ocultar de su propia vista, sin borrar) para
-- Financiera y Cartera, con su propia bandera para no ocultarle la
-- solicitud a quien la creo ni a Admin/SuperAdmin.
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS archived_by_reviewer boolean NOT NULL DEFAULT false;

CREATE POLICY "Financiera y Cartera pueden ocultar solicitudes finalizadas"
ON public.invoice_requests
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'financiera'::app_role) OR has_role(auth.uid(), 'cartera'::app_role))
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status, 'corregida'::invoice_status)
)
WITH CHECK (
  (has_role(auth.uid(), 'financiera'::app_role) OR has_role(auth.uid(), 'cartera'::app_role))
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status, 'corregida'::invoice_status)
);
