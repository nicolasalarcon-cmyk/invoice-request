-- Permite que el creador de una solicitud la elimine definitivamente, pero
-- SOLO mientras sigue "pendiente" (nunca fue aprobada, rechazada ni
-- corregida) Y no es en sí misma una corrección de otra solicitud (parent_id
-- es null). Es decir: solo se puede borrar una solicitud recién creada que
-- todavía nadie ha revisado.
--
-- Es puramente aditiva: no reemplaza ni modifica "Admins can delete
-- requests" (Admin/Super Admin conservan su permiso de borrar cualquier
-- solicitud, en cualquier estado, sin cambios).
CREATE POLICY "Creators can delete own pending first-time requests"
ON public.invoice_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  AND status = 'pendiente'::invoice_status
  AND parent_id IS NULL
);
