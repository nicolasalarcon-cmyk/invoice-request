-- Lugar de expedición del documento de identidad, para Persona Natural en
-- Factura Colombia (obligatorio para el rol comercial).
ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS lugar_expedicion text;
