ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS duracion text,
  ADD COLUMN IF NOT EXISTS convocatoria text;