"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";

export async function createEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const { error } = await supabase.from("employees").insert({
    full_name: String(formData.get("full_name") || ""),
    email: String(formData.get("email") || "") || null,
    role: String(formData.get("role") || "") || null,
    department: String(formData.get("department") || "") || null,
    hire_date: String(formData.get("hire_date") || "") || null,
    monthly_salary: Number(formData.get("monthly_salary") || 0),
    hourly_cost: Number(formData.get("hourly_cost") || 0),
    phone: String(formData.get("phone") || "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/rh");
  revalidatePath("/dashboard");
}

export async function updateEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: String(formData.get("full_name") || ""),
      email: String(formData.get("email") || "") || null,
      role: String(formData.get("role") || "") || null,
      department: String(formData.get("department") || "") || null,
      hire_date: String(formData.get("hire_date") || "") || null,
      monthly_salary: Number(formData.get("monthly_salary") || 0),
      hourly_cost: Number(formData.get("hourly_cost") || 0),
      phone: String(formData.get("phone") || "") || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/rh");
  revalidatePath("/dashboard");
}

export async function terminateEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));
  const termination_date = String(formData.get("termination_date") || "") || new Date().toISOString().slice(0, 10);
  const termination_reason = String(formData.get("termination_reason") || "outro");

  const { error } = await supabase
    .from("employees")
    .update({ active: false, termination_date, termination_reason })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rh");
  revalidatePath("/dashboard");
}

export async function reactivateEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("employees")
    .update({ active: true, termination_date: null, termination_reason: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rh");
  revalidatePath("/dashboard");
}

export async function createLeaveRequest(formData: FormData) {
  const { supabase, can, profile } = await getAccessContext();

  const employeeId = String(formData.get("employee_id") || "") || profile?.employee_id || "";
  if (!employeeId) throw new Error("Selecione um colaborador.");
  if (!can("rh", "edit") && employeeId !== profile?.employee_id) {
    throw new Error("Você só pode solicitar férias/ausências para si mesmo.");
  }

  const { error } = await supabase.from("leave_requests").insert({
    employee_id: employeeId,
    type: String(formData.get("type") || "ferias"),
    start_date: String(formData.get("start_date") || ""),
    end_date: String(formData.get("end_date") || ""),
    notes: String(formData.get("notes") || "") || null,
    requested_by: profile?.id,
    status: can("rh", "edit") ? "aprovado" : "pendente",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/rh/ferias");
  revalidatePath("/dashboard");
}

export async function decideLeaveRequest(formData: FormData) {
  const { supabase, can, profile } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const { error } = await supabase.from("leave_requests").update({ status, decided_by: profile?.id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rh/ferias");
  revalidatePath("/dashboard");
}

export async function upsertPayrollEntry(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employee_id = String(formData.get("employee_id"));
  const ref_month = String(formData.get("ref_month"));
  const base_salary = Number(formData.get("base_salary") || 0);
  const bonuses = Number(formData.get("bonuses") || 0);
  const deductions = Number(formData.get("deductions") || 0);

  const { error } = await supabase
    .from("payroll_entries")
    .upsert({ employee_id, ref_month, base_salary, bonuses, deductions }, { onConflict: "employee_id,ref_month" });

  if (error) throw new Error(error.message);
  revalidatePath("/rh/folha");
  revalidatePath("/dashboard");
}

export async function upsertEmployeeSensitiveData(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employee_id = String(formData.get("employee_id"));

  const { error } = await supabase.from("employee_sensitive_data").upsert(
    {
      employee_id,
      cpf: String(formData.get("cpf") || "") || null,
      rg: String(formData.get("rg") || "") || null,
      pix_key: String(formData.get("pix_key") || "") || null,
      bank_name: String(formData.get("bank_name") || "") || null,
      bank_agency: String(formData.get("bank_agency") || "") || null,
      bank_account: String(formData.get("bank_account") || "") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/rh");
}

const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20MB

export async function uploadEmployeeDocument(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employeeId = String(formData.get("employee_id") || "");
  const category = String(formData.get("category") || "outro");
  const file = formData.get("file");

  if (!employeeId) throw new Error("Colaborador inválido.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
  if (file.size > MAX_DOC_BYTES) throw new Error("Arquivo maior que 20MB.");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${employeeId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("employee-documents").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error: dbError } = await supabase.from("employee_documents").insert({
    employee_id: employeeId,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    content_type: file.type || null,
    category,
    uploaded_by: user.id,
  });
  if (dbError) {
    await supabase.storage.from("employee-documents").remove([storagePath]);
    throw new Error(dbError.message);
  }

  revalidatePath("/rh");
}

export async function deleteEmployeeDocument(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));
  const storagePath = String(formData.get("storage_path"));

  await supabase.storage.from("employee-documents").remove([storagePath]);
  const { error } = await supabase.from("employee_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/rh");
}

export async function markPayrollPaid(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("payroll_entries")
    .update({ status: "pago", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rh/folha");
  revalidatePath("/dashboard");
}
