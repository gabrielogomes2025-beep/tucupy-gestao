"use client";

import { useState, useTransition } from "react";
import type { HiringType } from "@/lib/types";
import { extractContractDataWithAI } from "@/app/(app)/rh/actions";

function setFieldValue(id: string, value: string | null) {
  if (!value) return;
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ContractAiExtract({ employeeId, hiringType }: { employeeId: string; hiringType: HiringType }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[] | null>(null);

  function handleClick() {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employee_id", employeeId);
        const result = await extractContractDataWithAI(fd);

        const appliedFields: string[] = [];
        const maybeApply = (id: string, value: string | null, label: string) => {
          if (!value) return;
          setFieldValue(id, value);
          appliedFields.push(label);
        };

        maybeApply(`f-${employeeId}-address`, result.address, "Endereço");
        maybeApply(`f-${employeeId}-marital_status`, result.marital_status, "Estado civil");
        maybeApply(`f-${employeeId}-cpf`, result.cpf, "CPF");
        maybeApply(`f-${employeeId}-rg`, result.rg, "RG");

        if (hiringType === "cnpj") {
          maybeApply(`f-${employeeId}-cnpj_razao_social`, result.cnpj_razao_social, "Razão social");
          maybeApply(`f-${employeeId}-cnpj_numero`, result.cnpj_numero, "CNPJ");
        } else {
          maybeApply(`f-${employeeId}-estagio_instituicao`, result.estagio_instituicao, "Instituição");
          maybeApply(`f-${employeeId}-estagio_curso`, result.estagio_curso, "Curso");
        }

        if (appliedFields.length === 0) {
          setError("A IA não encontrou dados suficientes nos documentos anexados. Preencha manualmente.");
        } else {
          setApplied(appliedFields);
        }
      } catch (err: any) {
        setError(err?.message || "Erro ao analisar documentos.");
      }
    });
  }

  return (
    <div className="mb-3 rounded-lg border border-dashed border-border bg-surface2/50 p-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
      >
        {isPending ? "Analisando documentos..." : "✨ Preencher com IA (a partir dos documentos anexados)"}
      </button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {applied && applied.length > 0 && (
        <p className="mt-1.5 text-xs text-success">
          Sugerido pela IA: {applied.join(", ")}. Revise os campos abaixo antes de salvar.
        </p>
      )}
    </div>
  );
}
