import { pdf } from "@react-pdf/renderer";
import React from "react";
import { getInvoiceTemplate, type InvoiceTemplate } from "./invoice-template";
import type { ResolverData } from "./invoice-layout";
import { OrdenMatriculaDocument } from "./pdf-react/orden-matricula";
import { FacturaUSADocument } from "./pdf-react/factura-usa";

export interface Participant {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
}

export interface InvoiceData extends ResolverData {
  template_id?: string | null;
  tipo_programa?: string | null;
  document_type?: string | null;
  tipo_persona?: string | null;
  valor_parcial?: number | null;
  valor_total?: number | null;
  valor_total_empresa?: number | null;
  numero_participantes?: number | null;
  participantes?: Participant[] | null;
  descuento?: number | null;
  // Factura USA fields
  empresa?: string | null;
  cliente_nit?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  pais?: string | null;
  email?: string | null;
  nemonico?: string | null;
  observaciones?: string | null;
}

function isUsaInvoice(data: InvoiceData): boolean {
  return (
    data.document_type === "factura_usa" ||
    (data.tipo_programa ?? "").toLowerCase().includes("usa")
  );
}

async function buildDocument(
  data: InvoiceData,
  tplOverride?: InvoiceTemplate,
): Promise<ReturnType<typeof pdf>> {
  const tpl =
    tplOverride ??
    (await getInvoiceTemplate(data.template_id || data.tipo_programa || null));

  const element = isUsaInvoice(data)
    ? React.createElement(FacturaUSADocument, { data, _tpl: tpl })
    : React.createElement(OrdenMatriculaDocument, { data, tpl });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf(element as any);
}

/** Returns a base64 string (no data: prefix) for emailing. */
export async function getPdfBase64(data: InvoiceData, tplOverride?: InvoiceTemplate): Promise<string> {
  const instance = await buildDocument(data, tplOverride);
  const blob = await instance.toBlob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Returns a data URL string for embedding in an iframe preview. */
export async function getInvoicePdfDataUrl(
  data: InvoiceData,
  tplOverride?: InvoiceTemplate,
): Promise<string> {
  const instance = await buildDocument(data, tplOverride);
  const blob = await instance.toBlob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Downloads the PDF directly in the browser. */
export async function generateInvoicePDF(
  data: InvoiceData,
  tplOverride?: InvoiceTemplate,
): Promise<void> {
  const instance = await buildDocument(data, tplOverride);
  const blob = await instance.toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = invoiceFilename(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function invoiceFilename(data: InvoiceData): string {
  return `recibo-${data.recibo_numero ?? "sin-numero"}-${data.identificacion}.pdf`;
}
