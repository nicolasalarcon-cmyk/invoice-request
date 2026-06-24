UPDATE invoice_template
SET layout = REPLACE(layout::text, 'Horas del Programa :', 'Duración:')::jsonb;
