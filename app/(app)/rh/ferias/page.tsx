import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Employee, LeaveRequest } from "@/lib/types";
import { createLeaveRequest, decideLeaveRequest } from "../actions";
import { redirect } from "next/navigation";

export default async function FeriasPage() {
  const { supabase, can } = await getAccessContext();
  if (!can("rh", "view")) redirect("/dashboard");
  const canEdit = can("rh", "edit");

  const [{ data: requests }, { data: employees }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*, employees(full_name)")
      .order("created_at", { ascending: false })
      .returns<LeaveRequest[]>(),
    supabase.from("employees").select("id, full_name").eq("active", true).order("full_name").returns<Pick<Employee, "id" | "full_name">[]>(),
  ]);

  const list = requests ?? [];
  const pendentes = list.filter((l) => l.status === "pendente");
  const decididas = list.filter((l) => l.status !== "pendente");

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
