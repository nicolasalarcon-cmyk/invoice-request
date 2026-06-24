
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'orden_matricula',
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS nit text,
  ADD COLUMN IF NOT EXISTS nemonico text,
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS telefono text;

CREATE INDEX IF NOT EXISTS idx_invoice_requests_document_type ON public.invoice_requests(document_type);

ALTER TABLE public.invoice_ledger
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'orden_matricula';
