
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
  ADD COLUMN IF NOT EXISTS concepto TEXT DEFAULT 'Matrícula',
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
