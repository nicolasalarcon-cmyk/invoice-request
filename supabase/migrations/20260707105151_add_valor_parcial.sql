-- Permite registrar un valor parcial manual para "Matrícula Parcial" en
-- Orden de Matrícula, que reemplaza el valor total mostrado en la factura
-- sin aplicar descuento ni recargo por mora.

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS valor_parcial numeric;
