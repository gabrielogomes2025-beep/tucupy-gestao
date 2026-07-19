import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import type { EmployeeContractData, EmployeeDocument, EmployeeHistoryEntry, EmployeeSensitiveData } from "@/lib/types";
import {
  updateEmployee,
  terminateEmployee,
  reactivateEmployee,
  upsertEmployeeSensitiveData,
  createEmployeeDocumentUploadUrl,
  finalizeEmployeeDocumentUpload,
  deleteEmployeeDocument,
  upsertContractData,
  generateContract,
} from "../actions";
import { ContractAiExtract } from "@/components/ContractAiExtract";
import { EmployeeDocumentUpload } from "@/components/EmployeeDocumentUpload";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const TERMINATION_REASON_LABEL: Record<string, string> = {
  pedido_demissao: "Pedido de demissão",
  demissao_sem_justa_causa: "Demissão sem justa causa",
  demissao_justa_causa: "Demissão com justa causa",
  termino_contrato: "Término de contrato",
  outro: "Outro",
};

const HISTORY_FIELD_LABEL: Record<string, string> = {
  role: "Cargo",
  monthly_salary: "Salário mensal",
  department: "Departamento",
};

const DOC_CATEGORY_LABEL: Record<string, string> = {
  contrato: "Contrato assinado",
  documento_pessoal: "Documento pessoal (RG/CPF)",
  comprovante_endereco: "Comprovante de endereço",
  cartao_cnpj: "Cartão CNPJ",
  comprovante_matricula: "Comprovante de matrícula",
  outro: "Outro",
};

