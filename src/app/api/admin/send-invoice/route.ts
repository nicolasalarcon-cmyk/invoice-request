import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getAdminUser(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["super_admin", "admin", "financiera"])
    .maybeSingle();
  if (!data) return null;
  return user;
}

async function sendMailjet({ to, cc, subject, html, attachment }: {
  to: string; cc?: string; subject: string; html: string;
  attachment?: { filename: string; contentBase64: string; mimeType?: string };
}) {
  const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
  const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
  const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
  const FROM_NAME = process.env.MAILJET_FROM_NAME || "Plataforma de Solicitudes — UdeCataluña";
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !FROM_EMAIL) {
    throw new Error("Mailjet no está configurado (faltan variables de entorno)");
  }

  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString("base64");

  const message: Record<string, unknown> = {
    From: { Email: FROM_EMAIL, Name: FROM_NAME },
    To: [{ Email: to }],
    ...(cc ? { Cc: [{ Email: cc }] } : {}),
    Subject: subject,
    HTMLPart: html,
  };
  if (attachment) {
    message.Attachments = [{
      ContentType: attachment.mimeType ?? "application/pdf",
      Filename: attachment.filename,
      Base64Content: attachment.contentBase64,
    }];
  }

  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ Messages: [message] }),
  });
  const json = await res.json().catch(() => null) as
    | { Messages?: { Status?: string; Errors?: { ErrorMessage?: string }[] }[] }
    | null;
  const msgResult = json?.Messages?.[0];
  if (!res.ok || msgResult?.Status !== "success") {
    const detail = msgResult?.Errors?.map((e) => e.ErrorMessage).filter(Boolean).join("; ");
    throw new Error(`Mailjet send failed: ${detail || msgResult?.Status || res.status}`);
  }
}

function emailLayout({ title, intro, bodyHtml }: { title: string; intro?: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0a2540 0%,#13386b 100%);padding:28px 32px;">
          <div style="color:#ffffff;font-size:22px;font-weight:600;">Plataforma de Solicitudes</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0a2540;">${title}</h1>
          ${intro ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;">${intro}</p>` : ""}
          <div style="font-size:15px;color:#374151;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">© ${year} UdeCataluña</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Roles internos: si quien creó la solicitud es uno de estos, no se notifica
// (evita spam cuando el propio equipo prueba la plataforma).
const INTERNAL_ROLES = ["admin", "super_admin", "financiera"];

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    kind?: "approved" | "rejected" | "created";
    comercial_email: string;
    asesor_email?: string;
    nombre: string;
    recibo_numero: string | null;
    pdfBase64?: string;
    rejection_reason?: string;
    request_id?: string;
  };

  const kind = body.kind ?? "approved";

  // "created": no exige rol de Financiera/Admin — cualquier usuario autenticado
  // puede pedirlo, pero solo para SU PROPIA solicitud. El servidor vuelve a
  // resolver correo/nombre/asesor desde la fila real (nunca confía en lo que
  // mande el cliente), y verifica dueño con created_by antes de enviar nada.
  if (kind === "created") {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!body.request_id) return NextResponse.json({ error: "Falta request_id" }, { status: 400 });

    const { data: reqRow, error: reqError } = await supabaseAdmin
      .from("invoice_requests")
      .select("created_by, created_by_role, nombre, comercial_email, asesor_nombre")
      .eq("id", body.request_id)
      .maybeSingle();
    if (reqError || !reqRow) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    if (reqRow.created_by !== user.id) return NextResponse.json({ error: "No autorizado para esta solicitud" }, { status: 403 });

    if (!reqRow.comercial_email || INTERNAL_ROLES.includes(reqRow.created_by_role ?? "")) {
      return NextResponse.json({ ok: true, skipped: "sin correo o rol interno" });
    }

    let asesorEmail: string | undefined;
    if (reqRow.created_by_role === "comercial" && reqRow.asesor_nombre) {
      const { data: asesorRow } = await supabaseAdmin
        .from("asesores")
        .select("email")
        .eq("nombre", reqRow.asesor_nombre)
        .maybeSingle();
      asesorEmail = asesorRow?.email ?? undefined;
    }

    const html = emailLayout({
      title: "Solicitud recibida",
      intro: `Hola, tu solicitud de <b>${reqRow.nombre}</b> fue creada y está <b>pendiente de revisión</b>.`,
      bodyHtml: `<p style="margin:0;">Te avisaremos por este mismo medio en cuanto sea aprobada o rechazada.</p>`,
    });
    await sendMailjet({
      to: reqRow.comercial_email,
      cc: asesorEmail,
      subject: `Solicitud recibida — ${reqRow.nombre}`,
      html,
    });
    return NextResponse.json({ ok: true });
  }

  // "approved" / "rejected": estas si requieren rol de Financiera/Admin,
  // porque solo ellos pueden aprobar o rechazar una solicitud.
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!body.comercial_email) return NextResponse.json({ ok: true, skipped: "no comercial_email" });

  if (kind === "rejected") {
    const html = emailLayout({
      title: "Solicitud rechazada",
      intro: `Hola, la solicitud de <b>${body.nombre}</b> fue <b>rechazada</b>.`,
      bodyHtml: `<p style="margin:0 0 12px;"><b>Motivo:</b> ${body.rejection_reason ?? "—"}</p>
        <p style="margin:0;">Corrígela y reenvíala desde la plataforma cuando esté lista.</p>`,
    });
    await sendMailjet({
      to: body.comercial_email,
      cc: body.asesor_email,
      subject: `Solicitud rechazada — ${body.nombre}`,
      html,
    });
    return NextResponse.json({ ok: true });
  }

  const filename = `Recibo-${body.recibo_numero ?? "UdeCataluña"}.pdf`;
  const html = emailLayout({
    title: "Solicitud aprobada",
    intro: `Hola, la solicitud de <b>${body.nombre}</b> fue <b>aprobada</b>.`,
    bodyHtml: `<p style="margin:0 0 12px;">Adjunto encontrarás el recibo${
      body.recibo_numero ? ` <b>N° ${body.recibo_numero}</b>` : ""
    } en formato PDF.</p>`,
  });

  await sendMailjet({
    to: body.comercial_email,
    cc: body.asesor_email,
    subject: `Solicitud aprobada${body.recibo_numero ? ` N° ${body.recibo_numero}` : ""} — ${body.nombre}`,
    html,
    ...(body.pdfBase64 ? { attachment: { filename, contentBase64: body.pdfBase64, mimeType: "application/pdf" } } : {}),
  });

  return NextResponse.json({ ok: true });
}
