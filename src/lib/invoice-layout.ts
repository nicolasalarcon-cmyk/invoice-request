// Layout = lista de elementos absolutamente posicionados sobre el área del recibo.
// Coordenadas en puntos PDF (1pt = 1/72"). Origen en la esquina superior izquierda del recibo.
// El renderer del PDF y el editor visual usan el MISMO esquema, así lo que ves es lo que sale.

import { formatDate } from "./format";

export type FieldKey =
  | "nombre"
  | "identificacion"
  | "codigo_estudiante"
  | "programa"
  | "codigo_snies"
  | "programa_full"
  | "programa_cohorte"
  | "periodo"
  | "cohorte"
  | "plan_estudio"
  | "fecha_inicio"
  | "fecha_fin"
  | "horas_programa"
  | "duracion"
  | "convocatoria"
  | "concepto"
  | "observaciones"
  | "matricula"
  | "descuento"
  | "descuento_pct"
  | "descuento_bono"
  | "valor_total"
  | "recargo_total"
  | "fecha_limite_pago"
  | "fecha_pago_extraordinario"
  | "recibo_numero"
  | "recibo_fecha"
  | "tpl.institucion_nombre"
  | "tpl.nit"
  | "tpl.descripcion_legal"
  | "tpl.medios_pago"
  | "tpl.nota_retencion"
  | "tpl.nota_legal";

export const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "recibo_numero", label: "N° Recibo" },
  { key: "recibo_fecha", label: "Fecha del recibo" },
  { key: "nombre", label: "Nombre" },
  { key: "identificacion", label: "Identificación" },
  { key: "codigo_estudiante", label: "Código estudiante" },
  { key: "programa", label: "Programa" },
  { key: "codigo_snies", label: "Código SNIES" },
  { key: "programa_full", label: "Programa + SNIES" },
  { key: "programa_cohorte", label: "Programa + Cohorte" },
  { key: "periodo", label: "Período" },
  { key: "cohorte", label: "Cohorte" },
  { key: "plan_estudio", label: "Nombre del Diplomado" },
  { key: "fecha_inicio", label: "Fecha de inicio" },
  { key: "fecha_fin", label: "Fecha de fin" },
  { key: "horas_programa", label: "Horas del programa" },
  { key: "duracion", label: "Duración (texto)" },
  { key: "convocatoria", label: "Convocatoria" },
  { key: "concepto", label: "Concepto" },
  { key: "observaciones", label: "Observaciones" },
  { key: "matricula", label: "Valor matrícula" },
  { key: "descuento", label: "Descuento ($)" },
  { key: "descuento_pct", label: "Descuento (%)" },
  { key: "descuento_bono", label: "Descuento Bono ($)" },
  { key: "valor_total", label: "Valor total" },
  { key: "recargo_total", label: "Valor con recargo" },
  { key: "fecha_limite_pago", label: "Fecha límite de pago" },
  { key: "fecha_pago_extraordinario", label: "Fecha pago extraordinario" },
  { key: "tpl.institucion_nombre", label: "Institución" },
  { key: "tpl.nit", label: "NIT (plantilla)" },
  { key: "tpl.descripcion_legal", label: "Descripción legal (plantilla)" },
  { key: "tpl.medios_pago", label: "Medios de pago (plantilla)" },
  { key: "tpl.nota_retencion", label: "Nota retención (plantilla)" },
  { key: "tpl.nota_legal", label: "Nota legal (plantilla)" },
];

export type Align = "left" | "center" | "right";

interface BaseEl {
  id: string;
  x: number;
  y: number;
}

export interface TextEl extends BaseEl {
  type: "text";
  text: string;
  fontSize: number;
  bold?: boolean;
  align?: Align;
  color?: string;
  w?: number; // ancho para word-wrap (opcional)
}

