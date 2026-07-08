import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Kpi, EmptyState } from "@/components/ui";
import { formatCurrency, currentMonthISO, monthLabel } from "@/lib/format";
import type { Employee, PayrollEntry } from "@/lib/types";
import { upsertPayrollEntry, markPayrollPaid } from "../actions";
import { redirect } from "next/navigation";

export default async function FolhaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");

  const params = await searchParams;
  const refMonth = params.mes || currentMonthISO();

  const [{ data: employees }, { data: entries }] = await Promise.all([
    supabase.from("employees").select("*").eq("active", true).order("full_name").returns<Employee[]>(),
    supabase.from("payroll_entries").select("*").eq("ref_month", refMonth).returns<PayrollEntry[]>(),
  ]);

  const entryByEmployee = new Map((entries ?? []).map((e) => [e.employee_id, e]));
  const total = (entries ?? []).reduce((s, e) => s + Number(e.net_amount), 0);
  const pago = (entries ?? []).filter((e) => e.status === "pago").reduce((s, e) => s + Number(e.net_amount), 0);

  return (
    <div>
      <PageHeader
        title="Folha de Pagamento"
        description={monthLabel(refMonth)}
        action={
          <form className="flex items-center gap-2" method="get">
            <Input name="mes" type="month" defaultValue={refMonth.slice(0, 7)} onChange={undefined} />
            <Button variant="ghost" type="submit">
              Ver mês
            </Button>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Total da folha" value={formatCurrency(total)} />
        <Kpi label="Já pago" value={formatCurrency(pago)} tone="good" />
        <Kpi label="Em aberto" value={formatCurrency(total - pago)} tone={total - pago > 0 ? "warn" : "default"} />
      </div>

      <Card>
        {(employees ?? []).length === 0 ? (
          <EmptyState>Nenhum colaborador ativo cadastrado.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Colaborador</th>
                  <th className="py-2 pr-3">Base</th>
                  <th className="py-2 pr-3">Bônus</th>
                  <th className="py-2 pr-3">Descontos</th>
                  <th className="py-2 pr-3 text-right">Líquido</th>
                  <th className="py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody>
                {(employees ?? []).map((emp) => {
                  const entry = entryByEmployee.get(emp.id);
                  return (
                    <tr key={emp.id} className="border-b border-border/60">
                      {canEdit ? (
                        <>
                          <td className="py-2 pr-3 font-medium">{emp.full_name}</td>
                          <td className="py-2 pr-2">
                            <form action={upsertPayrollEntry} id={`f-${emp.id}`} className="contents">
                              <input type="hidden" name="employee_id" value={emp.id} />
                              <input type="hidden" name="ref_month" value={refMonth} />
                            </form>
                            <Input
                              form={`f-${emp.id}`}
                              name="base_salary"
                              type="number"
                              step="0.01"
                              defaultValue={entry?.base_salary ?? emp.monthly_salary}
                              className="w-28"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input form={`f-${emp.id}`} name="bonuses" type="number" step="0.01" defaultValue={entry?.bonuses ?? 0} className="w-24" />
                          </td>
                          <td className="py-2 pr-2">
                            <Input form={`f-${emp.id}`} name="deductions" type="number" step="0.01" defaultValue={entry?.deductions ?? 0} className="w-24" />
                          </td>
                          <td className="py-2 pr-3 text-right font-medium text-primary">{formatCurrency(entry?.net_amount ?? emp.monthly_salary)}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={entry?.status === "pago" ? "good" : "warn"}>{entry?.status ?? "não gerado"}</Badge>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex gap-2">
                              <Button form={`f-${emp.id}`} type="submit" variant="ghost" className="px-2 py-1 text-xs">
                                Salvar
                              </Button>
                              {entry && entry.status !== "pago" && (
                                <form action={markPayrollPaid}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <Button className="px-2 py-1 text-xs" type="submit">
                                    Pagar
                                  </Button>
                                </form>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-3 font-medium">{emp.full_name}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry?.base_salary ?? 0)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry?.bonuses ?? 0)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry?.deductions ?? 0)}</td>
                          <td className="py-2 pr-3 text-right font-medium">{formatCurrency(entry?.net_amount ?? 0)}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={entry?.status === "pago" ? "good" : "warn"}>{entry?.status ?? "não gerado"}</Badge>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
