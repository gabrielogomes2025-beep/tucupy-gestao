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

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export async function uploadTransactionFile(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const transactionId = String(formData.get("transaction_id") || "");
  const file = formData.get("file");

  if (!transactionId) throw new Error("Lançamento inválido.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo maior que 20MB.");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${transactionId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("transaction-files").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error: dbError } = await supabase.from("transaction_files").insert({
    transaction_id: transactionId,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    content_type: file.type || null,
    uploaded_by: user.id,
  });
  if (dbError) {
    await supabase.storage.from("transaction-files").remove([storagePath]);
    throw new Error(dbError.message);
  }

  revalidatePath("/financeiro");
}

export async function deleteTransactionFile(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const storagePath = String(formData.get("storage_path"));

  await supabase.storage.from("transaction-files").remove([storagePath]);
  const { error } = await supabase.from("transaction_files").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
}

export async function createRecurringTransaction(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const projectId = String(formData.get("project_id") || "");
  const dayOfMonth = Math.min(28, Math.max(1, Number(formData.get("day_of_month") || 1)));

  const { error } = await supabase.from("recurring_transactions").insert({
    type: String(formData.get("type") || "despesa"),
    category: String(formData.get("category") || "Outro"),
    amount: Number(formData.get("amount") || 0),
    description: String(formData.get("description") || "") || null,
    project_id: projectId || null,
    day_of_month: dayOfMonth,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function toggleRecurringTransaction(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("recurring_transactions").update({ active: !active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function deleteRecurringTransaction(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}
