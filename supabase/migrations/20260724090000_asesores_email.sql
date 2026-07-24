-- Correo del asesor comercial, para copiarlo en las notificaciones de
-- aprobación/rechazo cuando el creador de la solicitud es rol Comercial.
ALTER TABLE asesores ADD COLUMN IF NOT EXISTS email text;
