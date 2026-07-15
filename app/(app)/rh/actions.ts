"use server";

import { getAccessContext } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { valorPorExtenso, dataPorExtenso } from "@/lib/extenso";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "node:fs/promises";
import path from "node:path";
import { extractFieldsFromDocuments, type DocForExtraction, type ExtractedEmployeeFields } from "@/lib/ai-extract";
import type { EmployeeDocumentCategory } from "@/lib/types";

function extractContractPayload(formData: FormData, hiring_type: string, employee_id: string) {
  const payload: Record<string, unknown> = { employee_id, updated_at: new Date().toISOString() };
  if (hiring_type === "cnpj") {
    payload.cnpj_razao_social = String(formData.get("cnpj_razao_social") || "") || null;
    payload.cnpj_numero = String(formData.get("cnpj_numero") || "") || null;
    payload.cnpj_valor_mensal = Number(formData.get("cnpj_valor_mensal") || 0) || null;
    payload.cnpj_contract_start_date = String(formData.get("cnpj_contract_start_date") || "") || null;
    payload.cnpj_prazo_meses = Number(formData.get("cnpj_prazo_meses") || 0) || 3;
    payload.cnpj_dia_pagamento = Number(formData.get("cnpj_dia_pagamento") || 0) || 10;
    payload.cnpj_bank_name = String(formData.get("cnpj_bank_name") || "") || null;
    payload.cnpj_bank_agency = String(formData.get("cnpj_bank_agency") || "") || null;
    payload.cnpj_bank_account = String(formData.get("cnpj_bank_account") || "") || null;
    payload.cnpj_pix_key = String(formData.get("cnpj_pix_key") || "") || null;
  } else if (hiring_type === "estagiario") {
    payload.estagio_instituicao = String(formData.get("estagio_instituicao") || "") || null;
    payload.estagio_curso = String(formData.get("estagio_curso") || "") || null;
    payload.estagio_start_date = String(formData.get("estagio_start_date") || "") || null;
    payload.estagio_end_date = String(formData.get("estagio_end_date") || "") || null;
    payload.estagio_bolsa_valor = Number(formData.get("estagio_bolsa_valor") || 0) || null;
    payload.estagio_carga_horaria_semanal = Number(formData.get("estagio_carga_horaria_semanal") || 0) || null;
    payload.estagio_horario = String(formData.get("estagio_horario") || "") || null;
  }
  return payload;
}

export async function createEmployee(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const hiring_type = String(formData.get("hiring_type") || "") || null;

  const { data: inserted, error } = await supabase
    .from("employees")
    .insert({
      full_name: String(formData.get("full_name") || ""),
      email: String(formData.get("email") || "") || null,
      role: String(formData.get("role") || "") || null,
      department: String(formData.get("department") || "") || null,
      hire_date: String(formData.get("hire_date") || "") || null,
      monthly_salary: Number(formData.get("monthly_salary") || 0),
      hourly_cost: Number(formData.get("hourly_cost") || 0),
      phone: String(formData.get("phone") || "") || null,
      hiring_type,
      address: String(formData.get("address") || "") || null,
      marital_status: String(formData.get("marital_status") || "") || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (hiring_type === "cnpj" || hiring_type === "estagiario") {
    const contractPayload = extractContractPayload(formData, hiring_type, inserted.id);
    await supabase.from("employee_contract_data").upsert(contractPayload, { onConflict: "employee_id" });
  }

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
      hiring_type: String(formData.get("hiring_type") || "") || null,
      address: String(formData.get("address") || "") || null,
      marital_status: String(formData.get("marital_status") || "") || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/rh");
  revalidatePath("/dashboard");
}

export async function upsertContractData(formData: FormData) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employee_id = String(formData.get("employee_id"));
  const hiring_type = String(formData.get("hiring_type") || "");
  const payload = extractContractPayload(formData, hiring_type, employee_id);

  const { error } = await supabase.from("employee_contract_data").upsert(payload, { onConflict: "employee_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/rh");
}

function mesesEntre(inicioIso: string, fimIso: string): number {
  const a = new Date(inicioIso + "T00:00:00");
  const b = new Date(fimIso + "T00:00:00");
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (30.44 * 86400000)));
}