export interface FieldEl extends BaseEl {
  type: "field";
  key: FieldKey;
  fontSize: number;
  bold?: boolean;
  align?: Align;
  color?: string;
  w?: number;
  prefix?: string;
  suffix?: string;
  format?: "text" | "currency" | "date";
}

export interface RectEl extends BaseEl {
  type: "rect";
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
}

export interface LineEl {
  id: string;
  type: "line";
  x: number;
  y: number;
  x2: number;
  y2: number;
  lineWidth?: number;
  dashed?: boolean;
}

export interface ImageEl extends BaseEl {
  type: "image";
  src: "logo";
  w: number;
  h: number;
}

// Emblema institucional dibujado por código (sin imagen). El render lo dibuja.
export interface EmblemEl extends BaseEl {
  type: "emblem";
  w: number;
  h: number;
}

export type LayoutEl = TextEl | FieldEl | RectEl | LineEl | ImageEl | EmblemEl;

export interface InvoiceLayout {
  width: number; // ancho total del recibo en puntos
  height: number; // alto en puntos
  elements: LayoutEl[];
}

// ============================================================
// VALUE RESOLVER
// ============================================================

function fmtMoney(n: number) {
  return `$ ${Number(n || 0).toLocaleString("es-CO")}`;
}

// Repara texto con doble codificación UTF-8 (mojibake), p.ej. "CorporaciÃ³n" → "Corporación".
// Solo actúa si detecta los marcadores típicos de mojibake para no tocar texto correcto.
export function fixMojibake(s: string): string {
  if (!s || !/[ÃÂ][-¿]|â€/.test(s)) return s;
  try {
    const bytes = Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return s;
  }
}

export interface ResolverData {
  recibo_numero: string | null;
  recibo_fecha: string;
  nombre: string;
  identificacion: string;
  codigo_estudiante: string | null;
  programa: string;
  tipo_programa?: string | null;
  codigo_snies: string | null;
  periodo: string;
  cohorte: string | null;
  plan_estudio: string | null;
  fecha_inicio: string | null;
  fecha_fin?: string | null;
  horas_programa: number | null;
  duracion?: string | null;
  convocatoria?: string | null;
  concepto?: string | null;
  matricula: number;
  descuento_pct: number;
  descuento_bono?: number;
  recargo_total: number;
  fecha_limite_pago: string | null;
  fecha_pago_extraordinario: string | null;
}

export interface ResolverTpl {
  institucion_nombre: string;
  nit: string;
  descripcion_legal: string;
  medios_pago: string;
  nota_retencion: string;
  nota_legal: string;
}

function academicProgramName(d: ResolverData): string {
  return d.codigo_snies ?? d.programa;
}

