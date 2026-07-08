"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";

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
