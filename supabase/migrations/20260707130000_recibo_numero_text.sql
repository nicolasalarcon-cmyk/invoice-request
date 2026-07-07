-- recibo_numero pasa de bigint a texto en toda la plataforma, para permitir
-- consecutivos alfanuméricos (ej. Factura Colombia, donde el consecutivo lo
-- define un sistema externo y puede incluir letras).
--
-- El trigger invoice_requests_snapshot_ledger depende de la columna
-- recibo_numero (dispara en UPDATE OF status, recibo_numero), así que hay
-- que soltarlo antes de cambiar el tipo y volverlo a crear después.

DROP TRIGGER IF EXISTS invoice_requests_snapshot_ledger ON public.invoice_requests;

ALTER TABLE public.invoice_requests
  ALTER COLUMN recibo_numero TYPE text USING recibo_numero::text;

ALTER TABLE public.invoice_ledger
  ALTER COLUMN recibo_numero TYPE text USING recibo_numero::text;

CREATE TRIGGER invoice_requests_snapshot_ledger
  AFTER INSERT OR UPDATE OF status, recibo_numero ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_invoice_to_ledger();
