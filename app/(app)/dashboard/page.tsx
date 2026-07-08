import { getAccessContext } from "@/lib/access";
import { Card, Kpi, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, currentMonthISO } from "@/lib/format";
import type { Transaction, LeaveRequest, Project } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, can, profile } = await getAccessContext();

  const monthStart = currentMonthISO();
  const seeFinanceiro = can("financeiro", "view");
  const seeRh = can("rh", "view");
  const seeProjetos = can("projetos", "view");

  const [txRes, employeesRes, leaveRes, projectsRes, payrollRes] = await Promise.all([
    seeFinanceiro
      ? supabase
          .from("transactions")
          .select("*")
          .gte("due_date", monthStart)
          .returns<Transaction[]>()
      : Promise.resolve({ data: [] as Transaction[] }),
    seeRh ? supabase.from("employees").select("id, active").eq("active", true) : Promise.resolve({ data: [] }),
    seeRh
      ? supabase
          .from("leave_requests")
          .select("*, employees(full_name)")
          .eq("status", "pendente")
          .returns<LeaveRequest[]>()
      : Promise.resolve({ data: [] as LeaveRequest[] }),
    seeProjetos
      ? supabase
          .from("projects")
          .select("*, clients(name)")
          .eq("status", "em_andamento")
          .returns<Project[]>()
      : Promise.resolve({ data: [] as Project[] }),
    seeRh ? supabase.from("payroll_entries").select("net_amount, status").eq("ref_month", monthStart) : Promise.resolve({ data: [] }),
  ]);

  const transactions = txRes.data ?? [];
  const receitasRealizadas = transactions.filter((t) => t.type === "receita" && t.status === "realizado").reduce((s, t) => s + Number(t.amount), 0);
  const despesasRealizadas = transactions.filter((t) => t.type === "despesa" && t.status === "realizado").reduce((s, t) => s + Number(t.amount), 0);
  const aVencer = transactions.filter((t) => t.status === "previsto").reduce((s, t) => s + Number(t.amount) * (t.type === "despesa" ? -1 : 1), 0);
  const saldo = receitasRealizadas - despesasRealizadas;

  const employeesAtivos = employeesRes.data?.length ?? 0;
  const feriasPendentes = leaveRes.data ?? [];
  const projetosAtivos = projectsRes.data ?? [];
  const folhaTotal = (payrollRes.data ?? []).reduce((s: number, p: any) => s + Number(p.net_amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] || "bem-vindo(a)"}`}
        description="Visão geral do mês em Financeiro, RH e Projetos"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {seeFinanceiro && (
          <>
            <Kpi label="Saldo realizado (mês)" value={formatCurrency(saldo)} tone={saldo >= 0 ? "good" : "bad"} />
            <Kpi label="Receitas realizadas" value={formatCurrency(receitasRealizadas)} tone="good" />
            <Kpi label="Despesas realizadas" value={formatCurrency(despesasRealizadas)} tone="bad" />
            <Kpi label="Previsto (a vencer)" value={formatCurrency(aVencer)} tone="warn" />
          </>
        )}
        {seeRh && (
          <>
            <Kpi label="Colaboradores ativos" value={employeesAtivos} />
            <Kpi label="Férias/ausências pendentes" value={feriasPendentes.length} tone={feriasPendentes.length ? "warn" : "default"} />
            <Kpi label="Folha do mês" value={formatCurrency(folhaTotal)} />
          </>
        )}
        {seeProjetos && <Kpi label="Projetos em andamento" value={projetosAtivos.length} />}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {seeRh && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Solicitações de férias pendentes</h2>
            {feriasPendentes.length === 0 ? (
              <EmptyState>Nenhuma solicitação pendente.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {feriasPendentes.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{l.employees?.full_name}</span>
                    <span className="text-muted">
                      {formatDate(l.start_date)} – {formatDate(l.end_date)}
                    </span>
                    <Badge tone="warn">{l.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {seeProjetos && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Projetos em andamento</h2>
            {projetosAtivos.length === 0 ? (
              <EmptyState>Nenhum projeto em andamento.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {projetosAtivos.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="text-muted">{p.clients?.name || "sem cliente"}</span>
                    <span className="text-primary">{formatCurrency(p.budget_total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
