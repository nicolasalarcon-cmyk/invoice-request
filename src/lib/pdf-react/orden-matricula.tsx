import React from "react";
import { Document, Page, View, Text, Font, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceData } from "../generate-invoice-pdf";
import type { InvoiceTemplate } from "../invoice-template";
import { formatDate } from "../format";
import regularUrl from "@/assets/fonts/Arial-Regular.ttf";
import boldUrl from "@/assets/fonts/Arial-Bold.ttf";

// ─── Font registration (runs once at module load) ─────────────────────────────
Font.register({
  family: "Arial",
  fonts: [
    { src: regularUrl, fontWeight: "normal" },
    { src: boldUrl, fontWeight: "bold" },
  ],
});

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY = "#10167A";
const GRAY_BG = "#E8E8E8";
const BORDER = "#aaaaaa";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(n: number) {
  return `$ ${Number(n || 0).toLocaleString("es-CO")}`;
}

function academicName(d: InvoiceData): string {
  return d.codigo_snies ?? d.programa;
}

export interface OrdenData {
  // Institution (from template)
  nit: string;
  descripcion_legal: string;
  medios_pago: string;
  nota_retencion: string;
  nota_legal: string;
  // Recibo
  recibo_numero: string;
  recibo_fecha: string;
  // Student
  nombre: string;
  identificacion: string;
  codigo_estudiante: string;
  programa_full: string;
  plan_estudio: string;
  periodo: string;
  cohorte: string;
  fecha_inicio: string;
  horas_programa: string;
  concepto: string;
  // Money
  matricula: number;
  descuento: number;
  valor_total: number;
  recargo_total: number;
  fecha_limite: string;
  fecha_extraordinario: string;
}

