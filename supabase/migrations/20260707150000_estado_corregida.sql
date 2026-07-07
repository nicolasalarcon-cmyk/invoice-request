-- Nuevo estado "corregida": una solicitud que fue aprobada, se envio a
-- correccion (por rechazo o por ajuste post-aprobacion) y financiera volvio
-- a aprobarla. Se distingue de "aprobada" para dar trazabilidad.
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'corregida';
