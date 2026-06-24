
CREATE POLICY "invoice_files_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'invoice-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'invoice-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "invoice_files_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-files');

CREATE POLICY "invoice_files_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-files');

CREATE POLICY "invoice_files_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-files' AND owner = auth.uid());
