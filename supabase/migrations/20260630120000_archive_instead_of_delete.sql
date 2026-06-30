-- Evitar que el comercial borre el historico al "eliminar" una solicitud aprobada/rechazada.
-- En su lugar se archiva (se oculta de su lista) pero el registro permanece para
-- Admin, Dashboard y estadisticas.

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS archived_by_comercial boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Comerciales can delete own finalized requests" ON public.invoice_requests;

CREATE POLICY "Comerciales can archive own finalized requests"
ON public.invoice_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status)
);