export async function generateContract(formData: FormData) {
  const { supabase, can, user } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employeeId = String(formData.get("employee_id") || "");
  if (!employeeId) throw new Error("Colaborador inválido.");

  const [{ data: employee }, { data: contractData }, { data: sensitive }] = await Promise.all([
    supabase.from("employees").select("*").eq("id", employeeId).single(),
    supabase.from("employee_contract_data").select("*").eq("employee_id", employeeId).maybeSingle(),
    supabase.from("employee_sensitive_data").select("*").eq("employee_id", employeeId).maybeSingle(),
  ]);

  if (!employee) throw new Error("Colaborador não encontrado.");
  if (!employee.hiring_type) throw new Error("Defina o tipo de contratação (CNPJ ou Estagiário) antes de gerar o contrato.");

  const hoje = new Date().toISOString().slice(0, 10);
  let templateFile: string;
  let data: Record<string, string>;

  if (employee.hiring_type === "cnpj") {
    templateFile = "template_cnpj.docx";
    const valorMensal = Number(contractData?.cnpj_valor_mensal || 0);
    data = {
      nome: employee.full_name || "",
      endereco: employee.address || "",
      cnpj_numero: contractData?.cnpj_numero || "",
      prazo_meses: String(contractData?.cnpj_prazo_meses || 3),
      valor_mensal: valorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      valor_mensal_extenso: valorPorExtenso(valorMensal),
      dia_pagamento: String(contractData?.cnpj_dia_pagamento || 10),
      data_assinatura: new Date(hoje + "T00:00:00").toLocaleDateString("pt-BR"),
    };
  } else {
    templateFile = "template_estagio.docx";
    const bolsaValor = Number(contractData?.estagio_bolsa_valor || 0);
    const inicio = contractData?.estagio_start_date || hoje;
    const fim = contractData?.estagio_end_date || hoje;
    data = {
      nome: employee.full_name || "",
      estado_civil: employee.marital_status || "",
      rg: sensitive?.rg || "",
      cpf: sensitive?.cpf || "",
      endereco: employee.address || "",
      curso: contractData?.estagio_curso || "",
      instituicao: contractData?.estagio_instituicao || "",
      horario: contractData?.estagio_horario || "",
      carga_horaria_semanal: String(contractData?.estagio_carga_horaria_semanal || ""),
      bolsa_valor: bolsaValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      bolsa_valor_extenso: valorPorExtenso(bolsaValor),
      prazo_meses: String(mesesEntre(inicio, fim)),
      data_inicio: new Date(inicio + "T00:00:00").toLocaleDateString("pt-BR"),
      data_assinatura_extenso: dataPorExtenso(hoje),
    };
  }

  const templatePath = path.join(process.cwd(), "lib", "contract-templates", templateFile);
  const templateBuffer = await fs.readFile(templatePath);

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });

  const safeName = employee.full_name.replace(/[^\w.\-]+/g, "_");
  const fileName = `Contrato_${safeName}_${hoje}.docx`;
  const storagePath = `${employeeId}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage.from("employee-documents").upload(storagePath, outputBuffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: docRow, error: dbError } = await supabase
    .from("employee_documents")
    .insert({
      employee_id: employeeId,
      file_name: fileName,
      storage_path: storagePath,
      file_size: outputBuffer.length,
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      category: "contrato",
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (dbError) {
    await supabase.storage.from("employee-documents").remove([storagePath]);
    throw new Error(dbError.message);
  }

  await supabase
    .from("employee_contract_data")
    .upsert(
      { employee_id: employeeId, contract_document_id: docRow.id, contract_generated_at: new Date().toISOString() },
      { onConflict: "employee_id" }
    );

  revalidatePath("/rh");
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

const SOURCE_DOC_CATEGORIES: EmployeeDocumentCategory[] = [
  "documento_pessoal",
  "cartao_cnpj",
  "comprovante_matricula",
  "comprovante_endereco",
];
const MAX_DOCS_FOR_AI = 5;
const MAX_DOC_BYTES_FOR_AI = 8 * 1024 * 1024; // 8MB por documento

function guessMediaType(contentType: string | null, fileName: string): DocForExtraction["mediaType"] | null {
  const ct = (contentType || "").toLowerCase();
  if (ct === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (ct === "image/jpeg" || ct === "image/jpg") return "image/jpeg";
  if (ct === "image/png") return "image/png";
  if (ct === "image/gif") return "image/gif";
  if (ct === "image/webp") return "image/webp";
  return null;
}

export async function extractContractDataWithAI(formData: FormData): Promise<ExtractedEmployeeFields> {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "edit")) throw new Error("Sem permissão de edição em RH.");

  const employeeId = String(formData.get("employee_id") || "");
  if (!employeeId) throw new Error("Colaborador inválido.");

  const { data: allDocs, error: docsError } = await supabase
    .from("employee_documents")
    .select("*")
    .eq("employee_id", employeeId)
    .neq("category", "contrato")
    .order("created_at", { ascending: false });
  if (docsError) throw new Error(docsError.message);

  const candidates = (allDocs ?? [])
    .filter((d) => SOURCE_DOC_CATEGORIES.includes(d.category))
    .filter((d) => guessMediaType(d.content_type, d.file_name) !== null)
    .filter((d) => (d.file_size ?? 0) <= MAX_DOC_BYTES_FOR_AI)
    .slice(0, MAX_DOCS_FOR_AI);

  if (candidates.length === 0) {
    throw new Error(
      "Nenhum documento compatível encontrado. Anexe documentos em imagem (JPG/PNG) ou PDF nas categorias Documento pessoal, Cartão CNPJ ou Comprovante de matrícula."
    );
  }

  const docsForAI: DocForExtraction[] = [];
  for (const d of candidates) {
    const mediaType = guessMediaType(d.content_type, d.file_name)!;
    const { data: blob, error: downloadError } = await supabase.storage.from("employee-documents").download(d.storage_path);
    if (downloadError || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    docsForAI.push({ base64: buffer.toString("base64"), mediaType, fileName: d.file_name });
  }

  if (docsForAI.length === 0) {
    throw new Error("Não foi possível baixar os documentos para análise.");
  }

  return extractFieldsFromDocuments(docsForAI);
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