export function resolveField(el: FieldEl, d: ResolverData, tpl: ResolverTpl): string {
  const matricula = Number(d.matricula) || 0;
  const pct = Number(d.descuento_pct) || 0;
  const bono = Number(d.descuento_bono) || 0;
  const descuento = Math.round((matricula * pct) / 100);
  const total = Math.max(matricula - descuento - bono, 0);
  const recargo = Number(d.recargo_total) || Math.round(total * 1.1);

  let raw: string | number | null = "";
  switch (el.key) {
    case "nombre": raw = d.nombre; break;
    case "identificacion": raw = d.identificacion; break;
    case "codigo_estudiante":
      raw = d.codigo_estudiante && d.codigo_estudiante.trim()
        ? d.codigo_estudiante
        : (d.identificacion ? d.identificacion.slice(-4) : "—");
      break;
    case "programa": raw = academicProgramName(d); break;
    case "codigo_snies": raw = d.codigo_snies ?? "—"; break;
    case "programa_full": raw = academicProgramName(d); break;
    case "programa_cohorte": raw = `${d.programa}${d.cohorte ? " " + d.cohorte : ""}`; break;
    case "periodo": raw = d.periodo; break;
    case "cohorte": raw = d.cohorte ?? "—"; break;
    case "plan_estudio": raw = (d.plan_estudio ?? "—").replace(/\bDiplomado\b\s*/gi, "").trim() || "—"; break;
    case "fecha_inicio": raw = d.fecha_inicio ?? d.convocatoria ?? "—"; break;
    case "fecha_fin": raw = d.fecha_fin ?? "—"; break;
    case "horas_programa": {
      const tipo = (d.tipo_programa ?? "").toLowerCase();
      if (tipo.includes("especial")) { raw = "3 cuatrim."; break; }
      // Como el Excel: solo el número de horas. Si no hay, usa duración.
      raw = d.horas_programa != null ? String(d.horas_programa) : (d.duracion ?? "—");
      break;
    }
    case "duracion": {
      const tipo = (d.tipo_programa ?? "").toLowerCase();
      if (tipo.includes("especial")) { raw = "3 cuatrimestres"; break; }
      raw = d.duracion ?? (d.horas_programa ? `${d.horas_programa} semanas` : "—");
      break;
    }
    case "convocatoria": raw = d.convocatoria ?? "—"; break;
    case "concepto": raw = d.concepto ?? "Matrícula"; break;
    case "observaciones": raw = (d as { observaciones?: string | null }).observaciones ?? ""; break;
    case "matricula": return fmtMoney(matricula);
    case "descuento": return fmtMoney(descuento);
    case "descuento_pct": return `${pct}%`;
    case "descuento_bono": return fmtMoney(bono);
    case "valor_total": return fmtMoney(total);
    case "recargo_total": return fmtMoney(recargo);
    case "fecha_limite_pago": raw = d.fecha_limite_pago ? formatDate(d.fecha_limite_pago) : "—"; break;
    case "fecha_pago_extraordinario": raw = d.fecha_pago_extraordinario ? formatDate(d.fecha_pago_extraordinario) : "—"; break;
    case "recibo_numero": raw = d.recibo_numero ?? "—"; break;
    case "recibo_fecha": raw = formatDate(d.recibo_fecha); break;
    case "tpl.institucion_nombre": raw = tpl.institucion_nombre; break;
    case "tpl.nit": raw = tpl.nit; break;
    case "tpl.descripcion_legal": raw = tpl.descripcion_legal; break;
    case "tpl.medios_pago": raw = tpl.medios_pago; break;
    case "tpl.nota_retencion": raw = tpl.nota_retencion; break;
    case "tpl.nota_legal": raw = tpl.nota_legal; break;
  }
  const txt = fixMojibake(String(raw ?? ""));
  if (el.format === "currency") return fmtMoney(Number(txt));
  return `${fixMojibake(el.prefix ?? "")}${txt}${fixMojibake(el.suffix ?? "")}`;
}

// ============================================================
// PLANTILLA POR DEFECTO (recrea el recibo actual)
// ============================================================

let _id = 0;
const nid = () => `e${++_id}`;

