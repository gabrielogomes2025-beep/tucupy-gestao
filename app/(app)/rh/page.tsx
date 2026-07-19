import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, addMonthsIso, daysUntil } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { createEmployee, terminateEmployee, reactivateEmployee } from "./actions";
import { HiringTypeFields } from "@/components/HiringTypeFields";
import { redirect } from "next/navigation";
import Link from "next/link";

const PAGE_SIZE = 20;

const TERMINATION_REASON_LABEL: Record<string, string> = {
  pedido_demissao: "Pedido de demissão",
  demissao_sem_justa_causa: "Demissão sem justa causa",
  demissao_justa_causa: "Demissão com justa causa",
  termino_contrato: "Término de contrato",
  outro: "Outro",
};

const HIRING_TYPE_LABEL: Record<string, string> = {
  cnpj: "CNPJ (PJ)",
  estagiario: "Estagiário",
};

type ContractDates = {
  employee_id: string;
  cnpj_contract_start_date: string | null;
  cnpj_prazo_meses: number | null;
  estagio_end_date: string | null;
};

function getContractEnd(e: Employee, c?: ContractDates): string | null {
  if (!c) return null;
  if (e.hiring_type === "cnpj") {
    if (c.cnpj_contract_start_date && c.cnpj_prazo_meses) {
      return addMonthsIso(c.cnpj_contract_start_date, c.cnpj_prazo_meses);
    }
    return null;
  }
  if (e.hiring_type === "estagiario") {
    return c.estagio_end_date || null;
  }
  return null;
}

function ContractExpiryCell({ e, c }: { e: Employee; c?: ContractDates }) {
  const end = getContractEnd(e, c);
  if (!end) return <span className="text-muted">—</span>;
  const days = daysUntil(end);
  const tone = days < 0 ? "bad" : days <= 30 ? "warn" : "good";
  const label = days < 0 ? `venceu há ${Math.abs(days)}d` : days === 0 ? "vence hoje" : `${days}d`;
  return (
    <div>
      <div className="text-muted">{formatDate(end)}</div>
      <Badge tone={tone}>{label}</Badge>
    </div>
  );
}

export default async function RhPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");

  const params = await searchParams;
  const q = (params.q || "").trim();
  const statusFiltro = params.status || "";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  function buildQuery(overrides: Record<string, string | number | undefined>) {
    const merged: Record<string, string | number | undefined> = { q, status: statusFiltro, page, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `/rh?${qs}` : "/rh";
  }

  let empQuery = supabase
    .from("employees")
    .select("*", { count: "exact" })
    .order("active", { ascending: false })
    .order("full_name");
  if (q) empQuery = empQuery.or(`full_name.ilike.%${q}%,role.ilike.%${q}%,department.ilike.%${q}%`);
  if (statusFiltro === "ativo") empQuery = empQuery.eq("active", true);
  if (statusFiltro === "inativo") empQuery = empQuery.eq("active", false);
  empQuery = empQuery.range(from, to);

  const [{ data: employees, count: empCount }, { data: allStats }] = await Promise.all([
    empQuery.returns<Employee[]>(),
    supabase.from("employees").select("active"),
  ]);

  const list = employees ?? [];
  const totalCount = empCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const ativosTotal = (allStats ?? []).filter((e: any) => e.active).length;
  const totalGeral = (allStats ?? []).length;

  const employeeIds = list.map((e) => e.id);
  const { data: contracts } = employeeIds.length
    ? await supabase
        .from("employee_contract_data")
        .select("employee_id, cnpj_contract_start_date, cnpj_prazo_meses, estagio_end_date")
        .in("employee_id", employeeIds)
        .returns<ContractDates[]>()
    : { data: [] as ContractDates[] };
  const contractMap = new Map<string, ContractDates>();
  (contracts ?? []).forEach((c) => contractMap.set(c.employee_id, c));

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description={`${ativosTotal} ativos · ${totalGeral} no total`}
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
                  <div>
                    <Label>Endereço completo</Label>
                    <Input name="address" placeholder="Rua, número, bairro, cidade/UF, CEP" />
                  </div>
                  <div>
                    <Label>Estado civil</Label>
                    <Input name="marital_status" placeholder="Ex: Solteiro(a)" />
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-xs text-muted">Dados de contratação (usados para gerar o contrato)</p>
                    <HiringTypeFields />
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
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <Label>Buscar</Label>
            <Input name="q" defaultValue={q} placeholder="nome, cargo ou departamento" />
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={statusFiltro} className="!w-auto">
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </div>
          <Button variant="ghost" type="submit">
            Filtrar
          </Button>
        </form>

        {list.length === 0 ? (
          <EmptyState>Nenhum colaborador encontrado para esse filtro.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Depto</th>
                  <th className="py-2 pr-3">Admissão</th>
                  <th className="py-2 pr-3">Vencimento contrato</th>
                  <th className="py-2 pr-3 text-right">Salário</th>
                  <th className="py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      {canEdit ? (
                        <Link href={`/rh/${e.id}`} className="font-medium text-ink hover:text-primary hover:underline">
                          {e.full_name}
                        </Link>
                      ) : (
                        <div className="font-medium">{e.full_name}</div>
                      )}
                      <div className="text-xs text-muted">{e.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {e.hiring_type ? <Badge>{HIRING_TYPE_LABEL[e.hiring_type] || e.hiring_type}</Badge> : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted">{e.role || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{e.department || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{formatDate(e.hire_date)}</td>
                    <td className="py-2 pr-3">
                      <ContractExpiryCell e={e} c={contractMap.get(e.id)} />
                    </td>
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
                          <Link
                            href={`/rh/${e.id}`}
                            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1 text-xs font-medium text-[#0f0f0f] hover:bg-primary-dark"
                          >
                            Abrir perfil
                          </Link>
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

        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              Página {page} de {totalPages} · {totalCount} colaboradores
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildQuery({ page: page - 1 })}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildQuery({ page: page + 1 })}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
