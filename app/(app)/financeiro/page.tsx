import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState, Kpi } from "@/components/ui";
import { formatCurrency, formatDate, formatFileSize } from "@/lib/format";
import type { Project, RecurringTransaction, Transaction, TransactionFile } from "@/lib/types";
import {
  createTransaction,
  updateTransaction,
  markStatus,
  deleteTransaction,
  uploadTransactionFile,
  deleteTransactionFile,
  createRecurringTransaction,
  toggleRecurringTransaction,
  deleteRecurringTransaction,
} from "./actions";
import { redirect } from "next/navigation";
import Link from "next/link";

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

const CATEGORIES = [
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

const PAGE_SIZE = 20;

function bucketizeDueDate(dueDate: string, startOfToday: Date): "30" | "60" | "90" | "later" {
  const d = new Date(dueDate + "T00:00:00");
  const diffDays = Math.ceil((d.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays <= 30) return "30";
  if (diffDays <= 60) return "60";
  if (diffDays <= 90) return "90";
  return "later";
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; status?: string; page?: string }>;
}) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "view")) redirect("/dashboard");
  const canEdit = can("financeiro", "edit");

  await supabase.rpc("generate_due_recurring_transactions");

  const params = await searchParams;
  const q = (params.q || "").trim();
  const tipoFiltro = params.tipo || "";
  const statusFiltro = params.status || "";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  function buildQuery(overrides: Record<string, string | number | undefined>) {
    const merged: Record<string, string | number | undefined> = { q, tipo: tipoFiltro, status: statusFiltro, page, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `/financeiro?${qs}` : "/financeiro";
  }

  let txQuery = supabase
    .from("transactions")
    .select("*, projects(name)", { count: "exact" })
    .order("due_date", { ascending: false });
  if (q) txQuery = txQuery.or(`category.ilike.%${q}%,description.ilike.%${q}%`);
  if (tipoFiltro) txQuery = txQuery.eq("type", tipoFiltro);
  if (statusFiltro) txQuery = txQuery.eq("status", statusFiltro);
  txQuery = txQuery.range(from, to);

  const [{ data: transactions, count: txCount }, { data: projects }, { data: allTimeAmounts }, { data: recurring }, { data: previstoAll }] =
    await Promise.all([
      txQuery.returns<Transaction[]>(),
      supabase.from("projects").select("id, name").order("name").returns<Pick<Project, "id" | "name">[]>(),
      supabase.from("transactions").select("type, status, amount"),
      supabase
        .from("recurring_transactions")
        .select("*, projects(name)")
        .order("created_at", { ascending: false })
        .returns<RecurringTransaction[]>(),
      supabase
        .from("transactions")
        .select("*, projects(name)")
        .eq("status", "previsto")
        .order("due_date", { ascending: true })
        .returns<Transaction[]>(),
    ]);

  const list = transactions ?? [];
  const totalCount = txCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const recurringList = recurring ?? [];
  const previstoList = previstoAll ?? [];

  const saldoAcumulado = (allTimeAmounts ?? []).reduce((s, t: any) => {
    if (t.status !== "realizado") return s;
    return s + Number(t.amount) * (t.type === "despesa" ? -1 : 1);
  }, 0);

  const { data: txFiles } = list.length
    ? await supabase
        .from("transaction_files")
        .select("*")
        .in(
          "transaction_id",
          list.map((t) => t.id)
        )
        .order("created_at", { ascending: false })
        .returns<TransactionFile[]>()
    : { data: [] as TransactionFile[] };

  const filesByTx = new Map<string, (TransactionFile & { signedUrl: string | null })[]>();
  for (const f of txFiles ?? []) {
    const { data: signed } = await supabase.storage.from("transaction-files").createSignedUrl(f.storage_path, 60 * 60);
    const entry = { ...f, signedUrl: signed?.signedUrl ?? null };
    filesByTx.set(f.transaction_id, [...(filesByTx.get(f.transaction_id) ?? []), entry]);
  }

  const receitas = (allTimeAmounts ?? []).filter((t: any) => t.type === "receita" && t.status === "realizado").reduce((s, t: any) => s + Number(t.amount), 0);
  const despesas = (allTimeAmounts ?? []).filter((t: any) => t.type === "despesa" && t.status === "realizado").reduce((s, t: any) => s + Number(t.amount), 0);

  const byDueDateAsc = (a: Transaction, b: Transaction) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99");
  const pagamentosAgendados = previstoList.filter((t) => t.type === "despesa").sort(byDueDateAsc);
  const recebimentosAgendados = previstoList.filter((t) => t.type === "receita").sort(byDueDateAsc);
  const totalPagamentosAgendados = pagamentosAgendados.reduce((s, t) => s + Number(t.amount), 0);
  const totalRecebimentosAgendados = recebimentosAgendados.reduce((s, t) => s + Number(t.amount), 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const buckets = {
    "30": { receita: 0, despesa: 0 },
    "60": { receita: 0, despesa: 0 },
    "90": { receita: 0, despesa: 0 },
  };
  for (const t of previstoList) {
    if (!t.due_date) continue;
    const b = bucketizeDueDate(t.due_date, startOfToday);
    if (b === "later") continue;
    buckets[b][t.type] += Number(t.amount);
  }
  const PROJECTION_ROWS: { key: "30" | "60" | "90"; label: string }[] = [
    { key: "30", label: "Até 30 dias" },
    { key: "60", label: "31–60 dias" },
    { key: "90", label: "61–90 dias" },
  ];
  const saldoProjetado90 =
    saldoAcumulado +
    PROJECTION_ROWS.reduce((s, r) => s + (buckets[r.key].receita - buckets[r.key].despesa), 0);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Contas a pagar/receber e fluxo de caixa"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/financeiro/relatorio"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2"
            >
              Relatório
            </Link>
            <a
              href="/financeiro/export"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2"
            >
              Exportar CSV
            </a>
            {canEdit && (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Novo lançamento
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                <form action={createTransaction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo</Label>
                      <Select name="type" defaultValue="despesa">
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select name="status" defaultValue="previsto">
                        <option value="previsto">Previsto</option>
                        <option value="realizado">Realizado</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue="Outro">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" />
                  </div>
                  <div>
                    <Label>Projeto (opcional)</Label>
                    <Select name="project_id" defaultValue="">
                      <option value="">— nenhum —</option>
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Vencimento</Label>
                    <Input name="due_date" type="date" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea name="description" rows={2} placeholder="Detalhes do lançamento" />
                  </div>
                  <Button type="submit" className="w-full">
                    Salvar lançamento
                  </Button>
                </form>
              </Card>
            </details>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receitas realizadas" value={formatCurrency(receitas)} tone="good" />
        <Kpi label="Despesas realizadas" value={formatCurrency(despesas)} tone="bad" />
        <Kpi label="Saldo (últimos lançamentos)" value={formatCurrency(receitas - despesas)} tone={receitas - despesas >= 0 ? "good" : "bad"} />
        <Kpi label="Saldo de caixa acumulado" value={formatCurrency(saldoAcumulado)} tone={saldoAcumulado >= 0 ? "good" : "bad"} />
      </div>

      <p className="mb-6 text-xs text-muted">
        Os valores acima somam apenas lançamentos cadastrados aqui em Financeiro. Orçamento de projeto é só uma
        referência de planejamento — para ele contar no saldo, lance-o como um lançamento (você pode fazer isso
        direto na página do projeto).
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Pagamentos agendados (a pagar)</h2>
            <span className="text-sm font-semibold text-danger">{formatCurrency(totalPagamentosAgendados)}</span>
          </div>
          {pagamentosAgendados.length === 0 ? (
            <EmptyState>Nenhum pagamento agendado.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {pagamentosAgendados.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{t.category}</div>
                    <div className="text-xs text-muted">
                      {formatDate(t.due_date)} {t.projects?.name ? `· ${t.projects.name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-danger">{formatCurrency(t.amount)}</span>
                    {canEdit && (
                      <form action={markStatus}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="realizado" />
                        <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                          Marcar pago
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recebimentos agendados (a receber)</h2>
            <span className="text-sm font-semibold text-success">{formatCurrency(totalRecebimentosAgendados)}</span>
          </div>
          {recebimentosAgendados.length === 0 ? (
            <EmptyState>Nenhum recebimento agendado.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {recebimentosAgendados.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{t.category}</div>
                    <div className="text-xs text-muted">
                      {formatDate(t.due_date)} {t.projects?.name ? `· ${t.projects.name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-success">{formatCurrency(t.amount)}</span>
                    {canEdit && (
                      <form action={markStatus}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="realizado" />
                        <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                          Marcar recebido
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">Projeção de fluxo de caixa</h2>
        <p className="mb-3 text-xs text-muted">Com base nos lançamentos previstos (inclui os já vencidos no primeiro período).</p>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="py-2 pr-3">Período</th>
                <th className="py-2 pr-3 text-right">Receitas previstas</th>
                <th className="py-2 pr-3 text-right">Despesas previstas</th>
                <th className="py-2 pr-3 text-right">Saldo do período</th>
              </tr>
            </thead>
            <tbody>
              {PROJECTION_ROWS.map((r) => {
                const b = buckets[r.key];
                const saldo = b.receita - b.despesa;
                return (
                  <tr key={r.key} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{r.label}</td>
                    <td className="py-2 pr-3 text-right text-success">{formatCurrency(b.receita)}</td>
                    <td className="py-2 pr-3 text-right text-danger">{formatCurrency(b.despesa)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${saldo >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-sm">
          <span className="text-muted">Saldo projetado em 90 dias (caixa atual + previstos): </span>
          <span className={`font-semibold ${saldoProjetado90 >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(saldoProjetado90)}</span>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Lançamentos recorrentes ({recurringList.length})</h2>
            <p className="mt-1 text-xs text-muted">
              Gerados automaticamente todo mês, no dia definido, quando alguém abre esta página.
            </p>
          </div>
          {canEdit && (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2">
                + Recorrente
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[360px]">
                <form action={createRecurringTransaction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo</Label>
                      <Select name="type" defaultValue="despesa">
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Dia do mês</Label>
                      <Select name="day_of_month" defaultValue="5">
                        {DAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue="Outro">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" />
                  </div>
                  <div>
                    <Label>Projeto (opcional)</Label>
                    <Select name="project_id" defaultValue="">
                      <option value="">— nenhum —</option>
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea name="description" rows={2} placeholder="Ex: Aluguel do escritório" />
                  </div>
                  <Button type="submit" className="w-full">
                    Salvar recorrente
                  </Button>
                </form>
              </Card>
            </details>
          )}
        </div>

        {recurringList.length === 0 ? (
          <EmptyState>Nenhum lançamento recorrente cadastrado.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {recurringList.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {r.category} {r.projects?.name ? `· ${r.projects.name}` : ""}
                  </div>
                  <div className="text-xs text-muted">
                    Todo dia {r.day_of_month} {r.description ? `· ${r.description}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.type === "receita" ? "good" : "bad"}>{r.type}</Badge>
                  <span className={`font-medium ${r.type === "receita" ? "text-primary" : "text-danger"}`}>{formatCurrency(r.amount)}</span>
                  <Badge tone={r.active ? "good" : "default"}>{r.active ? "ativo" : "pausado"}</Badge>
                  {canEdit && (
                    <>
                      <form action={toggleRecurringTransaction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={String(r.active)} />
                        <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                          {r.active ? "Pausar" : "Ativar"}
                        </Button>
                      </form>
                      <form action={deleteRecurringTransaction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                          Excluir
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Lançamentos ({totalCount})</h2>

        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <Label>Buscar</Label>
            <Input name="q" defaultValue={q} placeholder="categoria ou descrição" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select name="tipo" defaultValue={tipoFiltro} className="!w-auto">
              <option value="">Todos</option>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={statusFiltro} className="!w-auto">
              <option value="">Todos</option>
              <option value="previsto">Previsto</option>
              <option value="realizado">Realizado</option>
            </Select>
          </div>
          <Button variant="ghost" type="submit">
            Filtrar
          </Button>
        </form>

        {list.length === 0 ? (
          <EmptyState>Nenhum lançamento encontrado para esse filtro.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Projeto</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-muted">{formatDate(t.due_date)}</td>
                    <td className="py-2 pr-3">{t.category}</td>
                    <td className="py-2 pr-3 text-muted">{t.projects?.name || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{t.description || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={t.type === "receita" ? "good" : "bad"}>{t.type}</Badge>
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium ${t.type === "receita" ? "text-primary" : "text-danger"}`}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={t.status === "realizado" ? "good" : "warn"}>{t.status}</Badge>
                    </td>
                    {canEdit && (
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          {t.status === "previsto" ? (
                            <form action={markStatus}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="status" value="realizado" />
                              <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                                Marcar pago
                              </Button>
                            </form>
                          ) : null}
                          <details className="relative">
                            <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                              Editar
                            </summary>
                            <Card className="absolute right-0 z-10 mt-2 w-[340px]">
                              <form action={updateTransaction} className="space-y-3">
                                <input type="hidden" name="id" value={t.id} />
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Tipo</Label>
                                    <Select name="type" defaultValue={t.type}>
                                      <option value="receita">Receita</option>
                                      <option value="despesa">Despesa</option>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Select name="status" defaultValue={t.status}>
                                      <option value="previsto">Previsto</option>
                                      <option value="realizado">Realizado</option>
                                    </Select>
                                  </div>
                                </div>
                                <div>
                                  <Label>Categoria</Label>
                                  <Select name="category" defaultValue={t.category}>
                                    {CATEGORIES.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <Label>Valor (R$)</Label>
                                  <Input name="amount" type="number" step="0.01" min="0" required defaultValue={t.amount} />
                                </div>
                                <div>
                                  <Label>Projeto (opcional)</Label>
                                  <Select name="project_id" defaultValue={t.project_id ?? ""}>
                                    <option value="">— nenhum —</option>
                                    {(projects ?? []).map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <Label>Vencimento</Label>
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
                          <details className="relative">
                            <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                              Anexos ({(filesByTx.get(t.id) ?? []).length})
                            </summary>
                            <Card className="absolute right-0 z-10 mt-2 w-[300px]">
                              <form action={uploadTransactionFile} className="space-y-3" encType="multipart/form-data">
                                <input type="hidden" name="transaction_id" value={t.id} />
                                <div>
                                  <Label>Comprovante / nota fiscal</Label>
                                  <Input name="file" type="file" required />
                                  <p className="mt-1 text-xs text-muted">Máx. 20MB.</p>
                                </div>
                                <Button type="submit" className="w-full">
                                  Enviar
                                </Button>
                              </form>
                              {(filesByTx.get(t.id) ?? []).length > 0 && (
                                <ul className="mt-3 space-y-2">
                                  {(filesByTx.get(t.id) ?? []).map((f) => (
                                    <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                                      <div className="min-w-0">
                                        {f.signedUrl ? (
                                          <a
                                            href={f.signedUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="truncate text-ink hover:text-primary hover:underline"
                                          >
                                            {f.file_name}
                                          </a>
                                        ) : (
                                          <span className="truncate text-ink">{f.file_name}</span>
                                        )}
                                        <div className="text-muted">{formatFileSize(f.file_size)}</div>
                                      </div>
                                      <form action={deleteTransactionFile}>
                                        <input type="hidden" name="id" value={f.id} />
                                        <input type="hidden" name="storage_path" value={f.storage_path} />
                                        <Button variant="danger" className="px-1.5 py-0.5 text-[10px]" type="submit">
                                          Excluir
                                        </Button>
                                      </form>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </Card>
                          </details>
                          <form action={deleteTransaction}>
                            <input type="hidden" name="id" value={t.id} />
                            <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                              Excluir
                            </Button>
                          </form>
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
              Página {page} de {totalPages} · {totalCount} lançamentos
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
