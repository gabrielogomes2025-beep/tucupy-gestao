import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function RedeemInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const supabase = await createClient();

  if (invite) {
    await supabase.rpc("redeem_invite", { p_token: invite });
  }

  redirect("/dashboard");
}
