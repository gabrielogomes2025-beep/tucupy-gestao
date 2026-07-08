"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";

export async function createTransaction(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const projectId = String(formData.get("project_id") || "");

  const { error } = await supabase.from("transactions").insert({
    type: String(formData.get("type") || "despesa"),
    category: String(formData.get("category") || "Outro"),
    status: String(formData.get("status") || "previsto"),
    amount: Number(formData.get("amount") || 0),
    description: String(formData.get("description") || "") || null,
    due_date: String(formData.get("due_date") || "") || null,
    paid_date: String(formData.get("paid_date") || "") || null,
    project_id: projectId || null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
}

export async function updateTransaction(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id") || "");

  const { error } = await supabase
    .from("transactions")
    .update({
      type: String(formData.get("type") || "despesa"),
      category: String(formData.get("category") || "Outro"),
      status: String(formData.get("status") || "previsto"),
      amount: Number(formData.get("amount") || 0),
      description: String(formData.get("description") || "") || null,
      due_date: String(formData.get("due_date") || "") || null,
      project_id: projectId || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
}

export async function markStatus(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "previsto" | "realizado";
  const paid_date = status === "realizado" ? new Date().toISOString().slice(0, 10) : null;
  const { error } = await supabase.from("transactions").update({ status, paid_date }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
}
