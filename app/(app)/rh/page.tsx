import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { createEmployee, toggleEmployeeActive } from "./actions";
import { redirect } from "next/navigation";

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

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description={`${list.filter((e) => e.active).length} ativos · ${list.length} no total`}
        action={
          canEdit ? (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#06120c] hover:bg-primary-dark">
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
                    </td>
                    {canEdit && (
                      <td className="py-2 pr-3">
                        <form action={toggleEmployeeActive}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="active" value={String(e.active)} />
                          <Button variant="ghost" className="px-2 py-1 text-xs" type="submit">
                            {e.active ? "Desativar" : "Reativar"}
                          </Button>
                        </form>
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
