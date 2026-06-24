
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Invoice requests
CREATE TYPE public.invoice_status AS ENUM ('pendiente', 'aprobada', 'rechazada');

CREATE TABLE public.invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.invoice_status NOT NULL DEFAULT 'pendiente',

  -- Student data
  nombre TEXT NOT NULL,
  identificacion TEXT NOT NULL,
  email TEXT,
  codigo_estudiante TEXT,

  -- Program data
  programa TEXT NOT NULL DEFAULT 'Administración de Empresas',
  codigo_snies TEXT DEFAULT '108572',
  periodo TEXT NOT NULL DEFAULT '1er Semestre 2026',
  cohorte TEXT DEFAULT 'DGCOIA07',
  plan_estudio TEXT DEFAULT 'Gerencia Comercial con Inteligencia Artificial',
  fecha_inicio TEXT DEFAULT 'Junio 2026',
  horas_programa INTEGER DEFAULT 160,

  -- Financial
  matricula NUMERIC(14,2) NOT NULL DEFAULT 4312500,
  descuento NUMERIC(14,2) NOT NULL DEFAULT 2156250,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 2156250,
  recargo_total NUMERIC(14,2) NOT NULL DEFAULT 2371875,
  fecha_limite_pago DATE,
  fecha_pago_extraordinario DATE,

  -- Receipt metadata
  recibo_numero BIGINT,
  recibo_fecha DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Approval
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Origin (for future Google Sheets sync)
  source TEXT NOT NULL DEFAULT 'form',
  source_row_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_requests TO authenticated;
GRANT INSERT ON public.invoice_requests TO anon;
GRANT ALL ON public.invoice_requests TO service_role;

ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request
CREATE POLICY "Anyone can submit a request"
ON public.invoice_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read all requests"
ON public.invoice_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update requests"
ON public.invoice_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete requests"
ON public.invoice_requests FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_invoice_requests_updated_at
BEFORE UPDATE ON public.invoice_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_invoice_requests_status ON public.invoice_requests(status, created_at DESC);
