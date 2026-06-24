
CREATE TABLE public.invoice_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  institucion_nombre text NOT NULL DEFAULT 'Corporación Universitaria de Cataluña',
  nit text NOT NULL DEFAULT 'NIT: 901.032.802-6',
  descripcion_legal text NOT NULL DEFAULT 'La Corporación Universitaria de Cataluña es una Institución sin ánimo de lucro Resolución No. 21329 . No contribuyente del impuesto de Renta (Art. 23 E.T.) Exenta de relación Fuente (Art. 369 E.T.) Servicios excluidos de IVA Art. 92 Ley 30/92. Ley 115/94 y Art. 476 E.T.',
  medios_pago text NOT NULL DEFAULT 'Medios de Pago : Bancolombia Cuenta Ahorros 16869342576 a nombre de Corporación Universitaria de Cataluña NIT 901.032.802-6',
  nota_retencion text NOT NULL DEFAULT 'Favor NO HACER RETENCIÓN EN LA FUENTE. Somos una Institución de Educación Superior aprobada por el Ministerio Educación Nacional, según resolución 21329 de 2016',
  nota_legal text NOT NULL DEFAULT 'Régimen tributario especial. Esta factura se asimila en todos sus efectos legales a una letra de cambio (art. 621, 773, 774 código de comercio).',
  recargo_pct numeric NOT NULL DEFAULT 10,
  dias_limite int NOT NULL DEFAULT 4,
  dias_extraordinario int NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_template TO authenticated;
GRANT ALL ON public.invoice_template TO service_role;

ALTER TABLE public.invoice_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read template"
  ON public.invoice_template FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update template"
  ON public.invoice_template FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert template"
  ON public.invoice_template FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.invoice_template (singleton) VALUES (true) ON CONFLICT DO NOTHING;
