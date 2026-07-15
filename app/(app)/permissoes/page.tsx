import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Select, Input, Label, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Employee, Invite, Permission, Profile } from "@/lib/types";
import { setPermission, linkEmployee, createInvite, cancelInvite } from "./actions";
import { redirect } from "next/navigation";

const MODULES: { key: "financeiro" | "rh" | "projetos" | "permissoes"; label: string }[] = [
  { key: "financeiro", label: "Financeiro" },
  { key: "rh", label: "RH" },
  { key: "projetos", label: "Projetos" },
  { key: "permissoes", label: "Equipe & Acessos" },
];

export default async function PermissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_link?: string }>;
}) {
  const { invite_link } = await searchParams;
  const { supabase, can, isSuperAdmin } = await getAccessContext();
  if (!can("permissoes", "view")) redirect("/dashboard");
  const canEdit = can("permissoes", "edit");

  const [{ data: profiles }, { data: permissions }, { data: employees }, { data: invites }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
    supabase.from("permissions").select("*").returns<Permission[]>(),
    supabase.from("employees").select("id, full_name").order("full_name").returns<Pick<Employee, "id" | "full_name">[]>(),
    canEdit
      ? supabase
          .from("invites")
          .select("*")
          .is("used_at", null)
          .order("created_at", { ascending: false })
          .returns<Invite[]>()
      : Promise.resolve({ data: [] as Invite[] }),
  ]);

  const permByUserModule = new Map((permissions ?? []).map((p) => [`${p.user_id}:${p.module}`, p.access_level]));
  const pendingInvites = (invites ?? []).filter((i) => new Date(i.expires_at) > new Date());

  return (
    <div>
      <PageHeader
        title="Equipe & Acessos"
        description="Controle quem pode ver e editar cada módulo do sistema"
        action={
          canEdit ? (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Convidar pessoa
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                <form action={createInvite} className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input name="email" type="email" required placeholder="pessoa@tucupy.com" />
                  </div>
                  <div>
                    <Label>Colaborador vinculado (opcional)</Label>
                    <Select name="employee_id" defaultValue="">
                      <option value="">— nenhum —</option>
                      {(employees ?? []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {MODULES.map((m) => (
                    <div key={m.key}>
                      <Label>{m.label}</Label>
                      <Select name={`${m.key}_access`} defaultValue="none">
                        <option value="none">sem acesso</option>
                        <option value="view">visualizar</option>
                        <option value="edit">editar</option>
                      </Select>
                    </div>
                  ))}
                  <Button type="submit" className="w-full">
                    Gerar convite
                  </Button>
                </form>
              </Card>
            </details>
          ) : null
        }
      />

      {invite_link && (
        <Card className="mb-6 border-primary/30">
          <div className="mb-2 text-sm font-medium text-ink">Convite gerado — envie este link para a pessoa</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={invite_link} className="flex-1" onFocus={undefined} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Válido por 7 dias e utilizável uma única vez. Ao se cadastrar por esse link, a pessoa já recebe automaticamente os acessos definidos.
          </p>
        </Card>
      )}

      {canEdit && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">Convites pendentes ({pendingInvites.length})</h2>
          {pendingInvites.length === 0 ? (
            <EmptyState>Nenhum convite pendente.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {pendingInvites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-muted">Expira em {formatDateTime(i.expires_at)}</div>
                  </div>
                  <form action={cancelInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <Button variant="danger" className="px-2 py-1 text-xs" type="submit">
                      Cancelar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

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
