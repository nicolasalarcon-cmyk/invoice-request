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

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b = btoa(unescape(encodeURIComponent(s)));
  return `=?UTF-8?B?${b}?=`;
}

async function sendGmail({ to, subject, html, attachment }: {
  to: string; subject: string; html: string;
  attachment?: { filename: string; contentBase64: string; mimeType?: string };
}) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) throw new Error("Email API keys not configured");

  const boundary = `boundary_${Date.now()}`;
  const parts: string[] = [];
  parts.push(
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64url(html)}`,
  );
  if (attachment) {
    parts.push(
      `--${boundary}\r\nContent-Type: ${attachment.mimeType ?? "application/octet-stream"}; name="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n${attachment.contentBase64}`,
    );
  }
  const raw =
    `To: ${to}\r\nSubject: ${encodeSubject(subject)}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
    parts.join("\r\n") +
    `\r\n--${boundary}--`;

  const res = await fetch(`${GATEWAY}/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lovable-api-key": LOVABLE_API_KEY,
      "x-api-key": GOOGLE_MAIL_API_KEY,
    },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
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
    to: string; cc?: string | null; nombre: string;
    recibo_numero: number | null; pdfBase64: string;
  };

  const filename = `Recibo-${body.recibo_numero ?? "UdeCataluña"}.pdf`;
  const html = emailLayout({
    title: "Tu recibo de pago está listo",
    intro: `Hola ${body.nombre}, tu solicitud ha sido <b>aprobada</b>.`,
    bodyHtml: `<p style="margin:0 0 12px;">Adjunto encontrarás tu recibo de pago${
      body.recibo_numero ? ` <b>N° ${body.recibo_numero}</b>` : ""
    } en formato PDF.</p>`,
  });

  const recipients = [body.to, ...(body.cc ? [body.cc] : [])];
  for (const to of recipients) {
    await sendGmail({
      to,
      subject: `Tu recibo de pago${body.recibo_numero ? ` N° ${body.recibo_numero}` : ""} — UdeCataluña`,
      html,
      attachment: { filename, contentBase64: body.pdfBase64, mimeType: "application/pdf" },
    });
  }

  return NextResponse.json({ ok: true });
}
