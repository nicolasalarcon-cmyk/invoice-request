
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
  programa TEXT NOT NULL DEFAULT 'AdministraciÃ³n de Empresas',
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


-- Restrict has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Tighten public insert policy with minimal validation
DROP POLICY "Anyone can submit a request" ON public.invoice_requests;

CREATE POLICY "Anyone can submit a valid request"
ON public.invoice_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(nombre) BETWEEN 2 AND 200
  AND length(identificacion) BETWEEN 4 AND 30
  AND (email IS NULL OR length(email) <= 200)
  AND status = 'pendiente'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_first_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_first_admin();

REVOKE EXECUTE ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS descuento_pct numeric NOT NULL DEFAULT 50;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comercial';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'requiere_info';


-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nombre_completo TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + assign 'comercial' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'comercial'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Revoke from public/authenticated; only trigger (which runs as definer) needs it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Extend invoice_requests
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS comercial_nombre TEXT,
  ADD COLUMN IF NOT EXISTS comercial_email TEXT,
  ADD COLUMN IF NOT EXISTS tipo_programa TEXT,
  ADD COLUMN IF NOT EXISTS fecha_fin TEXT,
  ADD COLUMN IF NOT EXISTS concepto TEXT DEFAULT 'MatrÃ­cula',
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS info_requested TEXT;

CREATE INDEX IF NOT EXISTS idx_invoice_requests_created_by ON public.invoice_requests(created_by);

-- Update RLS: remove public insert, allow comercial to manage own
DROP POLICY IF EXISTS "Anyone can submit a valid request" ON public.invoice_requests;

CREATE POLICY "Comerciales can insert own requests"
ON public.invoice_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (public.has_role(auth.uid(), 'comercial'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  AND length(nombre) >= 2 AND length(nombre) <= 200
  AND length(identificacion) >= 4 AND length(identificacion) <= 30
  AND status IN ('pendiente'::invoice_status, 'aprobada'::invoice_status)
);

CREATE POLICY "Comerciales can read own requests"
ON public.invoice_requests FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Comerciales can update own pending requests"
ON public.invoice_requests FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('pendiente'::invoice_status, 'requiere_info'::invoice_status)
);


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'comercial'::app_role)
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.invoice_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  institucion_nombre text NOT NULL DEFAULT 'CorporaciÃ³n Universitaria de CataluÃ±a',
  nit text NOT NULL DEFAULT 'NIT: 901.032.802-6',
  descripcion_legal text NOT NULL DEFAULT 'La CorporaciÃ³n Universitaria de CataluÃ±a es una InstituciÃ³n sin Ã¡nimo de lucro ResoluciÃ³n No. 21329 . No contribuyente del impuesto de Renta (Art. 23 E.T.) Exenta de relaciÃ³n Fuente (Art. 369 E.T.) Servicios excluidos de IVA Art. 92 Ley 30/92. Ley 115/94 y Art. 476 E.T.',
  medios_pago text NOT NULL DEFAULT 'Medios de Pago : Bancolombia Cuenta Ahorros 16869342576 a nombre de CorporaciÃ³n Universitaria de CataluÃ±a NIT 901.032.802-6',
  nota_retencion text NOT NULL DEFAULT 'Favor NO HACER RETENCIÃ“N EN LA FUENTE. Somos una InstituciÃ³n de EducaciÃ³n Superior aprobada por el Ministerio EducaciÃ³n Nacional, segÃºn resoluciÃ³n 21329 de 2016',
  nota_legal text NOT NULL DEFAULT 'RÃ©gimen tributario especial. Esta factura se asimila en todos sus efectos legales a una letra de cambio (art. 621, 773, 774 cÃ³digo de comercio).',
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

-- 1) Ampliar invoice_template para soportar mÃºltiples plantillas
ALTER TABLE public.invoice_template
  ADD COLUMN IF NOT EXISTS nombre text NOT NULL DEFAULT 'Plantilla principal',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_for text;

-- Quitar restricciÃ³n de singleton si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_template_singleton_key'
  ) THEN
    ALTER TABLE public.invoice_template DROP CONSTRAINT invoice_template_singleton_key;
  END IF;
END $$;

ALTER TABLE public.invoice_template ALTER COLUMN singleton DROP NOT NULL;
ALTER TABLE public.invoice_template ALTER COLUMN singleton DROP DEFAULT;

-- Marcar la actual como default si no hay ninguna
UPDATE public.invoice_template
SET is_default = true
WHERE id = (SELECT id FROM public.invoice_template ORDER BY updated_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_template WHERE is_default = true);

