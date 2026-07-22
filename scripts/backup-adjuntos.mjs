// Backup de adjuntos con sus nombres reales.
//
// Los archivos en Supabase Storage se guardan con nombre aleatorio; el
// nombre real se guarda aparte, en la base de datos, junto a cada
// solicitud. Este script descarga cada archivo y lo guarda localmente
// usando ese nombre real, organizado por fecha / tipo de documento /
// solicitud — sin tocar nada en producción.
//
// Uso:
//   node --env-file=.env scripts/backup-adjuntos.mjs
//
// Variables opcionales:
//   BACKUP_DIR=./mi-carpeta   node --env-file=.env scripts/backup-adjuntos.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT_DIR = process.env.BACKUP_DIR || "./backups";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. Corre el script con: node --env-file=.env scripts/backup-adjuntos.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function sanitize(name) {
  return (name || "archivo").replace(/[\\/?%*:|"<>]/g, "-").trim() || "archivo";
}

async function uniqueDestName(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      candidate = `${base} (${i})${ext}`;
      i++;
    } catch {
      return candidate;
    }
  }
}

async function downloadTo(storagePath, destFile) {
  const { data, error } = await supabase.storage.from("invoice-files").download(storagePath);
  if (error || !data) {
    console.error(`  ✗ ${storagePath} → ${error?.message ?? "no encontrado"}`);
    return false;
  }
  const buf = Buffer.from(await data.arrayBuffer());
  await fs.writeFile(destFile, buf);
  return true;
}

async function main() {
  console.log(`Consultando solicitudes…`);
  const { data: rows, error } = await supabase
    .from("invoice_requests")
    .select("id, nombre, document_type, recibo_numero, created_at, attachments, approved_pdf_path, approved_pdf_name");
  if (error) throw error;

  console.log(`${rows.length} solicitudes encontradas. Descargando adjuntos…\n`);

  let ok = 0;
  let fail = 0;

  for (const r of rows) {
    const files = (r.attachments ?? []).map((a) => ({
      storagePath: a.path,
      name: sanitize(a.name || path.basename(a.path)),
    }));

    if (r.approved_pdf_path) {
      const ext = path.extname(r.approved_pdf_path) || ".pdf";
      const name = r.approved_pdf_name
        ? sanitize(r.approved_pdf_name)
        : sanitize(`Factura-Aprobada-${r.recibo_numero ?? r.id.slice(0, 8)}${ext}`);
      files.push({ storagePath: r.approved_pdf_path, name });
    }

    if (files.length === 0) continue;

    const dateFolder = (r.created_at || "").slice(0, 10) || "sin-fecha";
    const folderName = sanitize(`${r.recibo_numero ?? r.id.slice(0, 8)}_${r.nombre ?? "sin-nombre"}`);
    const dir = path.join(OUT_DIR, dateFolder, r.document_type ?? "otro", folderName);
    await fs.mkdir(dir, { recursive: true });

    for (const f of files) {
      const finalName = await uniqueDestName(dir, f.name);
      const success = await downloadTo(f.storagePath, path.join(dir, finalName));
      if (success) ok++; else fail++;
    }
  }

  console.log(`\nListo. ${ok} archivo(s) respaldado(s), ${fail} fallaron.`);
  console.log(`Carpeta: ${path.resolve(OUT_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
