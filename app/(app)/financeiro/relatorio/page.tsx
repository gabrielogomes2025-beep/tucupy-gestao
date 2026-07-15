import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Input, Label, Button, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { redirect } from "next/navigation";
import Link from "next/link";

function monthsAgoISO(months: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default async function FinanceiroRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "view")) redirect("/dashboard");

  const params = await searchParams;
  const de = params.de || monthsAgoISO(11);
  const ate = params.ate || monthsAgoISO(0);

  const deDate = `${de}-01`;
  const [ateYear, ateMonth] = ate.split("-").map(Number);
  const ateEndDate = new Date(ateYear, ateMonth, 1).toISOString().slice(0, 10);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("status", "realizado")
    .gte("due_date", deDate)
    .lt("due_date", ateEndDate)
    .returns<Transaction[]>();

  const list = transactions ?? [];

  const byCategory = new Map<string, { receita: number; despesa: number }>();
  const byMonth = new Map<string, { receita: number; despesa: number }>();

  for (const t of list) {
    const cat = byCategory.get(t.category) ?? { receita: 0, despesa: 0 };
    if (t.type === "receita") cat.receita += Number(t.amount);
    else cat.despesa += Number(t.amount);
    byCategory.set(t.category, cat);

    const monthKey = (t.due_date ?? "").slice(0, 7) || "sem-data";
    const mon = byMonth.get(monthKey) ?? { receita: 0, despesa: 0 };
    if (t.type === "receita") mon.receita += Number(t.amount);
    else mon.despesa += Number(t.amount);
    byMonth.set(monthKey, mon);
  }

  const categoryRows = Array.from(byCategory.entries())
    .map(([category, v]) => ({ category, ...v, saldo: v.receita - v.despesa }))
    .sort((a, b) => b.receita + b.despesa - (a.receita + a.despesa));

  const monthRows = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, ...v, saldo: v.receita - v.despesa }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const totalReceita = list.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesa = list.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div>
      <Link href="/financeiro" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← Voltar para Financeiro
      </Link>

      <PageHeader
        title="Relatório financeiro"
        description="Lançamentos realizados, agrupados por categoria e por mês"
        action={
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div>
              <Label>De</Label>
              <Input name="de" type="month" defaultValue={de} />
            </div>
            <div>
              <Label>Até</Label>
              <Input name="ate" type="month" defaultValue={ate} />
            </div>
            <Button variant="ghost" type="submit">
              Filtrar
            </Button>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Receitas no período</div>
          <div className="mt-2 text-2xl font-semibold text-success">{formatCurrency(totalReceita)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Despesas no período</div>
          <div className="mt-2 text-2xl font-semibold text-danger">{formatCurrency(totalDespesa)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Saldo no período</div>
          <div className={`mt-2 text-2xl font-semibold ${totalReceita - totalDespesa >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(totalReceita - totalDespesa)}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Por categoria</h2>
        {categoryRows.length === 0 ? (
          <EmptyState>Nenhum lançamento realizado nesse período.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3 text-right">Receitas</th>
                  <th className="py-2 pr-3 text-right">Despesas</th>
                  <th className="py-2 pr-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((r) => (
                  <tr key={r.category} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{r.category}</td>
                    <td className="py-2 pr-3 text-right text-success">{formatCurrency(r.receita)}</td>
                    <td className="py-2 pr-3 text-right text-danger">{formatCurrency(r.despesa)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${r.saldo >= 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(r.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Por mês</h2>
        {monthRows.length === 0 ? (
          <EmptyState>Nenhum lançamento realizado nesse período.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Mês</th>
                  <th className="py-2 pr-3 text-right">Receitas</th>
                  <th className="py-2 pr-3 text-right">Despesas</th>
                  <th className="py-2 pr-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => (
                  <tr key={r.month} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium capitalize">
                      {r.month === "sem-data" ? "Sem data" : monthLabelFromKey(r.month)}
                    </td>
                    <td className="py-2 pr-3 text-right text-success">{formatCurrency(r.receita)}</td>
                    <td className="py-2 pr-3 text-right text-danger">{formatCurrency(r.despesa)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${r.saldo >= 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(r.saldo)}
                    </td>
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
