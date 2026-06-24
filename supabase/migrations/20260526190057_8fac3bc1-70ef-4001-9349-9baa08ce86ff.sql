ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS descuento_pct numeric NOT NULL DEFAULT 50;