const HIRING_TYPE_LABEL: Record<string, string> = {
  cnpj: "CNPJ (PJ)",
  estagiario: "Estagiário",
};

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");
  if (!canEdit) redirect("/rh");

  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!employee) notFound();

  const [{ data: contractData }, { data: sensitive }, { data: documents }, { data: history }] = await Promise.all([
    supabase.from("employee_contract_data").select("*").eq("employee_id", id).maybeSingle<EmployeeContractData>(),
    supabase.from("employee_sensitive_data").select("*").eq("employee_id", id).maybeSingle<EmployeeSensitiveData>(),
    supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .returns<EmployeeDocument[]>(),
    supabase
      .from("employee_history")
      .select("*")
      .eq("employee_id", id)
      .order("changed_at", { ascending: false })
      .returns<EmployeeHistoryEntry[]>(),
  ]);

  const docList = documents ?? [];
  const historyList = history ?? [];

  const signedUrls = new Map<string, string>();
  for (const d of docList) {
    const { data: signed } = await supabase.storage.from("employee-documents").createSignedUrl(d.storage_path, 60 * 60);
    if (signed?.signedUrl) signedUrls.set(d.id, signed.signedUrl);
  }

  return (
    <div>
      <Link href="/rh" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← Voltar para Colaboradores
      </Link>

      <PageHeader
        title={employee.full_name}
        description={[employee.role, employee.department].filter(Boolean).join(" · ") || "Sem cargo/departamento definido"}
        action={
          <div className="flex items-center gap-2">
            {employee.hiring_type && <Badge>{HIRING_TYPE_LABEL[employee.hiring_type] || employee.hiring_type}</Badge>}
            <Badge tone={employee.active ? "good" : "bad"}>{employee.active ? "ativo" : "inativo"}</Badge>
            {employee.active ? (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20">
                  Desligar
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[300px]">
                  <form action={terminateEmployee} className="space-y-3">
                    <input type="hidden" name="id" value={employee.id} />
                    <div>
                      <Label>Data de desligamento</Label>
                      <Input name="termination_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Select name="termination_reason" defaultValue="pedido_demissao">
                        {Object.entries(TERMINATION_REASON_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button variant="danger" type="submit" className="w-full">
                      Confirmar desligamento
                    </Button>
                  </form>
                </Card>
              </details>
            ) : (
              <form action={reactivateEmployee}>
                <input type="hidden" name="id" value={employee.id} />
                <Button variant="ghost" type="submit">
                  Reativar
                </Button>
              </form>
            )}
          </div>
        }
      />

      {!employee.active && employee.termination_date && (
        <Card className="mb-6 border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">
            Desligado em {formatDate(employee.termination_date)}
            {employee.termination_reason ? ` · ${TERMINATION_REASON_LABEL[employee.termination_reason] || employee.termination_reason}` : ""}
          </p>
        </Card>
      )}

      <div className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 ${employee.hiring_type === "estagiario" ? "lg:grid-cols-4" : ""}`}>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Salário mensal</div>
          <div className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(employee.monthly_salary)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Custo/hora projeto</div>
          <div className="mt-2 text-lg font-medium">{formatCurrency(employee.hourly_cost)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Admissão</div>
          <div className="mt-2 text-lg font-medium">{formatDate(employee.hire_date)}</div>
        </Card>
        {employee.hiring_type === "estagiario" && (
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">Bolsa estágio</div>
            <div className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(contractData?.estagio_bolsa_valor)}</div>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Dados básicos</h2>
        <form action={updateEmployee} className="space-y-4">
          <input type="hidden" name="id" value={employee.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome completo</Label>
              <Input name="full_name" required defaultValue={employee.full_name} />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={employee.email ?? ""} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input name="phone" defaultValue={employee.phone ?? ""} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input name="role" defaultValue={employee.role ?? ""} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input name="department" defaultValue={employee.department ?? ""} />
            </div>
            <div>
              <Label>Data de admissão</Label>
              <Input name="hire_date" type="date" defaultValue={employee.hire_date ?? ""} />
            </div>
            <div>
              <Label>Salário mensal (R$)</Label>
              <Input name="monthly_salary" type="number" step="0.01" min="0" defaultValue={employee.monthly_salary} />
            </div>
            <div>
              <Label>Custo/hora projeto (R$)</Label>
              <Input name="hourly_cost" type="number" step="0.01" min="0" defaultValue={employee.hourly_cost} />
            </div>
            <div>
              <Label>Estado civil</Label>
              <Input name="marital_status" defaultValue={employee.marital_status ?? ""} placeholder="Ex: Solteiro(a)" />
            </div>
            <div>
              <Label>Tipo de contratação</Label>
              <Select name="hiring_type" defaultValue={employee.hiring_type ?? ""}>
                <option value="">— não definido —</option>
                <option value="cnpj">CNPJ (PJ)</option>
                <option value="estagiario">Estagiário</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Endereço completo</Label>
            <Input name="address" defaultValue={employee.address ?? ""} placeholder="Rua, número, bairro, cidade/UF, CEP" />
          </div>
          <Button type="submit">Salvar alterações</Button>
        </form>
      </Card>

      {employee.hiring_type && (
        <Card className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-ink">Contrato ({HIRING_TYPE_LABEL[employee.hiring_type] || employee.hiring_type})</h2>
          <p className="mb-4 text-xs text-muted">
            Preencha os dados e gere o contrato a partir do modelo. Anexe documentos abaixo e use a IA para sugerir os campos.
          </p>

          <ContractAiExtract employeeId={employee.id} hiringType={employee.hiring_type} />

          <form action={upsertContractData} className="space-y-4">
            <input type="hidden" name="employee_id" value={employee.id} />
            <input type="hidden" name="hiring_type" value={employee.hiring_type} />
            {employee.hiring_type === "cnpj" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Razão social</Label>
                  <Input id={`f-${employee.id}-cnpj_razao_social`} name="cnpj_razao_social" defaultValue={contractData?.cnpj_razao_social ?? ""} />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    id={`f-${employee.id}-cnpj_numero`}
                    name="cnpj_numero"
                    defaultValue={contractData?.cnpj_numero ?? ""}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
                <div>
                  <Label>Valor mensal (R$)</Label>
                  <Input name="cnpj_valor_mensal" type="number" step="0.01" min="0" defaultValue={contractData?.cnpj_valor_mensal ?? ""} />
                </div>
                <div>
                  <Label>Dia de pagamento</Label>
                  <Input name="cnpj_dia_pagamento" type="number" min="1" max="28" defaultValue={contractData?.cnpj_dia_pagamento ?? 10} />
                </div>
                <div>
                  <Label>Início do contrato</Label>
                  <Input name="cnpj_contract_start_date" type="date" defaultValue={contractData?.cnpj_contract_start_date ?? ""} />
                </div>
                <div>
                  <Label>Prazo (meses)</Label>
                  <Input name="cnpj_prazo_meses" type="number" min="1" defaultValue={contractData?.cnpj_prazo_meses ?? 3} />
                </div>
                <div>
                  <Label>Chave PIX (empresa)</Label>
                  <Input name="cnpj_pix_key" defaultValue={contractData?.cnpj_pix_key ?? ""} />
                </div>
                <div>
                  <Label>Banco</Label>
                  <Input name="cnpj_bank_name" defaultValue={contractData?.cnpj_bank_name ?? ""} />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input name="cnpj_bank_agency" defaultValue={contractData?.cnpj_bank_agency ?? ""} />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input name="cnpj_bank_account" defaultValue={contractData?.cnpj_bank_account ?? ""} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Instituição de ensino</Label>
                  <Input id={`f-${employee.id}-estagio_instituicao`} name="estagio_instituicao" defaultValue={contractData?.estagio_instituicao ?? ""} />
                </div>
                <div>
                  <Label>Curso</Label>
                  <Input id={`f-${employee.id}-estagio_curso`} name="estagio_curso" defaultValue={contractData?.estagio_curso ?? ""} />
                </div>
                <div>
                  <Label>Início do estágio</Label>
                  <Input name="estagio_start_date" type="date" defaultValue={contractData?.estagio_start_date ?? ""} />
                </div>
                <div>
                  <Label>Fim do estágio</Label>
                  <Input name="estagio_end_date" type="date" defaultValue={contractData?.estagio_end_date ?? ""} />
                </div>
                <div>
                  <Label>Bolsa-auxílio (R$)</Label>
                  <Input name="estagio_bolsa_valor" type="number" step="0.01" min="0" defaultValue={contractData?.estagio_bolsa_valor ?? ""} />
                </div>
                <div>
                  <Label>Carga horária semanal</Label>
                  <Input name="estagio_carga_horaria_semanal" type="number" min="1" max="40" defaultValue={contractData?.estagio_carga_horaria_semanal ?? ""} />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input name="estagio_horario" defaultValue={contractData?.estagio_horario ?? ""} />
                </div>
              </div>
            )}
            <Button type="submit" variant="ghost">
              Salvar dados do contrato
            </Button>
          </form>

          <form action={generateContract} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="employee_id" value={employee.id} />
            <Button type="submit">Gerar contrato (.docx)</Button>
            {contractData?.contract_generated_at && (
              <p className="mt-2 text-xs text-muted">
                Último gerado em {formatDateTime(contractData.contract_generated_at)} — disponível em "Documentos" abaixo.
              </p>
            )}
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">Dados sensíveis</h2>
        <p className="mb-4 text-xs text-muted">Visível apenas para quem tem edição em RH.</p>
        <form action={upsertEmployeeSensitiveData} className="space-y-4">
          <input type="hidden" name="employee_id" value={employee.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>CPF</Label>
              <Input id={`f-${employee.id}-cpf`} name="cpf" defaultValue={sensitive?.cpf ?? ""} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>RG</Label>
              <Input id={`f-${employee.id}-rg`} name="rg" defaultValue={sensitive?.rg ?? ""} />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input name="pix_key" defaultValue={sensitive?.pix_key ?? ""} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input name="bank_name" defaultValue={sensitive?.bank_name ?? ""} />
            </div>
            <div>
              <Label>Agência</Label>
              <Input name="bank_agency" defaultValue={sensitive?.bank_agency ?? ""} />
            </div>
            <div>
              <Label>Conta</Label>
              <Input name="bank_account" defaultValue={sensitive?.bank_account ?? ""} />
            </div>
          </div>
          <Button type="submit">Salvar dados</Button>
        </form>
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Documentos ({docList.length})</h2>
        </div>

        <EmployeeDocumentUpload
          employeeId={employee.id}
          categoryOptions={Object.entries(DOC_CATEGORY_LABEL)}
          createEmployeeDocumentUploadUrl={createEmployeeDocumentUploadUrl}
          finalizeEmployeeDocumentUpload={finalizeEmployeeDocumentUpload}
        />

        {docList.length === 0 ? (
          <EmptyState>Nenhum documento anexado ainda.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {docList.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  {signedUrls.get(d.id) ? (
                    <a
                      href={signedUrls.get(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-ink hover:text-primary hover:underline"
                    >
                      {d.file_name}
                    </a>
                  ) : (
                    <span className="truncate font-medium text-ink">{d.file_name}</span>
                  )}
                  <div className="text-xs text-muted">
                    {DOC_CATEGORY_LABEL[d.category] || d.category} · {formatFileSize(d.file_size)} · {formatDateTime(d.created_at)}
                  </div>
                </div>
                <form action={deleteEmployeeDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="storage_path" value={d.storage_path} />
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                    Excluir
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">Histórico de cargo/salário/departamento</h2>
        {historyList.length === 0 ? (
          <EmptyState>Nenhuma alteração registrada ainda.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {historyList.map((h) => (
              <li key={h.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="font-medium text-ink">{HISTORY_FIELD_LABEL[h.field] || h.field}</div>
                <div className="text-muted">
                  {h.old_value || "—"} → {h.new_value || "—"}
                </div>
                <div className="text-xs text-muted">{formatDateTime(h.changed_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