-- Permitir DELETE a admins
CREATE POLICY "Admins can delete template"
ON public.invoice_template
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) template_id en invoice_requests
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.invoice_template(id) ON DELETE SET NULL;

-- 3) Tabla form_config (singleton con JSON)
CREATE TABLE IF NOT EXISTS public.form_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_config TO authenticated;
GRANT ALL ON public.form_config TO service_role;

ALTER TABLE public.form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read form_config"
ON public.form_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage form_config"
ON public.form_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial
INSERT INTO public.form_config (config)
SELECT '{
  "conceptos": ["MatrÃ­cula", "MatrÃ­cula parcial", "InscripciÃ³n", "Derecho de grado", "Certificado", "Otro"],
  "tipos_programa": ["Diplomado", "EspecializaciÃ³n"],
  "fields": {
    "email_estudiante": {"visible": true, "label": "Correo"},
    "fecha_fin": {"visible": true, "label": "Fecha de finalizaciÃ³n"},
    "horas_programa": {"visible": true, "label": "Horas / DuraciÃ³n"},
    "observaciones": {"visible": true, "label": "Observaciones"}
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.form_config);
ALTER TABLE public.invoice_template ADD COLUMN IF NOT EXISTS layout jsonb;

-- 1. Descuento bono + parent_id (relanzar)
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS descuento_bono numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.invoice_requests(id) ON DELETE SET NULL;

-- 2. CatÃ¡logo de programas
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

-- 3. HistÃ³rico de numeraciÃ³n (ledger)
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

-- Trigger: snapshot al ledger cuando se aprueba con nÃºmero
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


REVOKE EXECUTE ON FUNCTION public.snapshot_invoice_to_ledger() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Admins delete ledger" ON public.invoice_ledger
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
ALTER TABLE public.programas ADD COLUMN IF NOT EXISTS nemonico text;
CREATE UNIQUE INDEX IF NOT EXISTS programas_nemonico_key ON public.programas (lower(nemonico)) WHERE nemonico IS NOT NULL;
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS duracion text,
  ADD COLUMN IF NOT EXISTS convocatoria text;
UPDATE invoice_template
SET layout = REPLACE(layout::text, 'Horas del Programa :', 'DuraciÃ³n:')::jsonb;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nombre_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
ALTER TABLE public.invoice_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_requests;
CREATE POLICY "Comerciales can delete own finalized requests"
ON public.invoice_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status)
);

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


ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS tipo_persona text,
  ADD COLUMN IF NOT EXISTS numero_participantes integer,
  ADD COLUMN IF NOT EXISTS valor_total_empresa numeric,
  ADD COLUMN IF NOT EXISTS numero_inscripcion text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_pdf_path text;


CREATE POLICY "invoice_files_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'invoice-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'invoice-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "invoice_files_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-files');

CREATE POLICY "invoice_files_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-files');

CREATE POLICY "invoice_files_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-files' AND owner = auth.uid());


-- Evitar que el comercial borre el historico al "eliminar" una solicitud aprobada/rechazada.
-- En su lugar se archiva (se oculta de su lista) pero el registro permanece para
-- Admin, Dashboard y estadisticas.

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS archived_by_comercial boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Comerciales can delete own finalized requests" ON public.invoice_requests;

CREATE POLICY "Comerciales can archive own finalized requests"
ON public.invoice_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND status IN ('aprobada'::invoice_status, 'rechazada'::invoice_status)
);



-- Permite registrar un valor parcial manual para "Matricula Parcial" en
-- Orden de Matricula, que reemplaza el valor total mostrado en la factura
-- sin aplicar descuento ni recargo por mora.

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS valor_parcial numeric;


-- recibo_numero pasa de bigint a texto en toda la plataforma, para permitir
-- consecutivos alfanumericos (ej. Factura Colombia, donde el consecutivo lo
-- define un sistema externo y puede incluir letras).
--
-- El trigger invoice_requests_snapshot_ledger depende de la columna
-- recibo_numero (dispara en UPDATE OF status, recibo_numero), asi que hay
-- que soltarlo antes de cambiar el tipo y volverlo a crear despues.

DROP TRIGGER IF EXISTS invoice_requests_snapshot_ledger ON public.invoice_requests;

ALTER TABLE public.invoice_requests
  ALTER COLUMN recibo_numero TYPE text USING recibo_numero::text;

ALTER TABLE public.invoice_ledger
  ALTER COLUMN recibo_numero TYPE text USING recibo_numero::text;

CREATE TRIGGER invoice_requests_snapshot_ledger
  AFTER INSERT OR UPDATE OF status, recibo_numero ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_invoice_to_ledger();
