CREATE POLICY "Comerciales can delete own finalized requests"
ON public.invoice_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status)
);