import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState, Kpi } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Project, Transaction } from "@/lib/types";
import { createTransaction, markStatus, deleteTransaction } from "./actions";
import { redirect } from "next/navigation";

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

export default async function FinanceiroPage() {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "view")) redirect("/dashboard");
  const canEdit = can("financeiro", "edit");

  const [{ data: transactions }, { data: projects }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, projects(name)")
      .order("due_date", { ascending: false })
      .limit(100)
      .returns<Transaction[]>(),
    supabase.from("projects").select("id, name").order("name").returns<Pick<Project, "id" | "name">[]>(),
  ]);

  const list = transactions ?? [];
  const receitas = list.filter((t) => t.type === "receita" && t.status === "realizado").reduce((s, t) => s + Number(t.amount), 0);
  const despesas = list.filter((t) => t.type === "despesa" && t.status === "realizado").reduce((s, t) => s + Number(t.amount), 0);
  const pendentes = list.filter((t) => t.status === "previsto");

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Contas a pagar/receber e fluxo de caixa"
        action={
          canEdit ? (
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
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Receitas realizadas" value={formatCurrency(receitas)} tone="good" />
        <Kpi label="Despesas realizadas" value={formatCurrency(despesas)} tone="bad" />
        <Kpi label="Saldo" value={formatCurrency(receitas - despesas)} tone={receitas - despesas >= 0 ? "good" : "bad"} />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Lançamentos ({list.length})</h2>
        {list.length === 0 ? (
          <EmptyState>Nenhum lançamento cadastrado ainda.</EmptyState>
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
      </Card>
    </div>
  );
}
