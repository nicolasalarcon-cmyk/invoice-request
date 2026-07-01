import { supabase } from "@/integrations/supabase/client";

/**
 * Borra en cascada los archivos de Storage asociados a una solicitud
 * (adjuntos del comercial + PDF aprobado subido a mano), cuando el
 * registro se elimina definitivamente de la base de datos.
 */
export async function deleteInvoiceFiles(
  attachments: { path: string }[] | null | undefined,
  approvedPdfPath: string | null | undefined,
) {
  const paths = [
    ...((attachments ?? []).map((a) => a.path)),
    ...(approvedPdfPath ? [approvedPdfPath] : []),
  ];
  if (paths.length === 0) return;
  await supabase.storage.from("invoice-files").remove(paths).catch(() => {});
}
