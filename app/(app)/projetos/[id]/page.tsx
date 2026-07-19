import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  formatDateTime,
  effectiveTransactionStatus,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_TONE,
} from "@/lib/format";
import type { Client, Employee, Project, ProjectBudgetCategory, ProjectFile, ProjectTask, ProjectTeamMember, Transaction } from "@/lib/types";
import {
  uploadProjectFile,
  deleteProjectFile,
  updateProject,
  addProjectTeamMember,
  removeProjectTeamMember,
  upsertBudgetCategory,
  deleteBudgetCategory,
  createProjectTask,
  updateProjectTaskStatus,
  updateProjectTask,
  deleteProjectTask,
} from "../actions";
import { createTransaction, markStatus } from "../../financeiro/actions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const FIN_CATEGORIES = [
  "Serviços prestados",
  "Mensalidade/retainer",
  "Folha de pagamento",
  "Infraestrutura/hosting",
  "Software/licenças",
  "Marketing",
  "Impostos",
  "Aluguel",
  "Outro",
];

const STATUS_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const CATEGORY_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  contrato: "Contrato",
  nota_fiscal: "Nota fiscal",
  proposta: "Proposta",
  outro: "Outro",
};

const TX_TYPE_LABEL: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
  aporte: "Aporte",
};

const TX_TYPE_TONE: Record<string, "good" | "bad" | "default"> = {
  receita: "good",
  despesa: "bad",
  aporte: "default",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluído",
};

