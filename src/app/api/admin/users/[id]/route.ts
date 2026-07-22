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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as { action: "password" | "role"; password?: string; role?: "super_admin" | "admin" | "financiera" | "cartera" | "mini_financiera" | "comercial" };

  if (body.action === "password") {
    if (!body.password) return NextResponse.json({ error: "Missing password" }, { status: 400 });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (body.action === "role") {
    if (!body.role) return NextResponse.json({ error: "Missing role" }, { status: 400 });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: body.role });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === adminUser.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
