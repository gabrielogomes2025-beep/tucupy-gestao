import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Select, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { AuditLogEntry, Profile } from "@/lib/types";
import { redirect } from "next/navigation";

const TABLE_LABEL: Record<string, string> = {
  transactions: "Lançamento financeiro",
  employees: "Colaborador",
  payroll_entries: "Folha de pagamento",
  leave_requests: "Férias/Ausência",
  employee_sensitive_data: "Dados sensíveis do colaborador",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "criado",
  update: "alterado",
  delete: "excluído",
};

const IGNORED_FIELDS = new Set(["created_at", "updated_at"]);

function diffFields(oldData: Record<string, any> | null, newData: Record<string, any> | null) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const diffs: { field: string; from: any; to: any }[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const from = oldData[key];
    const to = newData[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diffs.push({ field: key, from, to });
    }
  }
  return diffs;
}

function summarizeInsert(newData: Record<string, any> | null) {
  if (!newData) return "";
  const candidates = ["full_name", "title", "category", "description", "email"];
  for (const c of candidates) {
    if (newData[c]) return String(newData[c]);
  }
  return "";
}

function formatValue(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string; acao?: string }>;
}) {
  const { supabase, can } = await getAccessContext();
  if (!can("permissoes", "edit")) redirect("/dashboard");

  const params = await searchParams;
  const tabela = params.tabela || "";
  const acao = params.acao || "";

  let query = supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(200);
  if (tabela) query = query.eq("table_name", tabela);
  if (acao) query = query.eq("action", acao);

  const { data: logs } = await query.returns<AuditLogEntry[]>();
  const list = logs ?? [];

  const changedByIds = Array.from(new Set(list.map((l) => l.changed_by).filter(Boolean))) as string[];
  const { data: profiles } = changedByIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", changedByIds).returns<Pick<Profile, "id" | "full_name" | "email">[]>()
    : { data: [] as Pick<Profile, "id" | "full_name" | "email">[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Histórico de alterações em Financeiro e RH"
        action={
          <form className="flex flex-wrap items-end gap-2" method="get">
            <Select name="tabela" defaultValue={tabela} className="!w-auto">
              <option value="">Todas as tabelas</option>
              {Object.entries(TABLE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select name="acao" defaultValue={acao} className="!w-auto">
              <option value="">Todas as ações</option>
              <option value="insert">Criado</option>
              <option value="update">Alterado</option>
              <option value="delete">Excluído</option>
            </Select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2"
            >
              Filtrar
            </button>
          </form>
        }
      />

      <Card>
        {list.length === 0 ? (
          <EmptyState>Nenhuma alteração registrada ainda para esse filtro.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {list.map((l) => {
              const profile = l.changed_by ? profileById.get(l.changed_by) : null;
              const diffs = l.action === "update" ? diffFields(l.old_data, l.new_data) : [];
              return (
                <li key={l.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={l.action === "delete" ? "bad" : l.action === "insert" ? "good" : "warn"}>
                        {ACTION_LABEL[l.action]}
                      </Badge>
                      <span className="font-medium text-ink">{TABLE_LABEL[l.table_name] || l.table_name}</span>
                      {l.action === "insert" && summarizeInsert(l.new_data) && (
                        <span className="text-muted">— {summarizeInsert(l.new_data)}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {profile?.full_name || profile?.email || "sistema"} · {formatDateTime(l.changed_at)}
                    </div>
                  </div>

                  {l.action === "update" && diffs.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {diffs.map((d) => (
                        <li key={d.field}>
                          <span className="font-medium text-ink">{d.field}</span>: {formatValue(d.from)} → {formatValue(d.to)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
