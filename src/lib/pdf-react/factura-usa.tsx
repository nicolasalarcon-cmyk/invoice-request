import React from "react";
import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceData } from "../generate-invoice-pdf";
import type { InvoiceTemplate } from "../invoice-template";
import { formatDate } from "../format";
import regularUrl from "@/assets/fonts/Arial-Regular.ttf?url";
import boldUrl from "@/assets/fonts/Arial-Bold.ttf?url";
import logoUrl from "@/assets/logo-cataluna.png";

// Font registration is de-duped by react-pdf (no-op if already registered)
Font.register({
  family: "Arial",
  fonts: [
    { src: regularUrl, fontWeight: "normal" },
    { src: boldUrl, fontWeight: "bold" },
  ],
});

// ─── Brand colors ─────────────────────────────────────────────────────────────
const NAVY = "#1B365D";
const GOLD = "#C49E46";
const GRAY = "#6E7480";
const LIGHT_BG = "#F6F7FA";
const LINE = "#D2D6DE";

// ─── Issuer data (hardcoded as in the original) ───────────────────────────────
const ISSUER = {
  nombre: "Universidad de Catalunya Corp",
  ein: "EIN 85-3147333",
  direccion: "3390 Mary Street, Suite 116",
  ciudad: "Coconut Grove, FL 33133",
  telefono: "Phone (305) 914-0563",
  email: "tesoreria@udecatalunya.org",
};

const WIRE = [
  "Acct Name: FUNDACION UNIVERSIDAD DE CATALUNYA CORP",
  "Bank: JPMorgan Chase Bank — Sunset Branch",
  "Address: 4200 SW 152 Ave, Miami, FL 33185",
  "Account No: 716936288",
  "ABA: 267084131",
  "Swift: CHASUS33",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function usd(n: number): string {
  return `$${Number(n || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceNumber(data: InvoiceData): string {
  const iso = (data.recibo_fecha ?? "").split("T")[0];
  const parts = iso.split("-");
  const year =
    parts.length === 3
      ? Number(parts[0])
      : new Date().getFullYear();
  return `${year}-${data.recibo_numero ?? "—"}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return formatDate(s);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: "Arial", fontSize: 9, paddingHorizontal: 48, paddingVertical: 48 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  logo: { width: 54, height: 54, marginRight: 12 },
  issuerBlock: { flex: 1, flexDirection: "column" },
  issuerName: { fontSize: 11, fontWeight: "bold", color: NAVY, marginBottom: 3 },
  issuerLine: { fontSize: 8, color: GRAY, marginBottom: 1 },
  issuerEmail: { fontSize: 8, color: "#1E64C8" },

  // Invoice number gold box (top-right)
  invBox: {
    backgroundColor: GOLD,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  invBoxLabel: { fontSize: 8, color: NAVY, marginRight: 6, alignSelf: "center" },
  invBoxNum: { fontSize: 10, fontWeight: "bold", color: "#fff" },
  invNumberRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  // Gold divider
  divider: { height: 3, backgroundColor: GOLD, marginBottom: 16 },

  // Bill To + Meta row
  billMetaRow: { flexDirection: "row", marginBottom: 16 },
  billBlock: { flex: 1, marginRight: 16 },
  billTitle: { fontSize: 9, fontWeight: "bold", color: NAVY, marginBottom: 8 },
  billLabelCol: { width: 50 },
  billLabel: { fontSize: 8, fontWeight: "bold", color: GRAY },
  billValue: { flex: 1, fontSize: 9, color: "#28292C" },
  billRow: { flexDirection: "row", marginBottom: 5 },

  // Meta box
  metaBox: {
    width: 215,
    backgroundColor: LIGHT_BG,
    padding: 10,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metaLabel: { fontSize: 8, color: GRAY },
  metaValue: { fontSize: 8.5, fontWeight: "bold", color: NAVY },

  // Items table
  tableHdr: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 7,
    paddingHorizontal: 6,
    marginBottom: 0,
  },
  tableHdrText: { fontSize: 8.5, fontWeight: "bold", color: "#fff" },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 6 },
  tableSep: { borderBottomWidth: 0.6, borderBottomColor: LINE },

  // Table column widths
  colQty: { width: 36 },
  colDesc: { flex: 1 },
  colUnit: { width: 90, alignItems: "flex-end" },
  colTotal: { width: 90, alignItems: "flex-end" },

  descMain: { fontSize: 9, color: "#28292C", marginBottom: 2 },
  descSub: { fontSize: 8, color: GRAY },

  // Totals
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  totLabel: { fontSize: 9, color: GRAY },
  totValue: { fontSize: 9, color: "#28292C" },
  totDivider: { borderBottomWidth: 1, borderBottomColor: GOLD, marginVertical: 8 },
  totFinalRow: { flexDirection: "row", justifyContent: "space-between" },
  totFinalLabel: { fontSize: 12, fontWeight: "bold", color: NAVY },
  totFinalValue: { fontSize: 12, fontWeight: "bold", color: NAVY },

  // Wire transfer box
  wireBox: {
    borderWidth: 0.5,
    borderColor: "#B4B4B4",
    padding: 10,
    marginTop: 12,
  },
  wireTitle: { fontSize: 9, fontWeight: "bold", color: NAVY, marginBottom: 8 },
  wireLine: { fontSize: 8.5, color: "#3C4048", marginBottom: 4 },
  wireNote: { fontSize: 7.5, color: GRAY, marginTop: 4 },
});

