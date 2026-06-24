
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS tipo_persona text,
  ADD COLUMN IF NOT EXISTS numero_participantes integer,
  ADD COLUMN IF NOT EXISTS valor_total_empresa numeric,
  ADD COLUMN IF NOT EXISTS numero_inscripcion text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_pdf_path text;
