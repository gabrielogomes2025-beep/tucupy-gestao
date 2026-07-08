import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client, Project } from "@/lib/types";
import { createClientRecord, createProject, updateProjectStatus } from "./actions";
import { redirect } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default async function ProjetosPage() {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "view")) redirect("/dashboard");
  const canEdit = can("projetos", "edit");

  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("*, clients(name)").order("created_at", { ascending: false }).returns<Project[]>(),
    supabase.from("clients").select("*").order("name").returns<Client[]>(),
  ]);

  const list = projects ?? [];
  const ativos = list.filter((p) => p.status === "em_andamento");
  const budgetAtivo = ativos.reduce((s, p) => s + Number(p.budget_total), 0);

  return (
    <div>
      <PageHeader
        title="Projetos"
        description={`${ativos.length} em andamento · ${(clients ?? []).length} clientes`}
        action={
          canEdit ? (
            <div className="flex gap-2">
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2">
                  + Cliente
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[320px]">
                  <form action={createClientRecord} className="space-y-3">
                    <div>
                      <Label>Nome do cliente</Label>
                      <Input name="name" required />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input name="email" type="email" />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input name="phone" />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar cliente
                    </Button>
                  </form>
                </Card>
              </details>

              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#06120c] hover:bg-primary-dark">
                  + Projeto
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                  <form action={createProject} className="space-y-3">
                    <div>
                      <Label>Nome do projeto</Label>
                      <Input name="name" required />
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Select name="client_id" defaultValue="">
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
                        <Select name="status" defaultValue="prospeccao">
                          {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Orçamento (R$)</Label>
                        <Input name="budget_total" type="number" step="0.01" min="0" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Início</Label>
                        <Input name="start_date" type="date" />
                      </div>
                      <div>
                        <Label>Previsão de fim</Label>
                        <Input name="end_date" type="date" />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea name="description" rows={2} />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar projeto
                    </Button>
                  </form>
                </Card>
              </details>
            </div>
          ) : null
        }
      />

      <Card className="mb-6">
        <div className="text-xs uppercase tracking-wide text-muted">Orçamento total (projetos em andamento)</div>
        <div className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(budgetAtivo)}</div>
      </Card>

      <Card>
        {list.length === 0 ? (
          <EmptyState>Nenhum projeto cadastrado ainda.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Projeto</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Período</th>
                  <th className="py-2 pr-3 text-right">Orçamento</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3 text-muted">{p.clients?.name || "—"}</td>
                    <td className="py-2 pr-3 text-muted">
                      {formatDate(p.start_date)} – {formatDate(p.end_date)}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(p.budget_total)}</td>
                    <td className="py-2 pr-3">
                      {canEdit ? (
                        <form action={updateProjectStatus} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <Select name="status" defaultValue={p.status} className="!w-auto">
                            {Object.entries(STATUS_LABEL).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </Select>
                          <Button variant="ghost" type="submit" className="px-2 py-1 text-xs">
                            Salvar
                          </Button>
                        </form>
                      ) : (
                        <Badge>{STATUS_LABEL[p.status]}</Badge>
                      )}
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
