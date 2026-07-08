"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";

export async function createClientRecord(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const { error } = await supabase.from("clients").insert({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || "") || null,
    phone: String(formData.get("phone") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projetos");
}

export async function createProject(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const clientId = String(formData.get("client_id") || "");

  const { error } = await supabase.from("projects").insert({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || null,
    status: String(formData.get("status") || "prospeccao"),
    budget_total: Number(formData.get("budget_total") || 0),
    start_date: String(formData.get("start_date") || "") || null,
    end_date: String(formData.get("end_date") || "") || null,
    client_id: clientId || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projetos");
  revalidatePath("/dashboard");
}

export async function updateProjectStatus(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projetos");
  revalidatePath("/dashboard");
}
