-- PASO 2 de 3 — correr DESPUÉS de 20260722090000_add_mini_financiera_role.sql.
--
-- Feature "Gestión de Pago" / rol Mini Financiera.
--
-- pago_aplicado: checkbox que Cartera marca al CREAR una Factura USA/
-- Colombia/PayPal (vacío por defecto). Es la puerta de visibilidad: Mini
-- Financiera solo ve las solicitudes donde este campo está en true.
--
-- gestion_pago / gestion_pago_nota / gestion_pago_adjuntos / gestion_pago_at
-- / gestion_pago_by: el "segundo estado", que Mini Financiera (o Cartera o
-- Financiera) define DESPUÉS, desde el detalle, con dos botones tipo
-- Aprobar/Rechazar ("Pago Aplicado" / "Pago NO Aplicado"). No es lo mismo
-- que el estado principal de la solicitud (pendiente/aprobada/rechazada) y
-- NO dispara correo. Nota y adjuntos son opcionales, solo de soporte.

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS pago_aplicado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gestion_pago text,
  ADD COLUMN IF NOT EXISTS gestion_pago_nota text,
  ADD COLUMN IF NOT EXISTS gestion_pago_adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gestion_pago_at timestamptz,
  ADD COLUMN IF NOT EXISTS gestion_pago_by uuid;

ALTER TABLE public.invoice_requests
  DROP CONSTRAINT IF EXISTS invoice_requests_gestion_pago_check;
ALTER TABLE public.invoice_requests
  ADD CONSTRAINT invoice_requests_gestion_pago_check
  CHECK (gestion_pago IS NULL OR gestion_pago IN ('aplicado', 'no_aplicado'));
