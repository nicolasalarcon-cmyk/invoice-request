-- Consecutivos secuenciales e INDEPENDIENTES por tipo de documento.
--
-- Contexto: antes el número de recibo se derivaba de la hora del sistema
-- (Date.now() % 100000000), lo que producía números largos y sin orden.
-- Ahora cada tipo de documento lleva su propio contador, de modo que
-- Factura USA puede ir en 400 mientras Orden de Matrícula va en su propia
-- serie, sin pisarse entre sí.
--
-- Esta migración es idempotente: correrla dos veces no reinicia contadores
-- ni duplica consecutivos ya emitidos.

-- ── 1. El histórico debe distinguir la serie de cada tipo ────────────────────
-- invoice_ledger tenía recibo_numero como llave primaria global, lo que impedía
-- que dos tipos de documento usaran el mismo número. Se pasa a una llave
-- compuesta (tipo de documento + número).

ALTER TABLE public.invoice_ledger
  ADD COLUMN IF NOT EXISTS document_type text;

-- Rellena el tipo de documento de los registros históricos.
UPDATE public.invoice_ledger l
   SET document_type = r.document_type
  FROM public.invoice_requests r
 WHERE l.invoice_id = r.id
   AND l.document_type IS NULL;

-- Registros huérfanos (sin solicitud asociada): se marcan para no perderlos.
UPDATE public.invoice_ledger
   SET document_type = 'desconocido'
 WHERE document_type IS NULL;

ALTER TABLE public.invoice_ledger
  ALTER COLUMN document_type SET NOT NULL;

DO $$
DECLARE
  pk_actual text;
BEGIN
  -- Se busca la llave primaria por su tipo, no por su nombre, para no depender
  -- de cómo la haya bautizado Postgres en este proyecto.
  SELECT conname INTO pk_actual
    FROM pg_constraint
   WHERE conrelid = 'public.invoice_ledger'::regclass
     AND contype = 'p';

  IF pk_actual = 'invoice_ledger_tipo_numero_pkey' THEN
    RETURN; -- ya está aplicada, no hay nada que hacer
  END IF;

  IF pk_actual IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.invoice_ledger DROP CONSTRAINT %I', pk_actual);
  END IF;

  ALTER TABLE public.invoice_ledger
    ADD CONSTRAINT invoice_ledger_tipo_numero_pkey
    PRIMARY KEY (document_type, recibo_numero);
END $$;

-- El trigger de snapshot debe respetar la nueva llave compuesta.
CREATE OR REPLACE FUNCTION public.snapshot_invoice_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprobada' AND NEW.recibo_numero IS NOT NULL THEN
    INSERT INTO public.invoice_ledger (
      recibo_numero, document_type, invoice_id, nombre, identificacion, programa,
      concepto, valor_total, recibo_fecha, comercial_nombre, comercial_email, approved_at
    ) VALUES (
      NEW.recibo_numero, COALESCE(NEW.document_type, 'desconocido'), NEW.id, NEW.nombre,
      NEW.identificacion, NEW.programa, NEW.concepto, NEW.valor_total, NEW.recibo_fecha,
      NEW.comercial_nombre, NEW.comercial_email, NEW.approved_at
    )
    ON CONFLICT (document_type, recibo_numero) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Tabla de contadores, uno por tipo de documento ────────────────────────
CREATE TABLE IF NOT EXISTS public.consecutivos (
  document_type text PRIMARY KEY,
  ultimo_numero bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consecutivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen consecutivos" ON public.consecutivos;
CREATE POLICY "Admins leen consecutivos"
  ON public.consecutivos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.consecutivos TO authenticated;
GRANT ALL ON public.consecutivos TO service_role;

-- Factura USA arranca en 399 "ya consumido" → la próxima aprobada sale con 400.
-- ON CONFLICT DO NOTHING evita reiniciar el contador si ya estaba configurado.
INSERT INTO public.consecutivos (document_type, ultimo_numero)
VALUES ('factura_usa', 399)
ON CONFLICT (document_type) DO NOTHING;

-- ── 3. Entrega del siguiente consecutivo ─────────────────────────────────────
--
-- Garantía de no repetición, en dos capas:
--   1. El UPDATE ... RETURNING bloquea la fila del contador, así que dos
--      aprobaciones simultáneas nunca reciben el mismo número.
--   2. Si el número siguiente ya estuviera ocupado DENTRO DE ESA MISMA SERIE
--      (por un consecutivo cargado a mano, por ejemplo), se descarta y se pide
--      el siguiente hasta hallar uno libre.
CREATE OR REPLACE FUNCTION public.next_consecutivo(_document_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidato text;
BEGIN
  LOOP
    UPDATE public.consecutivos
       SET ultimo_numero = ultimo_numero + 1,
           updated_at = now()
     WHERE document_type = _document_type
    RETURNING ultimo_numero::text INTO candidato;

    IF candidato IS NULL THEN
      RAISE EXCEPTION 'No hay consecutivo configurado para el tipo de documento %', _document_type;
    END IF;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.invoice_requests
       WHERE recibo_numero = candidato AND document_type = _document_type
    ) AND NOT EXISTS (
      SELECT 1 FROM public.invoice_ledger
       WHERE recibo_numero = candidato AND document_type = _document_type
    );
  END LOOP;

  RETURN candidato;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_consecutivo(text) TO authenticated;

-- Limpieza: elimina la versión anterior basada en secuencia, si llegó a crearse.
DROP FUNCTION IF EXISTS public.next_factura_usa_consecutivo();
DROP SEQUENCE IF EXISTS public.factura_usa_consecutivo;