export function resolveOrdenData(data: InvoiceData, tpl: InvoiceTemplate): OrdenData {
  const matricula = Number(data.matricula) || 0;
  const pct = Number(data.descuento_pct) || 0;
  const bono = Number(data.descuento_bono) || 0;
  const descuento = Math.round((matricula * pct) / 100);
  const valor_total = Number(data.valor_total) || Math.max(matricula - descuento - bono, 0);
  const recargo_total = Number(data.recargo_total) || Math.round(valor_total * 1.1);

  const tipo = (data.tipo_programa ?? "").toLowerCase();
  let horas: string;
  if (tipo.includes("especial")) {
    horas = "3 cuatrim.";
  } else {
    horas = data.horas_programa != null ? String(data.horas_programa) : (data.duracion ?? "—");
  }

  const codigo_est =
    data.codigo_estudiante && data.codigo_estudiante.trim()
      ? data.codigo_estudiante
      : data.identificacion
        ? data.identificacion.slice(-4)
        : "—";


  return {
    nit: tpl.nit,
    descripcion_legal: tpl.descripcion_legal,
    medios_pago: tpl.medios_pago,
    nota_retencion: tpl.nota_retencion,
    nota_legal: tpl.nota_legal,
    recibo_numero: String(data.recibo_numero ?? "—"),
    recibo_fecha: formatDate(data.recibo_fecha),
    nombre: data.nombre,
    identificacion: data.identificacion,
    codigo_estudiante: codigo_est,
    programa_full: academicName(data),
    plan_estudio: (data.plan_estudio ?? "—").replace(/\bDiplomado\b\s*/gi, "").trim() || "—",
    periodo: data.periodo,
    cohorte: data.cohorte ?? "—",
    fecha_inicio: data.convocatoria ?? data.fecha_inicio ?? "—",
    horas_programa: horas,
    concepto: data.concepto ?? "Matrícula",
    matricula,
    descuento,
    valor_total,
    recargo_total,
    fecha_limite: data.fecha_limite_pago ? formatDate(data.fecha_limite_pago) : "—",
    fecha_extraordinario: data.fecha_pago_extraordinario
      ? formatDate(data.fecha_pago_extraordinario)
      : "—",
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: "Arial", fontSize: 8 },

  // Two-copy wrapper
  wrapper: { marginTop: 12, marginHorizontal: 12 },
  separator: { height: 8 },
  sepLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: BORDER,
    borderBottomStyle: "dashed",
    marginTop: 3,
  },

  // Single copy
  copy: {
    height: 380,
    flexDirection: "row",
    borderWidth: 0.6,
    borderColor: BORDER,
    borderStyle: "solid",
  },
  main: { flex: 1, flexDirection: "column" },
  strip: {
    width: 16,
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  stripLetter: { fontSize: 8, fontWeight: "bold" },

  // Header row
  header: {
    height: 107,
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  headerLeft: { width: 210, padding: 5, flexDirection: "column" },
  headerRight: { flex: 1, flexDirection: "column" },

  // Wordmark
  wordmark: { marginBottom: 3 },
  wU:    { fontSize: 36, fontWeight: "bold",   color: NAVY },
  wDe:   { fontSize: 18, fontWeight: "normal", color: NAVY },
  wMain: { fontSize: 29, fontWeight: "bold",   color: NAVY },
  wordmarkBar: { height: 1.5, backgroundColor: NAVY, marginTop: 2, marginBottom: 4, marginRight: 8 },

  nitLine: { fontSize: 6.5, marginBottom: 1 },

  // Description legal (top of right side)
  descArea: { flex: 1, padding: 4, justifyContent: "center" },
  descText: { fontSize: 7 },

  // Recibo box (bottom of right side)
  reciboBox: {
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },
  reciboHdr: {
    height: 14,
    backgroundColor: GRAY_BG,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  reciboHdrText: { fontSize: 7.5, fontWeight: "bold" },
  reciboNum: {
    height: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  reciboNumText: { fontSize: 11 },
  reciboDate: { height: 14, flexDirection: "row" },
  reciboDateL: {
    flex: 1,
    paddingLeft: 4,
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  reciboDateLbl: { fontSize: 7.5, fontWeight: "bold" },
  reciboDateR: { flex: 1, paddingRight: 4, alignItems: "flex-end", justifyContent: "center" },
  reciboDateVal: { fontSize: 7.5 },

  // Student data
  studentSection: {
    height: 74,
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  studentLeft: { flex: 1, paddingHorizontal: 3, paddingTop: 5, flexDirection: "column" },
  studentRight: {
    width: 264,
    paddingHorizontal: 3,
    paddingTop: 5,
    flexDirection: "column",
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },

  // Table
  tableSection: { flex: 1, flexDirection: "column" },
  tblHdr: {
    height: 14,
    flexDirection: "row",
    backgroundColor: GRAY_BG,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    alignItems: "center",
  },
  tblRow: {
    height: 14,
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    alignItems: "center",
  },
  tblEmpty: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },

  // Table columns
  colCod: { width: 100, paddingLeft: 3 },
  colNat: {
    width: 39,
    alignItems: "center",
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },
  colDesc: {
    flex: 1,
    paddingLeft: 3,
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },
  colCred: {
    width: 88,
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },
  colVal: {
    width: 95,
    paddingRight: 3,
    alignItems: "flex-end",
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },

  // Totals rows (occupy the colCred+colVal area)
  totalsArea: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  totRow: {
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  totLabel: {
    flex: 1,
    paddingRight: 3,
    alignItems: "flex-end",
  },
  totValue: {
    width: 95,
    paddingRight: 3,
    alignItems: "flex-end",
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },

  // Date rows within totals
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    minHeight: 14,
    paddingVertical: 2,
  },
  dateLabelCol: { flex: 1, paddingRight: 3, alignItems: "flex-end" },
  dateValueCol: {
    width: 95,
    paddingRight: 3,
    alignItems: "flex-end",
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
  },

  // Footer
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    padding: 3,
  },
  footerLine: { fontSize: 6.5, lineHeight: 1.3 },
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function LabelValue({
  label,
  value,
  labelWidth = 55,
  bold = false,
}: {
  label: string;
  value: string;
  labelWidth?: number;
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3, alignItems: "flex-start" }}>
      <Text style={{ fontWeight: "bold", fontSize: 7.5, width: labelWidth }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 7.5, fontWeight: bold ? "bold" : "normal" }}>{value}</Text>
    </View>
  );
}

function TotRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={s.totRow}>
      <View style={s.totLabel}>
        <Text style={{ fontSize: 7.5, fontWeight: bold ? "bold" : "normal" }}>{label}</Text>
      </View>
      <View style={s.totValue}>
        <Text style={{ fontSize: 7.5, fontWeight: bold ? "bold" : "normal" }}>{value}</Text>
      </View>
    </View>
  );
}

