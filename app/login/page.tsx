import { signIn, signUp } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const isSignUp = params.mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary">
            T
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">tucupy</h1>
          <p className="mt-1 text-sm text-muted">Gestão · Financeiro · RH · Projetos</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          {params.check_email ? (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              Conta criada! Confira seu email para confirmar o cadastro e depois faça login.
            </div>
          ) : null}
          {params.error ? (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {params.error}
            </div>
          ) : null}

          {isSignUp ? (
            <form action={signUp} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" name="full_name" required placeholder="Seu nome" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="voce@tucupy.com" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" required minLength={6} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full">
                Criar conta
              </Button>
              <p className="text-center text-xs text-muted">
                Já tem conta?{" "}
                <a href="/login" className="text-primary hover:underline">
                  Entrar
                </a>
              </p>
            </form>
          ) : (
            <form action={signIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="voce@tucupy.com" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
              <p className="text-center text-xs text-muted">
                Primeiro acesso?{" "}
                <a href="/login?mode=signup" className="text-primary hover:underline">
                  Criar conta
                </a>
              </p>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          O primeiro cadastro vira administrador do sistema automaticamente.
        </p>
      </div>
    </div>
  );
}
