import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(s: string): string {
  // RFC 2047 encoded-word (UTF-8 + Base64) for non-ASCII
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b = btoa(unescape(encodeURIComponent(s)));
  return `=?UTF-8?B?${b}?=`;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  attachment?: { filename: string; contentBase64: string; mimeType?: string };
}

async function sendGmail({ to, subject, html, attachment }: SendArgs) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
    throw new Error("Gmail no está conectado");
  }

  const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
  ];

  let raw: string;
  if (attachment) {
    raw =
      headers.join("\r\n") +
      `\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      btoa(unescape(encodeURIComponent(html))) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${attachment.mimeType ?? "application/pdf"}; name="${attachment.filename}"\r\n` +
      `Content-Disposition: attachment; filename="${attachment.filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      attachment.contentBase64.replace(/(.{76})/g, "$1\r\n") +
      `\r\n--${boundary}--`;
  } else {
    raw =
      headers.join("\r\n") +
      `\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
      btoa(unescape(encodeURIComponent(html)));
  }

  const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail ${res.status}: ${t}`);
  }
  return await res.json();
}

function emailLayout({ title, intro, bodyHtml, ctaLabel, ctaUrl }: {
  title: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0a2540 0%,#13386b 100%);padding:28px 32px;">
          <div style="color:#ffffff;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Universidad de Cataluña</div>
          <div style="color:#ffffff;font-size:22px;font-weight:600;margin-top:6px;">Plataforma de Recibos</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0a2540;font-weight:600;">${title}</h1>
          ${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${intro}</p>` : ""}
          <div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
          ${ctaUrl && ctaLabel ? `<div style="margin:28px 0 8px;"><a href="${ctaUrl}" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${ctaLabel}</a></div>` : ""}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#fafbfc;">
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
            Este es un mensaje automático de la Universidad de Cataluña.<br/>
            © ${year} UdeCataluña · Todos los derechos reservados.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}



async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Solo administradores");
}

/* ---------- USERS ADMIN ---------- */

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const ids = users.users.map((u) => u.id);
    const [{ data: roles }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
      supabaseAdmin.from("profiles").select("user_id,nombre_completo").in("user_id", ids),
    ]);
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      nombre: profs?.find((p) => p.user_id === u.id)?.nombre_completo ?? "",
      roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
    }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; nombre: string; role: "admin" | "comercial" }) => d)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre_completo: data.nombre },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // ensure profile
    await supabaseAdmin.from("profiles").upsert({
      user_id: uid,
      nombre_completo: data.nombre,
      email: data.email,
    }, { onConflict: "user_id" });
    // set role (replace defaults)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });

    const loginUrl = process.env.SITE_URL || "http://localhost:8080";
    const roleLabel = data.role === "admin" ? "Administrador" : "Comercial";
    await sendGmail({
      to: data.email,
      subject: "Bienvenido a la Plataforma de Recibos · UdeCataluña",
      html: emailLayout({
        title: `Bienvenido, ${data.nombre}`,
        intro: `Tu cuenta en la Plataforma de Recibos de la Universidad de Cataluña ha sido creada con el rol de <b>${roleLabel}</b>.`,
        bodyHtml: `
          <p style="margin:0 0 12px;">A continuación encontrarás tus credenciales de acceso:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px;">
            <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:130px;">Correo</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${data.email}</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Contraseña</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;font-family:monospace;">${data.password}</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Rol</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${roleLabel}</td></tr>
          </table>
        `,
        ctaLabel: "Ingresar a la plataforma",
        ctaUrl: `${loginUrl}/login`,
      }),
    }).catch((e) => console.error("email new user fail", e));

    return { id: uid };
  });

export const adminUpdatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => d)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "comercial" }) => d)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("No puedes eliminar tu propia cuenta");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- NOTIFICATIONS ---------- */

export const notifyAdminsNewRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nombre: string; identificacion: string; programa: string; valor_total: number; comercial_nombre?: string | null }) => d)
  .handler(async ({ data }) => {
    // get admin emails
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { ok: true, sent: 0 };
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emails = users.users.filter((u) => ids.includes(u.id) && u.email).map((u) => u.email!);
    const siteUrl = process.env.SITE_URL || "http://localhost:8080";
    const rows = [
      `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:130px;">Estudiante</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${data.nombre}</td></tr>`,
      `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Identificación</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${data.identificacion}</td></tr>`,
      `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Programa</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${data.programa}</td></tr>`,
      `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Valor</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">$${data.valor_total.toLocaleString("es-CO")}</td></tr>`,
      data.comercial_nombre ? `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Asesor</td><td style="padding:6px 0;font-size:14px;color:#0a2540;font-weight:600;">${data.comercial_nombre}</td></tr>` : "",
    ].join("");
    const html = emailLayout({
      title: "Nueva solicitud pendiente",
      intro: "Se ha registrado una nueva solicitud de recibo que requiere tu revisión.",
      bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">${rows}</table>`,
      ctaLabel: "Revisar bandeja",
      ctaUrl: `${siteUrl}/admin`,
    });
    for (const to of emails) {
      await sendGmail({ to, subject: "Nueva solicitud de recibo pendiente", html }).catch((e) =>
        console.error("notify admin fail", to, e),
      );
    }
    return { ok: true, sent: emails.length };
  });

export const sendApprovedInvoiceToStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    to: string;
    cc?: string | null;
    nombre: string;
    recibo_numero: number | null;
    pdfBase64: string;
  }) => d)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const filename = `Recibo-${data.recibo_numero ?? "UdeCataluña"}.pdf`;
    const html = emailLayout({
      title: "Tu recibo de pago está listo",
      intro: `Hola ${data.nombre}, tu solicitud ha sido <b>aprobada</b>.`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Adjunto a este correo encontrarás tu recibo de pago${
          data.recibo_numero ? ` <b>N° ${data.recibo_numero}</b>` : ""
        } en formato PDF.</p>
        <p style="margin:0;">Si tienes alguna inquietud, contacta a tu asesor comercial.</p>
      `,
    });
    const recipients = [data.to, ...(data.cc ? [data.cc] : [])];
    for (const to of recipients) {
      await sendGmail({
        to,
        subject: `Tu recibo de pago${data.recibo_numero ? ` N° ${data.recibo_numero}` : ""} — UdeCataluña`,
        html,
        attachment: { filename, contentBase64: data.pdfBase64, mimeType: "application/pdf" },
      });
    }
    return { ok: true };
  });
