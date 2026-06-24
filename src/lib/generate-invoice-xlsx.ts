import * as XLSX from "xlsx";
import { formatDate } from "./format";
import type { InvoiceData } from "./generate-invoice-pdf";

function buildReceiptRows(d: InvoiceData, label: "ALUMNO" | "UNIVERSIDAD") {
  const matricula = Number(d.matricula) || 0;
  const pct = Number(d.descuento_pct) || 0;
  const descuento = Math.round((matricula * pct) / 100);
  const total = Math.max(matricula - descuento, 0);
  const recargo = Number(d.recargo_total) || Math.round(total * 1.1);

  return [
    ["UdeCataluña", "", "", "", "", "", `RECIBO ${label}`],
    ["NIT: 901.032.802-6", "", "", "", "", "RECIBO DE PAGO O REFERENCIA", ""],
    ["Vigilada por el Ministerio de Educación Nacional", "", "", "", "", d.recibo_numero ?? "", ""],
    ["Resolución Número 21329", "", "", "", "", "Fecha", formatDate(d.recibo_fecha)],
    ["Código de Institución SNIES 9923", "", "", "", "", "", ""],
    [],
    ["Nombre:", d.nombre, "", "", "Programa Académico de Educación Superior", "", ""],
    ["N° Identificación:", d.identificacion, "", "", d.programa, `Código SNIES ${d.codigo_snies ?? ""}`, ""],
    ["Período Est:", d.periodo, "Cohorte:", `${d.programa ?? ""} ${d.cohorte ?? ""}`.trim(), "Plan de estudio:", d.plan_estudio ?? "", ""],
    ["Fecha de inicio:", d.convocatoria ?? d.fecha_inicio ?? "", "Duración:", d.duracion ?? (d.horas_programa ? `${d.horas_programa} semanas` : ""), "Convocatoria:", d.convocatoria ?? "", ""],
    [],
    ["CÓDIGO ESTUDIANTE", "NATUR.", "CONCEPTO", "", "", "CRED", "VALOR"],
    [d.codigo_estudiante ?? "", "+", "Matrícula", "", "", "", matricula],
    ["", "", "", "", "Valor a Pagar", "", matricula],
    ["", "", "", "", `Descuento (${pct}%)`, "", descuento],
    ["", "", "", "", "Valor Total a Pagar", "", total],
    ["", "", "", "Fecha límite de pago", d.fecha_limite_pago ? formatDate(d.fecha_limite_pago) : "", "", total],
    [
      "",
      "",
      "",
      "Pago extraordinario con 10% de recargo",
      d.fecha_pago_extraordinario ? formatDate(d.fecha_pago_extraordinario) : "",
      "",
      recargo,
    ],
    [],
    ["Medios de Pago: Bancolombia Cuenta Ahorros 16869342576 a nombre de Corporación Universitaria de Cataluña NIT 901.032.802-6"],
    ["Favor NO HACER RETENCIÓN EN LA FUENTE. Somos una Institución de Educación Superior aprobada por el Ministerio Educación Nacional, según resolución 21329 de 2016"],
    ["Régimen tributario especial. Esta factura se asimila en todos sus efectos legales a una letra de cambio (art. 621, 773, 774 código de comercio)."],
  ];
}

export function generateInvoiceXLSX(d: InvoiceData) {
  const wb = XLSX.utils.book_new();

  for (const label of ["ALUMNO", "UNIVERSIDAD"] as const) {
    const rows = buildReceiptRows(d, label);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 8 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
    ];
    // Currency format on VALOR column (col 6 = G)
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = range.s.r; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ c: 6, r: R });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.z = '"$"#,##0';
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, label);
  }

  const filename = `recibo-${d.recibo_numero ?? "sin-numero"}-${d.identificacion}.xlsx`;
  XLSX.writeFile(wb, filename);
}
