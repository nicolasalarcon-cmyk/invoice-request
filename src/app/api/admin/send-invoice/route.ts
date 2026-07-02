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
    .in("role", ["super_admin", "admin"])
    .maybeSingle();
  if (!data) return null;
  return user;
}

async function sendMailjet({ to, subject, html, attachment }: {
  to: string; subject: string; html: string;
  attachment?: { filename: string; contentBase64: string; mimeType?: string };
}) {
  const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
  const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
  const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
  const FROM_NAME = process.env.MAILJET_FROM_NAME || "Plataforma de Recibos — UdeCataluña";
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !FROM_EMAIL) {
    throw new Error("Mailjet no está configurado (faltan variables de entorno)");
  }

  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString("base64");

  const message: Record<string, unknown> = {
    From: { Email: FROM_EMAIL, Name: FROM_NAME },
    To: [{ Email: to }],
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
          <div style="color:#ffffff;font-size:22px;font-weight:600;">Plataforma de Recibos</div>
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

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    kind?: "approved" | "rejected";
    comercial_email: string;
    nombre: string;
    recibo_numero: number | null;
    pdfBase64?: string;
    rejection_reason?: string;
  };

  if (!body.comercial_email) return NextResponse.json({ ok: true, skipped: "no comercial_email" });

  const financieraEmail = process.env.FINANCIERA_NOTIFY_EMAIL;
  const kind = body.kind ?? "approved";

  if (kind === "rejected") {
    const html = emailLayout({
      title: "Solicitud rechazada",
      intro: `Hola, la solicitud de <b>${body.nombre}</b> fue <b>rechazada</b>.`,
      bodyHtml: `<p style="margin:0 0 12px;"><b>Motivo:</b> ${body.rejection_reason ?? "—"}</p>
        <p style="margin:0;">Corrígela y reenvíala desde la plataforma cuando esté lista.</p>`,
    });
    await sendMailjet({
      to: body.comercial_email,
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

  const recipients = [body.comercial_email, ...(financieraEmail ? [financieraEmail] : [])];
  for (const to of recipients) {
    await sendMailjet({
      to,
      subject: `Solicitud aprobada${body.recibo_numero ? ` N° ${body.recibo_numero}` : ""} — ${body.nombre}`,
      html,
      ...(body.pdfBase64 ? { attachment: { filename, contentBase64: body.pdfBase64, mimeType: "application/pdf" } } : {}),
    });
  }

  return NextResponse.json({ ok: true });
}
