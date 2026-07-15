import { getAccessContext } from "@/lib/access";
import type { Transaction } from "@/lib/types";
import { NextResponse } from "next/server";

function csvEscape(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const { supabase, can } = await getAccessContext();
  if (!can("financeiro", "view")) {
    return new NextResponse("Sem permissão.", { status: 403 });
  }

  const { data } = await supabase
    .from("transactions")
    .select("*, projects(name)")
    .order("due_date", { ascending: false })
    .returns<Transaction[]>();

  const rows = data ?? [];

  const header = ["Vencimento", "Categoria", "Projeto", "Descrição", "Tipo", "Valor", "Status", "Data de pagamento"];
  const lines = [header.join(";")];

  for (const t of rows) {
    lines.push(
      [
        t.due_date ?? "",
        t.category,
        t.projects?.name ?? "",
        t.description ?? "",
        t.type,
        String(t.amount).replace(".", ","),
        t.status,
        t.paid_date ?? "",
      ]
        .map((v) => csvEscape(String(v)))
        .join(";")
    );
  }

  const csv = "﻿" + lines.join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${today}.csv"`,
    },
  });
}
