
-- Restrict has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Tighten public insert policy with minimal validation
DROP POLICY "Anyone can submit a request" ON public.invoice_requests;

CREATE POLICY "Anyone can submit a valid request"
ON public.invoice_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(nombre) BETWEEN 2 AND 200
  AND length(identificacion) BETWEEN 4 AND 30
  AND (email IS NULL OR length(email) <= 200)
  AND status = 'pendiente'
  AND approved_by IS NULL
  AND approved_at IS NULL
);