// ─── Main document ────────────────────────────────────────────────────────────
export function FacturaUSADocument({
  data,
  _tpl,
}: {
  data: InvoiceData;
  _tpl: InvoiceTemplate;
}) {
  const subtotal = Number(data.matricula) || 0;
  const descuento = Number(data.descuento_bono) || Number(data.descuento) || 0;
  const total = Number(data.valor_total) || Math.max(subtotal - descuento, 0);

  const mainDesc =
    [data.nemonico, data.programa].filter(Boolean).join(" ").trim() ||
    data.programa ||
    data.plan_estudio ||
    "Programa";
  const participante = [data.nombre, data.identificacion].filter(Boolean).join("  ");

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ── HEADER ── */}
        <View style={s.headerRow}>
          <Image style={s.logo} src={logoUrl} />
          <View style={s.issuerBlock}>
            <Text style={s.issuerName}>{ISSUER.nombre}</Text>
            <Text style={s.issuerLine}>{ISSUER.ein}</Text>
            <Text style={s.issuerLine}>{ISSUER.direccion}</Text>
            <Text style={s.issuerLine}>{ISSUER.ciudad}</Text>
            <Text style={s.issuerLine}>{ISSUER.telefono}</Text>
            <Text style={s.issuerEmail}>{ISSUER.email}</Text>
          </View>
          {/* Invoice number box */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.issuerLine, { marginBottom: 3, textAlign: "right" }]}>
              INVOICE Number:
            </Text>
            <View style={s.invBox}>
              <Text style={s.invBoxNum}>{invoiceNumber(data)}</Text>
            </View>
          </View>
        </View>

        {/* Gold divider */}
        <View style={s.divider} />

        {/* ── BILL TO + META ── */}
        <View style={s.billMetaRow}>
          {/* Bill To */}
          <View style={s.billBlock}>
            <Text style={s.billTitle}>BILL TO</Text>
            {data.empresa || data.nombre ? (
              <BillRow label="Name" value={data.empresa ?? data.nombre ?? ""} />
            ) : null}
            {data.cliente_nit ? <BillRow label="RUC/NIT" value={data.cliente_nit} /> : null}
            {data.direccion ? <BillRow label="Address" value={data.direccion} /> : null}
            {data.ciudad || data.pais ? (
              <BillRow
                label="City"
                value={[data.ciudad, data.pais].filter(Boolean).join(", ")}
              />
            ) : null}
            {data.telefono ? <BillRow label="Tel." value={data.telefono} /> : null}
            {data.email ? <BillRow label="eMail" value={data.email} /> : null}
          </View>

          {/* Meta box */}
          <View style={s.metaBox}>
            <MetaRow label="Date" value={fmtDate(data.recibo_fecha)} />
            <MetaRow label="Expiration Date" value={fmtDate(data.fecha_limite_pago)} />
            <MetaRow label="Reference" value="U$D" />
            <MetaRow label="Payment terms" value="Due Upon Receipt" />
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.tableHdr}>
          <View style={s.colQty}>
            <Text style={s.tableHdrText}>QTY</Text>
          </View>
          <View style={s.colDesc}>
            <Text style={s.tableHdrText}>DESCRIPTION</Text>
          </View>
          <View style={s.colUnit}>
            <Text style={s.tableHdrText}>UNIT PRICE</Text>
          </View>
          <View style={s.colTotal}>
            <Text style={s.tableHdrText}>TOTAL</Text>
          </View>
        </View>

        <View style={s.tableRow}>
          <View style={s.colQty}>
            <Text style={{ fontSize: 9, color: "#28292C" }}>1</Text>
          </View>
          <View style={s.colDesc}>
            <Text style={s.descMain}>{mainDesc}</Text>
            {participante ? (
              <Text style={s.descSub}>Participante: {participante}</Text>
            ) : null}
          </View>
          <View style={s.colUnit}>
            <Text style={{ fontSize: 9, color: "#28292C" }}>{usd(subtotal)}</Text>
          </View>
          <View style={s.colTotal}>
            <Text style={{ fontSize: 9, color: "#28292C" }}>{usd(subtotal)}</Text>
          </View>
        </View>
        <View style={s.tableSep} />

        {/* ── TOTALS ── */}
        <View style={{ alignItems: "flex-end", marginTop: 16 }}>
          <View style={{ width: 215 }}>
            <View style={s.totalsRow}>
              <Text style={s.totLabel}>Subtotal</Text>
              <Text style={s.totValue}>{usd(subtotal)}</Text>
            </View>
            {descuento > 0 ? (
              <View style={s.totalsRow}>
                <Text style={s.totLabel}>Discount</Text>
                <Text style={s.totValue}>{usd(descuento)}</Text>
              </View>
            ) : null}
            <View style={s.totalsRow}>
              <Text style={s.totLabel}>Shipping &amp; Handling</Text>
              <Text style={s.totValue}> </Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totLabel}>Taxes (DOES NOT APPLY)</Text>
              <Text style={s.totValue}> </Text>
            </View>
            <View style={s.totDivider} />
            <View style={s.totFinalRow}>
              <Text style={s.totFinalLabel}>TOTAL</Text>
              <Text style={s.totFinalValue}>{usd(total)} U$D</Text>
            </View>
          </View>
        </View>

        {/* ── WIRE TRANSFER ── */}
        <View style={s.wireBox}>
          <Text style={s.wireTitle}>Wire Transfer información:</Text>
          {WIRE.map((line, i) => (
            <Text key={i} style={s.wireLine}>
              {line}
            </Text>
          ))}
          <Text style={s.wireNote}>(Must include reference for identification purpose)</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function BillRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.billRow}>
      <View style={s.billLabelCol}>
        <Text style={s.billLabel}>{label}</Text>
      </View>
      <Text style={s.billValue}>{value}</Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}
