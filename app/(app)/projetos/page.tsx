import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client, Project } from "@/lib/types";
import { createClientRecord, updateClientRecord, createProject, updateProjectStatus } from "./actions";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const PAGE_SIZE = 20;

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<{ pq?: string; pstatus?: string; ppage?: string; cq?: string; cpage?: string }>;
}) {
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "view")) redirect("/dashboard");
  const canEdit = can("projetos", "edit");

  const params = await searchParams;
  const pq = (params.pq || "").trim();
  const pstatus = params.pstatus || "";
  const ppage = Math.max(1, Number(params.ppage) || 1);
  const pFrom = (ppage - 1) * PAGE_SIZE;
  const pTo = pFrom + PAGE_SIZE - 1;

  const cq = (params.cq || "").trim();
  const cpage = Math.max(1, Number(params.cpage) || 1);
  const cFrom = (cpage - 1) * PAGE_SIZE;
  const cTo = cFrom + PAGE_SIZE - 1;

  function buildQuery(overrides: Record<string, string | number | undefined>) {
    const merged: Record<string, string | number | undefined> = { pq, pstatus, ppage, cq, cpage, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `/projetos?${qs}` : "/projetos";
  }

  let projectsQuery = supabase
    .from("projects")
    .select("*, clients(name)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (pq) projectsQuery = projectsQuery.ilike("name", `%${pq}%`);
  if (pstatus) projectsQuery = projectsQuery.eq("status", pstatus);
  projectsQuery = projectsQuery.range(pFrom, pTo);

  let clientsQuery = supabase.from("clients").select("*", { count: "exact" }).order("name");
  if (cq) clientsQuery = clientsQuery.or(`name.ilike.%${cq}%,cnpj.ilike.%${cq}%`);
  clientsQuery = clientsQuery.range(cFrom, cTo);

  const [{ data: projects, count: projectsCount }, { data: clients, count: clientsCount }, { data: allProjectsStats }, { data: allClientsForDropdown }] =
    await Promise.all([
      projectsQuery.returns<Project[]>(),
      clientsQuery.returns<Client[]>(),
      supabase.from("projects").select("status, budget_total"),
      supabase.from("clients").select("id, name").order("name").returns<Pick<Client, "id" | "name">[]>(),
    ]);

  const list = projects ?? [];
  const projectsTotalCount = projectsCount ?? 0;
  const projectsTotalPages = Math.max(1, Math.ceil(projectsTotalCount / PAGE_SIZE));

  const clientsList = clients ?? [];
  const clientsTotalCount = clientsCount ?? 0;
  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotalCount / PAGE_SIZE));

  const ativos = (allProjectsStats ?? []).filter((p: any) => p.status === "em_andamento");
  const budgetAtivo = ativos.reduce((s, p: any) => s + Number(p.budget_total), 0);

  return (
    <div>
      <PageHeader
        title="Projetos"
        description={`${ativos.length} em andamento · ${(allClientsForDropdown ?? []).length} clientes`}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email</Label>
                        <Input name="email" type="email" />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input name="phone" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>CNPJ</Label>
                        <Input name="cnpj" placeholder="00.000.000/0000-00" />
                      </div>
                      <div>
                        <Label>Inscrição estadual</Label>
                        <Input name="inscricao_estadual" />
                      </div>
                    </div>
                    <div>
                      <Label>Razão social</Label>
                      <Input name="razao_social" />
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Input name="endereco" />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar cliente
                    </Button>
                  </form>
                </Card>
              </details>

              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
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
                        {(allClientsForDropdown ?? []).map((c) => (
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
        <h2 className="mb-3 text-sm font-semibold text-ink">Projetos ({projectsTotalCount})</h2>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="cq" value={cq} />
          <input type="hidden" name="cpage" value={cpage} />
          <div>
            <Label>Buscar</Label>
            <Input name="pq" defaultValue={pq} placeholder="nome do projeto" />
          </div>
          <div>
            <Label>Status</Label>
            <Select name="pstatus" defaultValue={pstatus} className="!w-auto">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="ghost" type="submit">
            Filtrar
          </Button>
        </form>

        {list.length === 0 ? (
          <EmptyState>Nenhum projeto encontrado para esse filtro.</EmptyState>
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
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`/projetos/${p.id}`} className="hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
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

        {projectsTotalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              Página {ppage} de {projectsTotalPages} · {projectsTotalCount} projetos
            </span>
            <div className="flex gap-2">
              {ppage > 1 && (
                <Link
                  href={buildQuery({ ppage: ppage - 1 })}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Anterior
                </Link>
              )}
              {ppage < projectsTotalPages && (
                <Link
                  href={buildQuery({ ppage: ppage + 1 })}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Clientes ({clientsTotalCount})</h2>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="pq" value={pq} />
          <input type="hidden" name="pstatus" value={pstatus} />
          <input type="hidden" name="ppage" value={ppage} />
          <div>
            <Label>Buscar</Label>
            <Input name="cq" defaultValue={cq} placeholder="nome ou CNPJ" />
          </div>
          <Button variant="ghost" type="submit">
            Filtrar
          </Button>
        </form>

        {clientsList.length === 0 ? (
          <EmptyState>Nenhum cliente encontrado para esse filtro.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">CNPJ</th>
                  <th className="py-2 pr-3">Razão social</th>
                  <th className="py-2 pr-3">Contato</th>
                  {canEdit && <th className="py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody>
                {clientsList.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-muted">{c.cnpj || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{c.razao_social || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{c.email || c.phone || "—"}</td>
                    {canEdit && (
                      <td className="py-2 pr-3">
                        <details className="relative">
                          <summary className="inline-flex list-none cursor-pointer items-center justify-center rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface2">
                            Editar
                          </summary>
                          <Card className="absolute right-0 z-10 mt-2 w-[360px]">
                            <form action={updateClientRecord} className="space-y-3">
                              <input type="hidden" name="id" value={c.id} />
                              <div>
                                <Label>Nome do cliente</Label>
                                <Input name="name" required defaultValue={c.name} />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>Email</Label>
                                  <Input name="email" type="email" defaultValue={c.email ?? ""} />
                                </div>
                                <div>
                                  <Label>Telefone</Label>
                                  <Input name="phone" defaultValue={c.phone ?? ""} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>CNPJ</Label>
                                  <Input name="cnpj" defaultValue={c.cnpj ?? ""} placeholder="00.000.000/0000-00" />
                                </div>
                                <div>
                                  <Label>Inscrição estadual</Label>
                                  <Input name="inscricao_estadual" defaultValue={c.inscricao_estadual ?? ""} />
                                </div>
                              </div>
                              <div>
                                <Label>Razão social</Label>
                                <Input name="razao_social" defaultValue={c.razao_social ?? ""} />
                              </div>
                              <div>
                                <Label>Endereço</Label>
                                <Input name="endereco" defaultValue={c.endereco ?? ""} />
                              </div>
                              <div>
                                <Label>Observações</Label>
                                <Textarea name="notes" rows={2} defaultValue={c.notes ?? ""} />
                              </div>
                              <Button type="submit" className="w-full">
                                Salvar alterações
                              </Button>
                            </form>
                          </Card>
                        </details>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {clientsTotalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              Página {cpage} de {clientsTotalPages} · {clientsTotalCount} clientes
            </span>
            <div className="flex gap-2">
              {cpage > 1 && (
                <Link
                  href={buildQuery({ cpage: cpage - 1 })}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface2"
                >
                  Anterior
                </Link>
              )}
              {cpage < clientsTotalPages && (
                <Link
                  href={buildQuery({ cpage: cpage + 1 })}
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