const TASK_COLUMNS: { status: "todo" | "doing" | "done"; label: string }[] = [
  { status: "todo", label: "A fazer" },
  { status: "doing", label: "Em andamento" },
  { status: "done", label: "Concluído" },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "view")) redirect("/dashboard");
  const canEdit = can("projetos", "edit");
  const canEditFinanceiro = can("financeiro", "edit");
  const canViewFinanceiro = can("financeiro", "view");
  const canEditTeam = can("projetos", "edit") || can("rh", "edit");
  const canViewTeam = can("projetos", "view") || can("rh", "view") || canViewFinanceiro;

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name)")
    .eq("id", id)
    .single<Project & { clients: Pick<Client, "name"> | null }>();

  if (!project) notFound();

  const { data: clients } = await supabase.from("clients").select("*").order("name").returns<Client[]>();

  const { data: projectTransactions } = canViewFinanceiro
    ? await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", id)
        .order("due_date", { ascending: false })
        .returns<Transaction[]>()
    : { data: [] as Transaction[] };

  const txList = projectTransactions ?? [];
  const txRealizado = txList
    .filter((t) => t.status === "pago")
    .reduce((s, t) => s + Number(t.amount) * (t.type === "despesa" ? -1 : 1), 0);

  const [{ data: teamMembers }, { data: activeEmployees }, { data: budgetCategories }, { data: tasks }] = await Promise.all([
    canViewTeam
      ? supabase
          .from("project_team")
          .select("*, employees(full_name)")
          .eq("project_id", id)
          .returns<ProjectTeamMember[]>()
      : Promise.resolve({ data: [] as ProjectTeamMember[] }),
    canEditTeam || canEdit
      ? supabase.from("employees").select("id, full_name").eq("active", true).order("full_name").returns<Pick<Employee, "id" | "full_name">[]>()
      : Promise.resolve({ data: [] as Pick<Employee, "id" | "full_name">[] }),
    canViewFinanceiro
      ? supabase.from("project_budget_categories").select("*").eq("project_id", id).order("category").returns<ProjectBudgetCategory[]>()
      : Promise.resolve({ data: [] as ProjectBudgetCategory[] }),
    supabase
      .from("project_tasks")
      .select("*, employees(full_name)")
      .eq("project_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<ProjectTask[]>(),
  ]);

  const taskList = tasks ?? [];

  const team = teamMembers ?? [];
  const teamCost = team.reduce((s, m) => s + Number(m.allocated_hours) * Number(m.hourly_cost_snapshot), 0);

  const categories = budgetCategories ?? [];
  const realizadoPorCategoria = new Map<string, number>();
  txList
    .filter((t) => t.type === "despesa" && t.status === "pago")
    .forEach((t) => realizadoPorCategoria.set(t.category, (realizadoPorCategoria.get(t.category) ?? 0) + Number(t.amount)));

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .returns<ProjectFile[]>();

  const fileList = files ?? [];

  const signedUrls = await Promise.all(
    fileList.map((f) =>
      supabase.storage.from("project-files").createSignedUrl(f.storage_path, 60 * 60)
    )
  );

  return (
    <div>
      <Link href="/projetos" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← Voltar para Projetos
      </Link>

      <PageHeader
        title={project.name}
        description={project.clients?.name ? `Cliente: ${project.clients.name}` : "Sem cliente vinculado"}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={project.status === "em_andamento" ? "good" : "default"}>{STATUS_LABEL[project.status]}</Badge>
            {canEdit && (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2">
                  Editar projeto
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                  <form action={updateProject} className="space-y-3">
                    <input type="hidden" name="id" value={project.id} />
                    <div>
                      <Label>Nome do projeto</Label>
                      <Input name="name" defaultValue={project.name} required />
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Select name="client_id" defaultValue={project.client_id ?? ""}>
                        <option value="">— nenhum —</option>
                        {(clients ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue={project.status}>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Orçamento (R$)</Label>
                        <Input name="budget_total" type="number" step="0.01" min="0" defaultValue={project.budget_total} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Início</Label>
                        <Input name="start_date" type="date" defaultValue={project.start_date ?? ""} />
                      </div>
                      <div>
                        <Label>Previsão de fim</Label>
                        <Input name="end_date" type="date" defaultValue={project.end_date ?? ""} />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea name="description" rows={2} defaultValue={project.description ?? ""} />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar alterações
                    </Button>
                  </form>
                </Card>
              </details>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Orçamento do projeto</div>
          <div className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(project.budget_total)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Início</div>
          <div className="mt-2 text-lg font-medium">{formatDate(project.start_date)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Previsão de fim</div>
          <div className="mt-2 text-lg font-medium">{formatDate(project.end_date)}</div>
        </Card>
      </div>

      {project.description && (
        <Card className="mb-6">
          <div className="text-xs uppercase tracking-wide text-muted">Descrição</div>
          <p className="mt-2 text-sm text-ink">{project.description}</p>
        </Card>
      )}

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Tarefas ({taskList.length})</h2>
            <p className="mt-1 text-xs text-muted">Quebre o projeto em etapas e acompanhe o andamento.</p>
          </div>
          {canEdit && (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Tarefa
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[340px]">
                <form action={createProjectTask} className="space-y-3">
                  <input type="hidden" name="project_id" value={project.id} />
                  <div>
                    <Label>Título</Label>
                    <Input name="title" required placeholder="Ex: Configurar ambiente" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select name="status" defaultValue="todo">
                      {TASK_COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Responsável (opcional)</Label>
                    <Select name="assigned_to" defaultValue="">
                      <option value="">— nenhum —</option>
                      {(activeEmployees ?? []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Prazo</Label>
                    <Input name="due_date" type="date" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea name="description" rows={2} />
                  </div>
                  <Button type="submit" className="w-full">
                    Salvar tarefa
                  </Button>
                </form>
              </Card>
            </details>
          )}
        </div>

        {taskList.length === 0 ? (
          <EmptyState>Nenhuma tarefa cadastrada ainda.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TASK_COLUMNS.map((col) => {
              const colTasks = taskList.filter((t) => t.status === col.status);
              return (
                <div key={col.status} className="rounded-xl border border-border bg-surface2/40 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.label}</h3>
                    <Badge>{colTasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div key={t.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                        <div className="font-medium text-ink">{t.title}</div>
                        {t.description && <p className="mt-1 text-xs text-muted">{t.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          {t.employees?.full_name && <span>{t.employees.full_name}</span>}
                          {t.due_date && <span>· {formatDate(t.due_date)}</span>}
                        </div>
                        {canEdit && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <form action={updateProjectTaskStatus} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="project_id" value={project.id} />
                              <Select name="status" defaultValue={t.status} className="!w-auto text-xs">
                                {TASK_COLUMNS.map((c) => (
                                  <option key={c.status} value={c.status}>
                                    {c.label}
                                  </option>
                                ))}
                              </Select>
                              <Button variant="ghost" type="submit" className="px-2 py-1 text-xs">
                                Mover
                              </Button>
                            </form>
                            <details className="relative">
                              <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                                Editar
                              </summary>
                              <Card className="absolute right-0 z-10 mt-2 w-[320px]">
                                <form action={updateProjectTask} className="space-y-3">
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="project_id" value={project.id} />
                                  <div>
                                    <Label>Título</Label>
                                    <Input name="title" required defaultValue={t.title} />
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Select name="status" defaultValue={t.status}>
                                      {TASK_COLUMNS.map((c) => (
                                        <option key={c.status} value={c.status}>
                                          {c.label}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Responsável</Label>
                                    <Select name="assigned_to" defaultValue={t.assigned_to ?? ""}>
                                      <option value="">— nenhum —</option>
                                      {(activeEmployees ?? []).map((e) => (
                                        <option key={e.id} value={e.id}>
                                          {e.full_name}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Prazo</Label>
                                    <Input name="due_date" type="date" defaultValue={t.due_date ?? ""} />
                                  </div>
                                  <div>
                                    <Label>Descrição</Label>
                                    <Textarea name="description" rows={2} defaultValue={t.description ?? ""} />
                                  </div>
                                  <Button type="submit" className="w-full">
                                    Salvar alterações
                                  </Button>
                                </form>
                              </Card>
                            </details>
                            <form action={deleteProjectTask}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="project_id" value={project.id} />
                              <Button variant="danger" type="submit" className="px-2 py-1 text-xs">
                                Excluir
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {canViewFinanceiro && (
        <Card className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Financeiro do projeto ({txList.length})</h2>
              <p className="mt-1 text-xs text-muted">
                O orçamento acima é só planejamento. Para contar no saldo de Financeiro, lance-o aqui.
              </p>
            </div>
            {canEditFinanceiro && (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                  + Lançamento financeiro
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                  <form action={createTransaction} className="space-y-3">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Tipo</Label>
                        <Select name="type" defaultValue="receita">
                          <option value="receita">Receita</option>
                          <option value="despesa">Despesa</option>
                          <option value="aporte">Aporte de sócio</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue="pendente">
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select name="category" defaultValue="Serviços prestados">
                        {FIN_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input name="amount" type="number" step="0.01" min="0" required defaultValue={project.budget_total} />
                    </div>
                    <div>
                      <Label>Vencimento</Label>
                      <Input name="due_date" type="date" defaultValue={project.end_date ?? ""} />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea name="description" rows={2} defaultValue={`Referente ao projeto ${project.name}`} />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar lançamento
                    </Button>
                  </form>
                </Card>
              </details>
            )}
          </div>

          {txList.length === 0 ? (
            <EmptyState>Nenhum lançamento financeiro vinculado a este projeto ainda.</EmptyState>
          ) : (
            <>
              <div className="mb-3 text-sm">
                <span className="text-muted">Saldo realizado do projeto: </span>
                <span className={`font-semibold ${txRealizado >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(txRealizado)}</span>
              </div>
              <ul className="space-y-2">
                {txList.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{t.category}</div>
                      <div className="text-xs text-muted">{formatDate(t.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={TX_TYPE_TONE[t.type] ?? "default"}>{TX_TYPE_LABEL[t.type] ?? t.type}</Badge>
                      <span className={`font-medium ${t.type === "despesa" ? "text-danger" : "text-primary"}`}>{formatCurrency(t.amount)}</span>
                      {(() => {
                        const eff = effectiveTransactionStatus(t.status as "pendente" | "pago", t.due_date);
                        return <Badge tone={TRANSACTION_STATUS_TONE[eff]}>{TRANSACTION_STATUS_LABEL[eff]}</Badge>;
                      })()}
                      {canEditFinanceiro && t.status === "pendente" && (
                        <form action={markStatus}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value="pago" />
                          <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                            Confirmar
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {canViewTeam && (
        <Card className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Equipe alocada ({team.length})</h2>
              <p className="mt-1 text-xs text-muted">Horas planejadas por colaborador e custo estimado da equipe neste projeto.</p>
            </div>
            {canEditTeam && (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                  + Alocar colaborador
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[320px]">
                  <form action={addProjectTeamMember} className="space-y-3">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div>
                      <Label>Colaborador</Label>
                      <Select name="employee_id" required>
                        {(activeEmployees ?? []).map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Horas alocadas</Label>
                      <Input name="allocated_hours" type="number" step="0.5" min="0" required placeholder="0" />
                    </div>
                    <p className="text-xs text-muted">O custo/hora é puxado automaticamente do cadastro do colaborador.</p>
                    <Button type="submit" className="w-full">
                      Salvar
                    </Button>
                  </form>
                </Card>
              </details>
            )}
          </div>

          {team.length === 0 ? (
            <EmptyState>Nenhum colaborador alocado a este projeto ainda.</EmptyState>
          ) : (
            <>
              <div className="mb-3 text-sm">
                <span className="text-muted">Custo estimado da equipe: </span>
                <span className="font-semibold text-danger">{formatCurrency(teamCost)}</span>
              </div>
              <ul className="space-y-2">
                {team.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{m.employees?.full_name || "—"}</div>
                      <div className="text-xs text-muted">
                        {m.allocated_hours}h · {formatCurrency(m.hourly_cost_snapshot)}/h
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-danger">{formatCurrency(Number(m.allocated_hours) * Number(m.hourly_cost_snapshot))}</span>
                      {canEditTeam && (
                        <form action={removeProjectTeamMember}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="project_id" value={project.id} />
                          <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                            Remover
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {canViewFinanceiro && (
        <Card className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Orçamento por categoria ({categories.length})</h2>
              <p className="mt-1 text-xs text-muted">Compare o planejado por categoria com o que já foi realizado em Financeiro.</p>
            </div>
            {canEditFinanceiro && (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2">
                  + Categoria
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[320px]">
                  <form action={upsertBudgetCategory} className="space-y-3">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div>
                      <Label>Categoria</Label>
                      <Select name="category" defaultValue="Outro">
                        {FIN_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Valor orçado (R$)</Label>
                      <Input name="budgeted_amount" type="number" step="0.01" min="0" required placeholder="0,00" />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar
                    </Button>
                  </form>
                </Card>
              </details>
            )}
          </div>

          {categories.length === 0 ? (
            <EmptyState>Nenhuma categoria de orçamento cadastrada ainda.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {categories.map((c) => {
                const realizado = realizadoPorCategoria.get(c.category) ?? 0;
                const estourou = realizado > Number(c.budgeted_amount);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{c.category}</div>
                      <div className="text-xs text-muted">
                        Orçado: {formatCurrency(c.budgeted_amount)} · Realizado: <span className={estourou ? "text-danger" : ""}>{formatCurrency(realizado)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={estourou ? "bad" : "good"}>{estourou ? "acima do orçado" : "dentro do orçado"}</Badge>
                      {canEditFinanceiro && (
                        <form action={deleteBudgetCategory}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="project_id" value={project.id} />
                          <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                            Excluir
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Anexos ({fileList.length})</h2>
          {canEdit && (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Anexar arquivo
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[340px]">
                <form action={uploadProjectFile} className="space-y-3" encType="multipart/form-data">
                  <input type="hidden" name="project_id" value={project.id} />
                  <div>
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue="orcamento">
                      {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Arquivo</Label>
                    <Input name="file" type="file" required />
                    <p className="mt-1 text-xs text-muted">Máx. 20MB.</p>
                  </div>
                  <Button type="submit" className="w-full">
                    Enviar
                  </Button>
                </form>
              </Card>
            </details>
          )}
        </div>

        {fileList.length === 0 ? (
          <EmptyState>Nenhum arquivo anexado ainda. Envie orçamentos, contratos ou notas fiscais.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {fileList.map((f, i) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  {signedUrls[i]?.data?.signedUrl ? (
                    <a
                      href={signedUrls[i]!.data!.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-ink hover:text-primary hover:underline"
                    >
                      {f.file_name}
                    </a>
                  ) : (
                    <span className="truncate font-medium text-ink">{f.file_name}</span>
                  )}
                  <div className="text-xs text-muted">
                    {formatFileSize(f.file_size)} · {formatDateTime(f.created_at)}
                  </div>
                </div>
                <Badge>{CATEGORY_LABEL[f.category] || f.category}</Badge>
                {canEdit && (
                  <form action={deleteProjectFile}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="storage_path" value={f.storage_path} />
                    <Button variant="danger" type="submit" className="px-2 py-1 text-xs">
                      Excluir
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
