"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomBytes } from "crypto";

const MODULES = ["financeiro", "rh", "projetos", "permissoes"] as const;

export async function setPermission(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("permissoes", "edit")) throw new Error("Sem permissão para gerenciar acessos.");

  const user_id = String(formData.get("user_id"));
  const module = String(formData.get("module"));
  const access_level = String(formData.get("access_level"));

  if (!MODULES.includes(module as any)) throw new Error("Módulo inválido.");

  const { error } = await supabase
    .from("permissions")
    .upsert({ user_id, module, access_level }, { onConflict: "user_id,module" });

  if (error) throw new Error(error.message);
  revalidatePath("/permissoes");
}

export async function linkEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("permissoes", "edit")) throw new Error("Sem permissão para gerenciar acessos.");

  const profile_id = String(formData.get("profile_id"));
  const employee_id = String(formData.get("employee_id")) || null;

  const { error } = await supabase.from("profiles").update({ employee_id }).eq("id", profile_id);
  if (error) throw new Error(error.message);
  revalidatePath("/permissoes");
}

export async function createInvite(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("permissoes", "edit")) throw new Error("Sem permissão para gerenciar acessos.");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) throw new Error("Informe o email da pessoa a convidar.");
  const employeeId = String(formData.get("employee_id") || "") || null;

  const token = randomBytes(24).toString("hex");

  const { error } = await supabase.from("invites").insert({
    email,
    token,
    employee_id: employeeId,
    financeiro_access: String(formData.get("financeiro_access") || "none"),
    rh_access: String(formData.get("rh_access") || "none"),
    projetos_access: String(formData.get("projetos_access") || "none"),
    permissoes_access: String(formData.get("permissoes_access") || "none"),
  });
  if (error) throw new Error(error.message);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const link = `${origin}/login?mode=signup&invite=${token}&email=${encodeURIComponent(email)}`;

  revalidatePath("/permissoes");
  redirect(`/permissoes?invite_link=${encodeURIComponent(link)}`);
}

export async function cancelInvite(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("permissoes", "edit")) throw new Error("Sem permissão para gerenciar acessos.");

  const id = String(formData.get("id"));
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/permissoes");
}
