import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { calcVacationBalance } from "@/lib/vacation";
import type { Employee, LeaveRequest } from "@/lib/types";
import { createLeaveRequest, decideLeaveRequest } from "../actions";
import { redirect } from "next/navigation";

const STATUS_LABEL = {
  ok: "em dia",
  vencendo: "vencendo em breve",
  vencida: "vencida",
  sem_periodo: "sem período completo",
} as const;

export default async function FeriasPage() {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");

  const [{ data: requests }, { data: employees }, { data: activeEmployeesFull }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*, employees(full_name)")
      .order("created_at", { ascending: false })
      .returns<LeaveRequest[]>(),
    supabase.from("employees").select("id, full_name").eq("active", true).order("full_name").returns<Pick<Employee, "id" | "full_name">[]>(),
    supabase
      .from("employees")
      .select("id, full_name, hire_date")
      .eq("active", true)
      .order("full_name")
      .returns<Pick<Employee, "id" | "full_name" | "hire_date">[]>(),
  ]);

  const list = requests ?? [];
  const pendentes = list.filter((l) => l.status === "pendente");
  const decididas = list.filter((l) => l.status !== "pendente");

  const diasGozadosPorColaborador = new Map<string, number>();
  list
    .filter((l) => l.type === "ferias" && l.status === "aprovado")
    .forEach((l) => {
      const dias = Math.round((new Date(l.end_date + "T00:00:00").getTime() - new Date(l.start_date + "T00:00:00").getTime()) / 86400000) + 1;
      diasGozadosPorColaborador.set(l.employee_id, (diasGozadosPorColaborador.get(l.employee_id) ?? 0) + Math.max(0, dias));
    });

  const balances = (activeEmployeesFull ?? [])
    .filter((e) => e.hire_date)
    .map((e) => ({
      employee: e,
      balance: calcVacationBalance(e.hire_date as string, diasGozadosPorColaborador.get(e.id) ?? 0),
    }));

  return (
    <div>
      <PageHeader
        title="Férias & Ausências"
        description={`${pendentes.length} pendentes de aprovação`}
        action={
          <details className="relative">
            <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
              + Solicitar
            </summary>
            <Card className="absolute right-0 z-10 mt-2 w-[360px]">
              <form action={createLeaveRequest} className="space-y-3">
                {canEdit && (
                  <div>
                    <Label>Colaborador</Label>
                    <Select name="employee_id" required>
                      {(employees ?? []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Tipo</Label>
                  <Select name="type" defaultValue="ferias">
                    <option value="ferias">Férias</option>
                    <option value="atestado">Atestado médico</option>
                    <option value="falta_justificada">Falta justificada</option>
                    <option value="falta_injustificada">Falta injustificada</option>
                    <option value="outro">Outro</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input name="start_date" type="date" required />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input name="end_date" type="date" required />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea name="notes" rows={2} />
                </div>
                <Button type="submit" className="w-full">
                  Enviar solicitação
                </Button>
              </form>
            </Card>
          </details>
        }
      />

      {canEdit && (
        <Card className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-ink">Saldo de férias</h2>
          <p className="mb-3 text-xs text-muted">
            Estimativa simplificada (30 dias por período de 12 meses trabalhados). Para fins legais, confirme com a
            contabilidade.
          </p>
          {balances.length === 0 ? (
            <EmptyState>Nenhum colaborador ativo com data de admissão cadastrada.</EmptyState>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted">
                    <th className="py-2 pr-3">Colaborador</th>
                    <th className="py-2 pr-3 text-right">Dias de direito</th>
                    <th className="py-2 pr-3 text-right">Dias gozados</th>
                    <th className="py-2 pr-3 text-right">Saldo</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map(({ employee, balance }) => (
                    <tr key={employee.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{employee.full_name}</td>
                      <td className="py-2 pr-3 text-right">{balance.diasDireito}</td>
                      <td className="py-2 pr-3 text-right">{balance.diasGozados}</td>
                      <td className="py-2 pr-3 text-right font-medium">{balance.saldoDias}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          tone={
                            balance.status === "vencida"
                              ? "bad"
                              : balance.status === "vencendo"
                              ? "warn"
                              : balance.status === "ok"
                              ? "good"
                              : "default"
                          }
                        >
                          {STATUS_LABEL[balance.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {canEdit && pendentes.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">Pendentes de aprovação</h2>
          <ul className="space-y-2">
            {pendentes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium">{l.employees?.full_name}</span>
                <Badge>{l.type}</Badge>
                <span className="text-muted">
                  {formatDate(l.start_date)} – {formatDate(l.end_date)}
                </span>
                <div className="flex gap-2">
                  <form action={decideLeaveRequest}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="status" value="aprovado" />
                    <Button className="px-2 py-1 text-xs" type="submit">
                      Aprovar
                    </Button>
                  </form>
                  <form action={decideLeaveRequest}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="status" value="rejeitado" />
                    <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                      Rejeitar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Histórico</h2>
        {decididas.length === 0 && pendentes.length === 0 ? (
          <EmptyState>Nenhuma solicitação registrada ainda.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {(canEdit ? decididas : list).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium">{l.employees?.full_name}</span>
                <Badge>{l.type}</Badge>
                <span className="text-muted">
                  {formatDate(l.start_date)} – {formatDate(l.end_date)}
                </span>
                <Badge tone={l.status === "aprovado" ? "good" : l.status === "rejeitado" ? "bad" : "warn"}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
