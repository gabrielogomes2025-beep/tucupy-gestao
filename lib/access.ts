import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AccessLevel, Module, Permission, Profile } from "@/lib/types";

export async function getAccessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: permissions } = await supabase
    .from("permissions")
    .select("*")
    .eq("user_id", user.id)
    .returns<Permission[]>();

  const permMap = new Map<Module, AccessLevel>();
  (permissions ?? []).forEach((p) => permMap.set(p.module, p.access_level));

  const isSuperAdmin = !!profile?.is_super_admin;

  function can(module: Module, min: AccessLevel = "view") {
    if (isSuperAdmin) return true;
    const level = permMap.get(module) ?? "none";
    if (min === "view") return level === "view" || level === "edit";
    return level === "edit";
  }

  return { supabase, user, profile: profile ?? null, isSuperAdmin, can };
}
