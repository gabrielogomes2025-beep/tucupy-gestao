import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import type { Employee, EmployeeDocument, EmployeeHistoryEntry, EmployeeSensitiveData } from "@/lib/types";
import {
  createEmployee,
  updateEmployee,
  terminateEmployee,
  reactivateEmployee,
  upsertEmployeeSensitiveData,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from "./actions";
import { redirect } from "next/navigation";

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
  outro: "Outro",
};

export default async function RhPage() {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name")
    .returns<Employee[]>();

  const list = employees ?? [];

  const { data: history } = list.length
    ? await supabase
        .from("employee_history")
        .select("*")
        .in(
          "employee_id",
          list.map((e) => e.id)
        )
        .order("changed_at", { ascending: false })
        .returns<EmployeeHistoryEntry[]>()
    : { data: [] as EmployeeHistoryEntry[] };

  const historyByEmployee = new Map<string, EmployeeHistoryEntry[]>();
  for (const h of history ?? []) {
    historyByEmployee.set(h.employee_id, [...(historyByEmployee.get(h.employee_id) ?? []), h]);
  }

  const [{ data: sensitiveData }, { data: documents }] = canEdit
    ? await Promise.all([
        list.length
          ? supabase.from("employee_sensitive_data").select("*").in("employee_id", list.map((e) => e.id)).returns<EmployeeSensitiveData[]>()
          : Promise.resolve({ data: [] as EmployeeSensitiveData[] }),
        list.length
          ? supabase
              .from("employee_documents")
              .select("*")
              .in("employee_id", list.map((e) => e.id))
              .order("created_at", { ascending: false })
              .returns<EmployeeDocument[]>()
          : Promise.resolve({ data: [] as EmployeeDocument[] }),
      ])
    : [{ data: [] as EmployeeSensitiveData[] }, { data: [] as EmployeeDocument[] }];

  const sensitiveByEmployee = new Map<string, EmployeeSensitiveData>();
  for (const s of sensitiveData ?? []) sensitiveByEmployee.set(s.employee_id, s);

  const documentsByEmployee = new Map<string, EmployeeDocument[]>();
  for (const d of documents ?? []) {
    documentsByEmployee.set(d.employee_id, [...(documentsByEmployee.get(d.employee_id) ?? []), d]);
  }

  const signedDocUrls = new Map<string, string>();
  if (canEdit) {
    for (const d of documents ?? []) {
      const { data: signed } = await supabase.storage.from("employee-documents").createSignedUrl(d.storage_path, 60 * 60);
      if (signed?.signedUrl) signedDocUrls.set(d.id, signed.signedUrl);
    }
  }

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description={`${list.filter((e) => e.active).length} ativos · ${list.length} no total`}
        action={
          canEdit ? (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Novo colaborador
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                <form action={createEmployee} className="space-y-3">
                  <div>
                    <Label>Nome completo</Label>
                    <Input name="full_name" required placeholder="Nome do colaborador" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input name="email" type="email" placeholder="email@tucupy.com" />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input name="phone" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cargo</Label>
                      <Input name="role" placeholder="Ex: Dev Full-stack" />
                    </div>
                    <div>
                      <Label>Departamento</Label>
                      <Input name="department" placeholder="Ex: Engenharia" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Salário mensal (R$)</Label>
                      <Input name="monthly_salary" type="number" step="0.01" min="0" placeholder="0,00" />
                    </div>
                    <div>
                      <Label>Custo/hora projeto (R$)</Label>
                      <Input name="hourly_cost" type="number" step="0.01" min="0" placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <Label>Data de admissão</Label>
                    <Input name="hire_date" type="date" />
                  </div>
                  <Button type="submit" className="w-full">
                    Salvar colaborador
                  </Button>
                </form>
              </Card>
            </details>
          ) : null
        }
      />

      <Card>
        {list.length === 0 ? (
          <EmptyState>Nenhum colaborador cadastrado ainda.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Depto</th>
                  <th className="py-2 pr-3">Admissão</th>
                  <th className="py-2 pr-3 text-right">Salário</th>
                  <th className="py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{e.full_name}</div>
                      <div className="text-xs text-muted">{e.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-muted">{e.role || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{e.department || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{formatDate(e.hire_date)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(e.monthly_salary)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={e.active ? "good" : "bad"}>{e.active ? "ativo" : "inativo"}</Badge>
                      {!e.active && e.termination_date && (
                        <div className="mt-1 text-xs text-muted">
                          {formatDate(e.termination_date)}
                          {e.termination_reason ? ` · ${TERMINATION_REASON_LABEL[e.termination_reason] || e.termination_reason}` : ""}
                        </div>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          <details className="relative">
                            <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                              Editar
                            </summary>
                            <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                              <form action={updateEmployee} className="space-y-3">
                                <input type="hidden" name="id" value={e.id} />
                                <div>
                                  <Label>Nome completo</Label>
                                  <Input name="full_name" required defaultValue={e.full_name} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Email</Label>
                                    <Input name="email" type="email" defaultValue={e.email ?? ""} />
                                  </div>
                                  <div>
                                    <Label>Telefone</Label>
                                    <Input name="phone" defaultValue={e.phone ?? ""} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Cargo</Label>
                                    <Input name="role" defaultValue={e.role ?? ""} />
                                  </div>
                                  <div>
                                    <Label>Departamento</Label>
                                    <Input name="department" defaultValue={e.department ?? ""} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Salário mensal (R$)</Label>
                                    <Input name="monthly_salary" type="number" step="0.01" min="0" defaultValue={e.monthly_salary} />
                                  </div>
                                  <div>
                                    <Label>Custo/hora projeto (R$)</Label>
                                    <Input name="hourly_cost" type="number" step="0.01" min="0" defaultValue={e.hourly_cost} />
                                  </div>
                                </div>
                                <div>
                                  <Label>Data de admissão</Label>
                                  <Input name="hire_date" type="date" defaultValue={e.hire_date ?? ""} />
                                </div>
                                <Button type="submit" className="w-full">
                                  Salvar alterações
                                </Button>
                              </form>
                            </Card>
                          </details>
                          <details className="relative">
                            <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                              Histórico ({(historyByEmployee.get(e.id) ?? []).length})
                            </summary>
                            <Card className="absolute right-0 z-10 mt-2 w-[320px]">
                              {(historyByEmployee.get(e.id) ?? []).length === 0 ? (
                                <p className="text-xs text-muted">Nenhuma alteração de cargo/salário/depto registrada ainda.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {(historyByEmployee.get(e.id) ?? []).map((h) => (
                                    <li key={h.id} className="text-xs">
                                      <div className="font-medium text-ink">{HISTORY_FIELD_LABEL[h.field] || h.field}</div>
                                      <div className="text-muted">
                                        {h.old_value || "—"} → {h.new_value || "—"}
                                      </div>
                                      <div className="text-muted">{formatDateTime(h.changed_at)}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </Card>
                          </details>
                          <details className="relative">
                            <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                              Dados sensíveis
                            </summary>
                            <Card className="absolute right-0 z-10 mt-2 w-[340px]">
                              <p className="mb-3 text-xs text-muted">Visível apenas para quem tem edição em RH.</p>
                              <form action={upsertEmployeeSensitiveData} className="space-y-3">
                                <input type="hidden" name="employee_id" value={e.id} />
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>CPF</Label>
                                    <Input name="cpf" defaultValue={sensitiveByEmployee.get(e.id)?.cpf ?? ""} placeholder="000.000.000-00" />
                                  </div>
                                  <div>
                                    <Label>RG</Label>
                                    <Input name="rg" defaultValue={sensitiveByEmployee.get(e.id)?.rg ?? ""} />
                                  </div>
                                </div>
                                <div>
                                  <Label>Chave PIX</Label>
                                  <Input name="pix_key" defaultValue={sensitiveByEmployee.get(e.id)?.pix_key ?? ""} />
                                </div>
                                <div>
                                  <Label>Banco</Label>
                                  <Input name="bank_name" defaultValue={sensitiveByEmployee.get(e.id)?.bank_name ?? ""} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Agência</Label>
                                    <Input name="bank_agency" defaultValue={sensitiveByEmployee.get(e.id)?.bank_agency ?? ""} />
                                  </div>
                                  <div>
                                    <Label>Conta</Label>
                                    <Input name="bank_account" defaultValue={sensitiveByEmployee.get(e.id)?.bank_account ?? ""} />
                                  </div>
                                </div>
                                <Button type="submit" className="w-full">
                                  Salvar dados
                                </Button>
                              </form>

                              <div className="mt-4 border-t border-border pt-3">
                                <div className="mb-2 text-xs font-semibold text-ink">
                                  Documentos ({(documentsByEmployee.get(e.id) ?? []).length})
                                </div>
                                <form action={uploadEmployeeDocument} className="space-y-2" encType="multipart/form-data">
                                  <input type="hidden" name="employee_id" value={e.id} />
                                  <Select name="category" defaultValue="contrato">
                                    {Object.entries(DOC_CATEGORY_LABEL).map(([v, l]) => (
                                      <option key={v} value={v}>
                                        {l}
                                      </option>
                                    ))}
                                  </Select>
                                  <Input name="file" type="file" required />
                                  <Button type="submit" variant="ghost" className="w-full text-xs">
                                    Enviar documento
                                  </Button>
                                </form>
                                {(documentsByEmployee.get(e.id) ?? []).length > 0 && (
                                  <ul className="mt-3 space-y-2">
                                    {(documentsByEmployee.get(e.id) ?? []).map((d) => (
                                      <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="min-w-0">
                                          {signedDocUrls.get(d.id) ? (
                                            <a
                                              href={signedDocUrls.get(d.id)}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="truncate text-ink hover:text-primary hover:underline"
                                            >
                                              {d.file_name}
                                            </a>
                                          ) : (
                                            <span className="truncate text-ink">{d.file_name}</span>
                                          )}
                                          <div className="text-muted">
                                            {DOC_CATEGORY_LABEL[d.category] || d.category} · {formatFileSize(d.file_size)}
                                          </div>
                                        </div>
                                        <form action={deleteEmployeeDocument}>
                                          <input type="hidden" name="id" value={d.id} />
                                          <input type="hidden" name="storage_path" value={d.storage_path} />
                                          <Button variant="danger" className="px-1.5 py-0.5 text-[10px]" type="submit">
                                            Excluir
                                          </Button>
                                        </form>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </Card>
                          </details>
                          {e.active ? (
                            <details className="relative">
                              <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/20">
                                Desligar
                              </summary>
                              <Card className="absolute right-0 z-10 mt-2 w-[300px]">
                                <form action={terminateEmployee} className="space-y-3">
                                  <input type="hidden" name="id" value={e.id} />
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
                              <input type="hidden" name="id" value={e.id} />
                              <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                                Reativar
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
