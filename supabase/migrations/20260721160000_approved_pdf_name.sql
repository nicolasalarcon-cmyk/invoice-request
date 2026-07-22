-- Guarda el nombre real del archivo que Financiera/Admin sube como la
-- "factura aprobada" externa (Factura Colombia / Factura PayPal). Antes solo
-- se guardaba la ruta en Storage (con nombre aleatorio) y la extensión; el
-- nombre original del archivo se perdía por completo. Con esta columna,
-- los archivos subidos de aquí en adelante conservan su nombre real para
-- poder identificarlos en un backup. Los archivos ya subidos antes de este
-- cambio no se pueden recuperar retroactivamente (el dato nunca se guardó).
ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS approved_pdf_name text;