function DateRow({
  label,
  date,
  value,
}: {
  label: string;
  date: string;
  value: string;
}) {
  return (
    <View style={s.dateRow}>
      <View style={s.dateLabelCol}>
        <Text style={{ fontSize: 6.5, fontWeight: "bold", textAlign: "right" }}>{label}</Text>
        <Text style={{ fontSize: 6.5, textAlign: "right" }}>{date}</Text>
      </View>
      <View style={s.dateValueCol}>
        <Text style={{ fontSize: 7.5 }}>{value}</Text>
      </View>
    </View>
  );
}

function InvoiceCopy({ d, label }: { d: OrdenData; label: "ALUMNO" | "UNIVERSIDAD" }) {
  return (
    <View style={s.copy}>
      {/* ── WATERMARK ── */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 16, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 155, fontWeight: "bold", color: NAVY, opacity: 0.07 }}>UC</Text>
      </View>
      <View style={s.main}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          {/* Left: institution branding */}
          <View style={s.headerLeft}>
            {/* Wordmark — nested Text renders inline like <span> */}
            <Text style={s.wordmark}>
              <Text style={s.wU}>U</Text>
              <Text style={s.wDe}>de</Text>
              <Text style={s.wMain}>Cataluña</Text>
            </Text>
            <View style={s.wordmarkBar} />
            <View style={{ flex: 1 }} />
            <Text style={s.nitLine}>{d.nit}</Text>
            <Text style={s.nitLine}>Vigilada por el Ministerio de Educación Nacional</Text>
            <Text style={s.nitLine}>Resolución Número 21329</Text>
            <Text style={s.nitLine}>Código de Institución SNIES 9923</Text>
            <Text style={s.nitLine}>Teléfono: 305 9140563</Text>
            <Text style={s.nitLine}>Correo: info@altatec.org</Text>
          </View>

          {/* Right: description + recibo box */}
          <View style={s.headerRight}>
            <View style={s.descArea}>
              <Text style={s.descText}>{d.descripcion_legal}</Text>
            </View>
            <View style={s.reciboBox}>
              <View style={s.reciboHdr}>
                <Text style={s.reciboHdrText}>RECIBO DE PAGO O REFERENCIA</Text>
              </View>
              <View style={s.reciboNum}>
                <Text style={s.reciboNumText}>{d.recibo_numero}</Text>
              </View>
              <View style={s.reciboDate}>
                <View style={s.reciboDateL}>
                  <Text style={s.reciboDateLbl}>Fecha</Text>
                </View>
                <View style={s.reciboDateR}>
                  <Text style={s.reciboDateVal}>{d.recibo_fecha}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── STUDENT DATA ── */}
        <View style={s.studentSection}>
          {/* Left columns */}
          <View style={s.studentLeft}>
            <LabelValue label="Nombre:" value={d.nombre} labelWidth={50} />
            <LabelValue label="N° Identificación:" value={d.identificacion} labelWidth={84} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <LabelValue label="Período Est:" value={d.periodo} labelWidth={54} />
              </View>
              <View style={{ flex: 1 }}>
                <LabelValue label="Cohorte:" value={d.cohorte} labelWidth={40} />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <LabelValue label="Fecha de inicio:" value={d.fecha_inicio} labelWidth={66} />
              </View>
              <View style={{ flex: 1 }}>
                <LabelValue label="Horas del Programa:" value={d.horas_programa} labelWidth={82} />
              </View>
            </View>
          </View>
          {/* Right column: academic program */}
          <View style={s.studentRight}>
            <Text style={{ fontSize: 7.5, fontWeight: "bold", marginBottom: 3 }}>
              Programa Académico de Educación Superior
            </Text>
            <Text style={{ fontSize: 7.5, marginBottom: 3 }}>{d.programa_full}</Text>
            <Text style={{ fontSize: 7.5, fontWeight: "bold", marginBottom: 2 }}>Plan de estudio:</Text>
            <Text style={{ fontSize: 7.5 }}>{d.plan_estudio}</Text>
          </View>
        </View>

        {/* ── TABLE ── */}
        <View style={s.tableSection}>
          {/* Table header */}
          <View style={s.tblHdr}>
            <View style={s.colCod}>
              <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>CÓDIGO ESTUDIANTE</Text>
            </View>
            <View style={s.colNat}>
              <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>NATUR.</Text>
            </View>
            <View style={s.colDesc}>
              <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>CRED</Text>
            </View>
            <View style={[s.colCred, { alignItems: "center" }]}>
              <Text style={{ fontSize: 7.5, fontWeight: "bold" }}> </Text>
            </View>
            <View style={s.colVal}>
              <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>VALOR</Text>
            </View>
          </View>

          {/* Data row */}
          <View style={s.tblRow}>
            <View style={s.colCod}>
              <Text style={{ fontSize: 8 }}>{d.codigo_estudiante}</Text>
            </View>
            <View style={s.colNat}>
              <Text style={{ fontSize: 8 }}>+</Text>
            </View>
            <View style={s.colDesc}>
              <Text style={{ fontSize: 8 }}>{d.concepto}</Text>
            </View>
            <View style={s.colCred} />
            <View style={s.colVal}>
              <Text style={{ fontSize: 8 }}>{fmtCOP(d.matricula)}</Text>
            </View>
          </View>

          {/* Middle area: empty rows on left, totals on right */}
          <View style={{ flex: 1, flexDirection: "row" }}>
            {/* Left empty columns */}
            <View style={{ width: 372 }} />
            {/* Right totals area */}
            <View
              style={{
                flex: 1,
                flexDirection: "column",
                justifyContent: "flex-end",
                borderLeftWidth: 0.5,
                borderLeftColor: BORDER,
              }}
            >
              <TotRow label="Valor a Pagar" value={fmtCOP(d.matricula)} />
              <TotRow label="Descuento" value={fmtCOP(d.descuento)} />
              <TotRow label="Valor Total a Pagar" value={fmtCOP(d.valor_total)} bold />
              <DateRow
                label="Fecha límite de pago"
                date={d.fecha_limite}
                value={fmtCOP(d.valor_total)}
              />
              <DateRow
                label="Pago extraordinario con recargo"
                date={d.fecha_extraordinario}
                value={fmtCOP(d.recargo_total)}
              />
            </View>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          {d.medios_pago ? (
            <Text style={[s.footerLine, { fontWeight: "bold" }]}>{d.medios_pago}</Text>
          ) : null}
          {d.nota_retencion ? (
            <Text style={s.footerLine}>{d.nota_retencion}</Text>
          ) : null}
          {d.nota_legal ? (
            <Text style={s.footerLine}>{d.nota_legal}</Text>
          ) : null}
        </View>
      </View>

      {/* ── STRIP (vertical label) ── */}
      <View style={s.strip}>
        {label.split("").map((ch, i) => (
          <Text key={i} style={s.stripLetter}>
            {ch}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Main document export ─────────────────────────────────────────────────────
export function OrdenMatriculaDocument({
  data,
  tpl,
}: {
  data: InvoiceData;
  tpl: InvoiceTemplate;
}) {
  const d = resolveOrdenData(data, tpl);
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.wrapper}>
          <InvoiceCopy d={d} label="ALUMNO" />
          <View style={s.separator}>
            <View style={s.sepLine} />
          </View>
          <InvoiceCopy d={d} label="UNIVERSIDAD" />
        </View>
      </Page>
    </Document>
  );
}