export const DEFAULT_LAYOUT: InvoiceLayout = (() => {
  _id = 0;
  const W = 555;
  const H = 385;
  const els: LayoutEl[] = [
    // Marco exterior
    { id: nid(), type: "rect", x: 0, y: 0, w: W, h: H, stroke: "#aaa", lineWidth: 0.6 },

    // Wordmark institucional "UdeCataluña" (dibujado por código, sin imagen)
    { id: nid(), type: "emblem", x: 8, y: 10, w: 130, h: 18 },
    // NIT block
    { id: nid(), type: "field", key: "tpl.nit", x: 8, y: 55, fontSize: 7 },
    { id: nid(), type: "text", text: "Vigilada por el Ministerio de Educación Nacional", x: 8, y: 64, fontSize: 7 },
    { id: nid(), type: "text", text: "Resolución Número 21329", x: 8, y: 73, fontSize: 7 },
    { id: nid(), type: "text", text: "Código de Institución SNIES 9923", x: 8, y: 82, fontSize: 7 },

    // Descripción legal
    { id: nid(), type: "field", key: "tpl.descripcion_legal", x: 220, y: 14, w: 320, fontSize: 7 },

    // Caja recibo
    { id: nid(), type: "rect", x: 359, y: 56, w: 180, h: 14, fill: "#e8e8e8", stroke: "#aaa" },
    { id: nid(), type: "text", text: "RECIBO DE PAGO O REFERENCIA", x: 449, y: 65, fontSize: 8, bold: true, align: "center" },
    { id: nid(), type: "rect", x: 359, y: 70, w: 180, h: 14, stroke: "#aaa" },
    { id: nid(), type: "field", key: "recibo_numero", x: 449, y: 80, fontSize: 11, align: "center" },
    { id: nid(), type: "rect", x: 359, y: 84, w: 90, h: 14, stroke: "#aaa" },
    { id: nid(), type: "rect", x: 449, y: 84, w: 90, h: 14, stroke: "#aaa" },
    { id: nid(), type: "text", text: "Fecha", x: 363, y: 93, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "recibo_fecha", x: 535, y: 93, fontSize: 8, align: "right" },

    // Separador
    { id: nid(), type: "line", x: 0, y: 108, x2: W, y2: 108, lineWidth: 0.5 },

    // ----- Datos (3 columnas, fiel al Excel) -----
    // Columna izquierda (x: 4)
    { id: nid(), type: "text", text: "Nombre:", x: 4, y: 120, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "nombre", x: 42, y: 120, w: 246, fontSize: 8 },

    { id: nid(), type: "text", text: "N° Identificación:", x: 4, y: 132, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "identificacion", x: 78, y: 132, w: 160, fontSize: 8 },

    { id: nid(), type: "text", text: "Período Est:", x: 4, y: 144, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "periodo", x: 54, y: 144, w: 90, fontSize: 8 },

    { id: nid(), type: "text", text: "Fecha de inicio:", x: 4, y: 156, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "fecha_inicio", x: 68, y: 156, w: 76, fontSize: 8 },

    // Columna central (x: 150)
    { id: nid(), type: "text", text: "Cohorte:", x: 150, y: 144, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "cohorte", x: 186, y: 144, w: 100, fontSize: 8 },
    { id: nid(), type: "text", text: "Horas del Programa :", x: 150, y: 156, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "horas_programa", x: 246, y: 156, w: 44, fontSize: 8 },

    // Columna derecha (x: 292)
    { id: nid(), type: "text", text: "Programa Académico de Educación Superior", x: 292, y: 120, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "programa_full", x: 292, y: 132, w: 255, fontSize: 8 },
    { id: nid(), type: "text", text: "Plan de estudio:", x: 292, y: 144, fontSize: 8, bold: true },
    { id: nid(), type: "field", key: "plan_estudio", x: 292, y: 155, w: 255, fontSize: 8 },

    // ----- Tabla -----
    { id: nid(), type: "line", x: 0, y: 182, x2: W, y2: 182, lineWidth: 0.5 },
    { id: nid(), type: "rect", x: 0, y: 182, w: W, h: 14, fill: "#e8e8e8", stroke: "#aaa" },
    { id: nid(), type: "text", text: "CÓDIGO ESTUDIANTE", x: 4, y: 191, fontSize: 7.5, bold: true },
    { id: nid(), type: "text", text: "NATUR.", x: 119, y: 191, fontSize: 7.5, bold: true, align: "center" },
    { id: nid(), type: "text", text: "CRED", x: 348, y: 191, fontSize: 7.5, bold: true, align: "center" },
    { id: nid(), type: "text", text: "VALOR", x: 539, y: 191, fontSize: 7.5, bold: true, align: "right" },

    { id: nid(), type: "field", key: "codigo_estudiante", x: 4, y: 205, fontSize: 8.5 },
    { id: nid(), type: "text", text: "+", x: 119, y: 205, fontSize: 8.5, align: "center" },
    { id: nid(), type: "field", key: "concepto", x: 142, y: 205, fontSize: 8.5 },
    { id: nid(), type: "field", key: "matricula", x: 539, y: 205, fontSize: 8.5, align: "right" },

    // Cuerpo de la tabla (filas vacías)
    { id: nid(), type: "rect", x: 0, y: 182, w: W, h: 168, stroke: "#aaa" },
    { id: nid(), type: "line", x: 100, y: 182, x2: 100, y2: 350, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 139, y: 182, x2: 139, y2: 350, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 372, y: 182, x2: 372, y2: 350, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 460, y: 182, x2: 460, y2: 350, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 196, x2: W, y2: 196, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 210, x2: W, y2: 210, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 266, x2: W, y2: 266, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 280, x2: W, y2: 280, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 294, x2: W, y2: 294, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 308, x2: W, y2: 308, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 322, x2: W, y2: 322, lineWidth: 0.5 },
    { id: nid(), type: "line", x: 0, y: 336, x2: W, y2: 336, lineWidth: 0.5 },

    // Totales (en col CRED)
    { id: nid(), type: "text", text: "Valor a Pagar", x: 456, y: 275, fontSize: 8.5, align: "right" },
    { id: nid(), type: "field", key: "matricula", x: 539, y: 275, fontSize: 8.5, align: "right" },
    { id: nid(), type: "text", text: "Descuento", x: 456, y: 289, fontSize: 8.5, align: "right" },
    { id: nid(), type: "field", key: "descuento", x: 539, y: 289, fontSize: 8.5, align: "right" },
    { id: nid(), type: "text", text: "Valor Total a Pagar", x: 456, y: 303, fontSize: 8.5, bold: true, align: "right" },
    { id: nid(), type: "field", key: "valor_total", x: 539, y: 303, fontSize: 8.5, bold: true, align: "right" },

    { id: nid(), type: "text", text: "Fecha límite de pago", x: 368, y: 317, fontSize: 8.5, bold: true, align: "right" },
    { id: nid(), type: "field", key: "fecha_limite_pago", x: 416, y: 317, fontSize: 8.5, align: "center" },
    { id: nid(), type: "field", key: "valor_total", x: 539, y: 317, fontSize: 8.5, align: "right" },

    { id: nid(), type: "text", text: "Pago extraordinario con recargo", x: 368, y: 331, fontSize: 8.5, bold: true, align: "right" },
    { id: nid(), type: "field", key: "fecha_pago_extraordinario", x: 416, y: 331, fontSize: 8.5, align: "center" },
    { id: nid(), type: "field", key: "recargo_total", x: 539, y: 331, fontSize: 8.5, align: "right" },

    // Pie
    { id: nid(), type: "field", key: "tpl.medios_pago", x: 4, y: 360, fontSize: 7, bold: true, w: 545 },
    { id: nid(), type: "field", key: "tpl.nota_retencion", x: 4, y: 369, fontSize: 7, w: 545 },
    { id: nid(), type: "field", key: "tpl.nota_legal", x: 4, y: 378, fontSize: 7, w: 545 },
  ];
  return { width: W, height: H, elements: els };
})();

export function sampleData(): ResolverData {
  return {
    recibo_numero: "6027126",
    recibo_fecha: "2026-05-26",
    nombre: "Diana Carolina Arango Gonzalez",
    identificacion: "32258517",
    codigo_estudiante: "8517",
    programa: "Administración de Empresas",
    codigo_snies: "108572",
    periodo: "1er Semestre 2026",
    cohorte: "DGCOIA07",
    plan_estudio: "Gerencia Comercial con IA",
    fecha_inicio: "Junio 2026",
    fecha_fin: "Diciembre 2026",
    horas_programa: 160,
    concepto: "Matrícula",
    matricula: 4312500,
    descuento_pct: 50,
    recargo_total: 2371875,
    fecha_limite_pago: "2026-05-30",
    fecha_pago_extraordinario: "2026-06-02",
  };
}
