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

// ─── Kept for the visual layout editor (admin.plantillas.$id.editor.tsx) ──────
// The editor uses jsPDF + DEFAULT_LAYOUT to render a canvas preview.
// It does NOT call buildInvoiceDoc for generation — only for the in-editor preview.
export { DEFAULT_LAYOUT } from "./invoice-layout";

// Legacy export so the visual editor's import doesn't break.
// Returns a jsPDF instance (still used by the editor).
export async function buildInvoiceDoc(
  data: InvoiceData,
  layoutOverride?: import("./invoice-layout").InvoiceLayout,
  tplOverride?: InvoiceTemplate,
) {
  // Dynamic import to keep jsPDF out of the main PDF bundle
  const { jsPDF } = await import("jspdf");
  const { ensurePdfFont } = await import("./pdf-font");
  const {
    DEFAULT_LAYOUT: DL,
    resolveField,
    fixMojibake,
  } = await import("./invoice-layout");
  const logoMod = await import("@/assets/logo-cataluna.png");
  const logoRaw = logoMod.default;
  const logoUrl: string = typeof logoRaw === "string" ? logoRaw : (logoRaw as { src: string }).src;

  const tpl =
    tplOverride ??
    (await getInvoiceTemplate(data.template_id || data.tipo_programa || null));
  const layout = layoutOverride ?? DL;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  await ensurePdfFont(doc);

  // Fetch logo as dataURL
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  const logoDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  // Minimal render just for the editor preview (draws elements from the layout)
  const PW = doc.internal.pageSize.getWidth();
  const M = 12;
  const tagW = 16;
  const left = M + Math.max(0, (PW - 2 * M - layout.width - tagW) / 2);

  function hexToRgb(hex?: string): [number, number, number] {
    if (!hex) return [0, 0, 0];
    const m = hex.replace("#", "");
    const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    const v = parseInt(n, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  const PDF_FONT = "Arial";

  function drawEl(el: import("./invoice-layout").LayoutEl, ox: number, oy: number) {
    switch (el.type) {
      case "rect": {
        if (el.fill) {
          const [r, g, b] = hexToRgb(el.fill);
          doc.setFillColor(r, g, b);
        }
        if (el.stroke !== undefined) {
          const [r, g, b] = hexToRgb(el.stroke);
          doc.setDrawColor(r, g, b);
        } else {
          doc.setDrawColor(170, 170, 170);
        }
        doc.setLineWidth(el.lineWidth ?? 0.5);
        doc.rect(ox + el.x, oy + el.y, el.w, el.h, el.fill ? "FD" : "S");
        break;
      }
      case "line": {
        doc.setDrawColor(170, 170, 170);
        doc.setLineWidth(el.lineWidth ?? 0.5);
        if (el.dashed) doc.setLineDashPattern([3, 3], 0);
        doc.line(ox + el.x, oy + el.y, ox + el.x2, oy + el.y2);
        if (el.dashed) doc.setLineDashPattern([], 0);
        break;
      }
      case "image": {
        doc.addImage(logoDataUrl, "PNG", ox + el.x, oy + el.y, el.w, el.h);
        break;
      }
      case "emblem": {
        const NAVY: [number, number, number] = [16, 22, 120];
        const baseline = oy + el.y + el.h * 0.78;
        doc.setTextColor(...NAVY);
        let cx = ox + el.x;
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(el.h);
        doc.text("U", cx, baseline);
        cx += doc.getTextWidth("U") + el.h * 0.04;
        doc.setFont(PDF_FONT, "normal");
        doc.setFontSize(el.h * 0.5);
        doc.text("de", cx, baseline);
        cx += doc.getTextWidth("de") + el.h * 0.04;
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(el.h * 0.82);
        doc.text("Cataluña", cx, baseline);
        break;
      }
      case "text":
      case "field": {
        const text =
          el.type === "text"
            ? el.text
            : resolveField(el, data, tpl);
        doc.setFont(PDF_FONT, el.bold ? "bold" : "normal");
        doc.setFontSize(el.fontSize);
        const [r, g, b] = hexToRgb(el.color ?? "#000");
        doc.setTextColor(r, g, b);
        const align = el.align ?? "left";
        if (el.w) {
          const lines = doc.splitTextToSize(fixMojibake(text), el.w);
          for (let i = 0; i < lines.length; i++) {
            doc.text(lines[i], ox + el.x, oy + el.y + i * (el.fontSize + 1), { align });
          }
        } else {
          doc.text(fixMojibake(text), ox + el.x, oy + el.y, { align });
        }
        break;
      }
    }
  }

  function drawCopy(top: number) {
    for (const el of layout.elements) drawEl(el, left, top);
    const tagW2 = 16;
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.6);
    doc.rect(left, top, layout.width + tagW2, layout.height);
    doc.line(left + layout.width, top, left + layout.width, top + layout.height);
    return top + layout.height;
  }

  const bottom1 = drawCopy(M);
  doc.setLineDashPattern([3, 3], 0);
  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.8);
  doc.line(left, bottom1 + 5, left + layout.width + tagW, bottom1 + 5);
  doc.setLineDashPattern([], 0);
  drawCopy(bottom1 + 10);

  const PH = doc.internal.pageSize.getHeight();
  return { doc, left, top: M, layout, pageWidth: PW, pageHeight: PH };
}
