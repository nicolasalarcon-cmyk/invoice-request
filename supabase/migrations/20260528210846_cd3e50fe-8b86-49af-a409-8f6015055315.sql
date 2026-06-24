
-- 1. Descuento bono + parent_id (relanzar)
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS descuento_bono numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.invoice_requests(id) ON DELETE SET NULL;

-- 2. Catálogo de programas
CREATE TABLE IF NOT EXISTS public.programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo_snies text,
  tipo_programa text,
  cohorte text,
  plan_estudio text,
  horas_programa integer,
  fecha_inicio text,
  fecha_fin text,
  matricula_default numeric DEFAULT 0,
  periodo_default text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.programas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.programas TO authenticated;
GRANT ALL ON public.programas TO service_role;

ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read programas"
  ON public.programas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage programas insert"
  ON public.programas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage programas update"
  ON public.programas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage programas delete"
  ON public.programas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER programas_set_updated_at
  BEFORE UPDATE ON public.programas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Histórico de numeración (ledger)
CREATE TABLE IF NOT EXISTS public.invoice_ledger (
  recibo_numero bigint PRIMARY KEY,
  invoice_id uuid,
  nombre text NOT NULL,
  identificacion text NOT NULL,
  programa text,
  concepto text,
  valor_total numeric NOT NULL DEFAULT 0,
  recibo_fecha date NOT NULL,
  comercial_nombre text,
  comercial_email text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_ledger TO authenticated;
GRANT ALL ON public.invoice_ledger TO service_role;

ALTER TABLE public.invoice_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ledger"
  ON public.invoice_ledger FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: snapshot al ledger cuando se aprueba con número
CREATE OR REPLACE FUNCTION public.snapshot_invoice_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprobada' AND NEW.recibo_numero IS NOT NULL THEN
    INSERT INTO public.invoice_ledger (
      recibo_numero, invoice_id, nombre, identificacion, programa, concepto,
      valor_total, recibo_fecha, comercial_nombre, comercial_email, approved_at
    ) VALUES (
      NEW.recibo_numero, NEW.id, NEW.nombre, NEW.identificacion, NEW.programa, NEW.concepto,
      NEW.valor_total, NEW.recibo_fecha, NEW.comercial_nombre, NEW.comercial_email, NEW.approved_at
    )
    ON CONFLICT (recibo_numero) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_requests_snapshot_ledger ON public.invoice_requests;
CREATE TRIGGER invoice_requests_snapshot_ledger
  AFTER INSERT OR UPDATE OF status, recibo_numero ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_invoice_to_ledger();

-- Seed: copiar facturas ya aprobadas existentes
INSERT INTO public.invoice_ledger (
  recibo_numero, invoice_id, nombre, identificacion, programa, concepto,
  valor_total, recibo_fecha, comercial_nombre, comercial_email, approved_at
)
SELECT recibo_numero, id, nombre, identificacion, programa, concepto,
       valor_total, recibo_fecha, comercial_nombre, comercial_email, approved_at
FROM public.invoice_requests
WHERE status = 'aprobada' AND recibo_numero IS NOT NULL
ON CONFLICT (recibo_numero) DO NOTHING;

-- 4. RLS: comercial puede actualizar sus rechazadas
DROP POLICY IF EXISTS "Comerciales can update own pending requests" ON public.invoice_requests;
CREATE POLICY "Comerciales can update own editable requests"
  ON public.invoice_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    AND status = ANY (ARRAY['pendiente'::invoice_status, 'requiere_info'::invoice_status, 'rechazada'::invoice_status])
  );
