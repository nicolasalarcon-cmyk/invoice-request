-- Campo "Tipo de tarifa" para programas de Especialización en Orden de
-- Matrícula y Factura Colombia (Pago Contado / Pago Egresados / Particulares).
ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS tipo_tarifa text;
