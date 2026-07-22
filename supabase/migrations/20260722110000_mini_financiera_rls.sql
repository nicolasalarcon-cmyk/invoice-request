-- PASO 3 de 3 — correr al final, después de los otros dos archivos.
--
-- Acceso de Mini Financiera: solo puede ver y actualizar (para el botón de
-- Gestión de Pago) las solicitudes que Cartera marcó con pago_aplicado = true.
--
-- Nota: no pude verificar desde el repositorio cómo quedaron exactamente
-- las políticas actuales de financiera/cartera (parecen haberse creado a
-- mano en el Dashboard, no quedaron en ninguna migración rastreable). Esta
-- política es ADITIVA — no reemplaza ni toca ninguna política existente,
-- solo agrega acceso nuevo para el rol nuevo. Si algo no se ve como se
-- espera, probablemente haga falta revisar las políticas ya existentes
-- directamente en Supabase.

DROP POLICY IF EXISTS "Mini financiera ve solo pagos aplicados" ON public.invoice_requests;
CREATE POLICY "Mini financiera ve solo pagos aplicados"
ON public.invoice_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'mini_financiera'::app_role) AND pago_aplicado = true);

DROP POLICY IF EXISTS "Mini financiera puede gestionar pago" ON public.invoice_requests;
CREATE POLICY "Mini financiera puede gestionar pago"
ON public.invoice_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'mini_financiera'::app_role) AND pago_aplicado = true)
WITH CHECK (has_role(auth.uid(), 'mini_financiera'::app_role) AND pago_aplicado = true);
