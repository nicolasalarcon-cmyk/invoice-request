-- Antes: "invoice_files_authenticated_read" permitía a CUALQUIER usuario
-- autenticado leer CUALQUIER archivo del bucket invoice-files (cédulas,
-- soportes, PDFs aprobados de otros comerciales), sin importar si podía
-- ver esa solicitud o no.
--
-- Ahora: solo puede leer un archivo quien...
--   a) lo subió (owner = auth.uid()), o
--   b) tiene un rol que revisa TODAS las solicitudes (financiera/cartera/
--      admin/super_admin — ya lo necesitan para aprobar/rechazar/auditar), o
--   c) es dueño de la solicitud (created_by) a la que ese archivo está
--      asociado — cubre el caso de un comercial viendo el PDF que Financiera
--      subió al aprobar su propia solicitud.

DROP POLICY IF EXISTS "invoice_files_authenticated_read" ON storage.objects;

CREATE POLICY "invoice_files_scoped_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND (
      owner = auth.uid()
      OR has_role(auth.uid(), 'financiera'::app_role)
      OR has_role(auth.uid(), 'cartera'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.invoice_requests r
        WHERE r.created_by = auth.uid()
          AND (
            r.approved_pdf_path = storage.objects.name
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(r.attachments) a
              WHERE a->>'path' = storage.objects.name
            )
          )
      )
    )
  );
