-- Feature "Lista Cerrada" para Persona Jurídica (Factura Colombia, USA, PayPal).
-- lista_cerrada = true (default): comportamiento histórico, un solo valor total
-- para la empresa, sin datos individuales de participantes.
-- lista_cerrada = false: se cobra por participante (valor_por_estudiante,
-- descuento, valor total por estudiante y valor total a pagar por la empresa).
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS lista_cerrada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valor_por_estudiante numeric;
