CREATE POLICY "Admins delete ledger" ON public.invoice_ledger
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));