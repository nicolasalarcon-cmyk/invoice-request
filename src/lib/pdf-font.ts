import type { jsPDF } from "jspdf";
import regularUrl from "@/assets/fonts/Arial-Regular.ttf?url";
import boldUrl from "@/assets/fonts/Arial-Bold.ttf?url";

// Fuente incrustada para los PDF.
// Las fuentes estándar de jsPDF (Helvetica) NO soportan Unicode: al encontrar
// acentos o símbolos cambia a UTF-16 pero las declara WinAnsi, produciendo
// caracteres extraños y texto superpuesto. Incrustar un TTF lo resuelve.
export const PDF_FONT = "Arial";

let cached: { regular: string; bold: string } | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontData() {
  if (cached) return cached;
  const [regular, bold] = await Promise.all([
    fetchAsBase64(regularUrl),
    fetchAsBase64(boldUrl),
  ]);
  cached = { regular, bold };
  return cached;
}

/**
 * Registra la fuente Unicode en el documento y la deja como fuente activa.
 * Llamar justo después de crear el jsPDF y antes de escribir texto.
 */
export async function ensurePdfFont(doc: jsPDF): Promise<void> {
  const data = await loadFontData();
  doc.addFileToVFS("Arial-Regular.ttf", data.regular);
  doc.addFont("Arial-Regular.ttf", PDF_FONT, "normal");
  doc.addFileToVFS("Arial-Bold.ttf", data.bold);
  doc.addFont("Arial-Bold.ttf", PDF_FONT, "bold");
  doc.setFont(PDF_FONT, "normal");
}
