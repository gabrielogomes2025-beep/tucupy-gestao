"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "");
  const invite = String(formData.get("invite") || "");
  const supabase = await createClient();

  const { data: allowed } = await supabase.rpc("check_invite_or_first", {
    p_token: invite,
    p_email: email,
  });

  if (!allowed) {
    redirect(
      `/login?mode=signup&error=${encodeURIComponent(
        "Cadastro só é permitido por convite. Peça um convite ao administrador."
      )}`
    );
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const next = invite ? `/auth/redeem-invite?invite=${encodeURIComponent(invite)}` : "/dashboard";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?check_email=1");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "");
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?reset_email=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
