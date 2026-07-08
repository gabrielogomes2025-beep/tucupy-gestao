import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Select, EmptyState } from "@/components/ui";
import type { Employee, Permission, Profile } from "@/lib/types";
import { setPermission, linkEmployee } from "./actions";
import { redirect } from "next/navigation";

const MODULES: { key: "financeiro" | "rh" | "projetos" | "permissoes"; label: string }[] = [
  { key: "financeiro", label: "Financeiro" },
  { key: "rh", label: "RH" },
  { key: "projetos", label: "Projetos" },
  { key: "permissoes", label: "Equipe & Acessos" },
];

export default async function PermissoesPage() {
  const { supabase, can, isSuperAdmin } = await getAccessContext();
  if (!can("permissoes", "view")) redirect("/dashboard");
  const canEdit = can("permissoes", "edit");

  const [{ data: profiles }, { data: permissions }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
    supabase.from("permissions").select("*").returns<Permission[]>(),
    supabase.from("employees").select("id, full_name").order("full_name").returns<Pick<Employee, "id" | "full_name">[]>(),
  ]);

  const permByUserModule = new Map((permissions ?? []).map((p) => [`${p.user_id}:${p.module}`, p.access_level]));

  return (
    <div>
      <PageHeader title="Equipe & Acessos" description="Controle quem pode ver e editar cada módulo do sistema" />

      <Card>
        {(profiles ?? []).length === 0 ? (
          <EmptyState>Nenhum usuário cadastrado ainda.</EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">Colaborador vinculado</th>
                  {MODULES.map((m) => (
                    <th key={m.key} className="py-2 pr-3">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(profiles ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.full_name || p.email}</div>
                      <div className="text-xs text-muted">{p.email}</div>
                      {p.is_super_admin && (
                        <Badge tone="good" >admin</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {canEdit && !p.is_super_admin ? (
                        <form action={linkEmployee}>
                          <input type="hidden" name="profile_id" value={p.id} />
                          <Select name="employee_id" defaultValue={p.employee_id ?? ""} onChange={undefined} className="!w-auto">
                            <option value="">— nenhum —</option>
                            {(employees ?? []).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.full_name}
                              </option>
                            ))}
                          </Select>
                          <Button variant="ghost" type="submit" className="ml-2 px-2 py-1 text-xs">
                            Salvar
                          </Button>
                        </form>
                      ) : (
                        <span className="text-muted">
                          {(employees ?? []).find((e) => e.id === p.employee_id)?.full_name || "—"}
                        </span>
                      )}
                    </td>
                    {MODULES.map((m) => {
                      const level = p.is_super_admin ? "edit" : permByUserModule.get(`${p.id}:${m.key}`) || "none";
                      return (
                        <td key={m.key} className="py-2 pr-3">
                          {canEdit && !p.is_super_admin ? (
                            <form action={setPermission}>
                              <input type="hidden" name="user_id" value={p.id} />
                              <input type="hidden" name="module" value={m.key} />
                              <div className="flex items-center gap-1">
                                <Select name="access_level" defaultValue={level} className="!w-auto">
                                  <option value="none">sem acesso</option>
                                  <option value="view">visualizar</option>
                                  <option value="edit">editar</option>
                                </Select>
                                <Button variant="ghost" type="submit" className="px-2 py-1 text-xs">
                                  ✓
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <Badge tone={level === "edit" ? "good" : level === "view" ? "warn" : "default"}>{level}</Badge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!isSuperAdmin && !canEdit && (
        <p className="mt-4 text-sm text-muted">Você tem acesso de visualização a esta página, mas não pode alterar permissões.</p>
      )}
    </div>
  );
}
