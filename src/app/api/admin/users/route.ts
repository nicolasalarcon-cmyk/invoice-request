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

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = users.users.map((u) => u.id);
  const [{ data: roles }, { data: profs }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    supabaseAdmin.from("profiles").select("user_id,nombre_completo").in("user_id", ids),
  ]);

  const result = users.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    nombre: profs?.find((p) => p.user_id === u.id)?.nombre_completo ?? "",
    roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    email: string; password: string; nombre: string; role: "admin" | "comercial";
  };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { nombre_completo: body.nombre },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const uid = created.user!.id;
  await supabaseAdmin.from("profiles").upsert(
    { user_id: uid, nombre_completo: body.nombre, email: body.email },
    { onConflict: "user_id" },
  );
  await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
  await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: body.role });

  return NextResponse.json({ id: uid });
}
