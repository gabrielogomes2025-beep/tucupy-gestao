import Link from "next/link";
import { getAccessContext } from "@/lib/access";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui";
import type { Module } from "@/lib/types";

const NAV: { href: string; label: string; icon: string; module: Module | null }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◈", module: null },
  { href: "/financeiro", label: "Financeiro", icon: "$", module: "financeiro" },
  { href: "/rh", label: "RH", icon: "◐", module: "rh" },
  { href: "/projetos", label: "Projetos", icon: "▣", module: "projetos" },
  { href: "/permissoes", label: "Equipe & Acessos", icon: "◆", module: "permissoes" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, can, isSuperAdmin } = await getAccessContext();

  const items = NAV.filter((item) => !item.module || can(item.module, "view"));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
            T
          </div>
          <span className="text-sm font-semibold tracking-tight">tucupy · gestão</span>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-ink"
            >
              <span className="w-4 text-center text-primary">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 border-t border-border pt-4">
          <div className="px-2 text-sm font-medium text-ink">{profile?.full_name || profile?.email}</div>
          <div className="px-2 text-xs text-muted">{isSuperAdmin ? "Administrador" : "Colaborador"}</div>
          <form action={signOut} className="mt-3 px-2">
            <Button variant="ghost" className="w-full" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-h-screen flex-1 overflow-y-auto bg-bg px-8 py-8">{children}</main>
    </div>
  );
}
