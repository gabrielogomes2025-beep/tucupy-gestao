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
    cnpj: String(formData.get("cnpj") || "") || null,
    razao_social: String(formData.get("razao_social") || "") || null,
    inscricao_estadual: String(formData.get("inscricao_estadual") || "") || null,
    endereco: String(formData.get("endereco") || "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projetos");
}

export async function updateClientRecord(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));

  const { error } = await supabase
    .from("clients")
    .update({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      notes: String(formData.get("notes") || "") || null,
      cnpj: String(formData.get("cnpj") || "") || null,
      razao_social: String(formData.get("razao_social") || "") || null,
      inscricao_estadual: String(formData.get("inscricao_estadual") || "") || null,
      endereco: String(formData.get("endereco") || "") || null,
    })
    .eq("id", id);
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

export async function updateProject(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const clientId = String(formData.get("client_id") || "");

  const { error } = await supabase
    .from("projects")
    .update({
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      status: String(formData.get("status") || "prospeccao"),
      budget_total: Number(formData.get("budget_total") || 0),
      start_date: String(formData.get("start_date") || "") || null,
      end_date: String(formData.get("end_date") || "") || null,
      client_id: clientId || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/projetos");
  revalidatePath(`/projetos/${id}`);
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

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export async function uploadProjectFile(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const projectId = String(formData.get("project_id") || "");
  const category = String(formData.get("category") || "outro");
  const file = formData.get("file");

  if (!projectId) throw new Error("Projeto inválido.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo maior que 20MB.");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${projectId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error: dbError } = await supabase.from("project_files").insert({
    project_id: projectId,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    content_type: file.type || null,
    category,
    uploaded_by: user.id,
  });
  if (dbError) {
    await supabase.storage.from("project-files").remove([storagePath]);
    throw new Error(dbError.message);
  }

  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteProjectFile(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const storagePath = String(formData.get("storage_path"));

  await supabase.storage.from("project-files").remove([storagePath]);
  const { error } = await supabase.from("project_files").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/projetos/${projectId}`);
}

export async function addProjectTeamMember(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit") && !can("rh", "edit")) throw new Error("Sem permissão para alocar equipe.");

  const projectId = String(formData.get("project_id") || "");
  const employeeId = String(formData.get("employee_id") || "");
  const allocatedHours = Number(formData.get("allocated_hours") || 0);
  if (!projectId || !employeeId) throw new Error("Selecione um colaborador.");

  const { data: employee } = await supabase.from("employees").select("hourly_cost").eq("id", employeeId).single();
  const hourlyCost = Number(employee?.hourly_cost ?? 0);

  const { error } = await supabase.from("project_team").upsert(
    {
      project_id: projectId,
      employee_id: employeeId,
      allocated_hours: allocatedHours,
      hourly_cost_snapshot: hourlyCost,
    },
    { onConflict: "project_id,employee_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function removeProjectTeamMember(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit") && !can("rh", "edit")) throw new Error("Sem permissão para alocar equipe.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const { error } = await supabase.from("project_team").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function upsertBudgetCategory(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const projectId = String(formData.get("project_id") || "");
  const category = String(formData.get("category") || "").trim();
  const budgetedAmount = Number(formData.get("budgeted_amount") || 0);
  if (!projectId || !category) throw new Error("Informe a categoria.");

  const { error } = await supabase
    .from("project_budget_categories")
    .upsert({ project_id: projectId, category, budgeted_amount: budgetedAmount }, { onConflict: "project_id,category" });
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteBudgetCategory(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "edit")) throw new Error("Sem permissão de edição em Financeiro.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const { error } = await supabase.from("project_budget_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function createProjectTask(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const projectId = String(formData.get("project_id") || "");
  const assignedTo = String(formData.get("assigned_to") || "");

  const { error } = await supabase.from("project_tasks").insert({
    project_id: projectId,
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || "") || null,
    status: String(formData.get("status") || "todo"),
    assigned_to: assignedTo || null,
    due_date: String(formData.get("due_date") || "") || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function updateProjectTaskStatus(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const status = String(formData.get("status"));
  const { error } = await supabase.from("project_tasks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function updateProjectTask(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const assignedTo = String(formData.get("assigned_to") || "");

  const { error } = await supabase
    .from("project_tasks")
    .update({
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || "") || null,
      status: String(formData.get("status") || "todo"),
      assigned_to: assignedTo || null,
      due_date: String(formData.get("due_date") || "") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteProjectTask(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "edit")) throw new Error("Sem permissão de edição em Projetos.");

  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projetos/${projectId}`);
}
