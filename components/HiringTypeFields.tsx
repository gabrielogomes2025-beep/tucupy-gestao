"use client";

import { useState } from "react";
import { Input, Label, Select } from "@/components/ui";

export function HiringTypeFields({ defaultType = "cnpj" }: { defaultType?: string }) {
  const [tipo, setTipo] = useState(defaultType);

  return (
    <>
      <div>
        <Label>Tipo de contratação</Label>
        <Select name="hiring_type" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="cnpj">CNPJ (PJ)</option>
          <option value="estagiario">Estagiário</option>
        </Select>
      </div>

      {tipo === "cnpj" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Razão social</Label>
              <Input name="cnpj_razao_social" placeholder="Nome da empresa" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input name="cnpj_numero" placeholder="00.000.000/0001-00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor mensal (R$)</Label>
              <Input name="cnpj_valor_mensal" type="number" step="0.01" min="0" placeholder="0,00" />
            </div>
            <div>
              <Label>Dia de pagamento</Label>
              <Input name="cnpj_dia_pagamento" type="number" min="1" max="28" defaultValue={10} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do contrato</Label>
              <Input name="cnpj_contract_start_date" type="date" />
            </div>
            <div>
              <Label>Prazo (meses)</Label>
              <Input name="cnpj_prazo_meses" type="number" min="1" defaultValue={3} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Instituição de ensino</Label>
              <Input name="estagio_instituicao" placeholder="Ex: CESUPA" />
            </div>
            <div>
              <Label>Curso</Label>
              <Input name="estagio_curso" placeholder="Ex: Ciência da Computação" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do estágio</Label>
              <Input name="estagio_start_date" type="date" />
            </div>
            <div>
              <Label>Fim do estágio</Label>
              <Input name="estagio_end_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bolsa-auxílio (R$)</Label>
              <Input name="estagio_bolsa_valor" type="number" step="0.01" min="0" placeholder="0,00" />
            </div>
            <div>
              <Label>Carga horária semanal</Label>
              <Input name="estagio_carga_horaria_semanal" type="number" min="1" max="40" placeholder="30" />
            </div>
          </div>
          <div>
            <Label>Horário</Label>
            <Input name="estagio_horario" placeholder="Ex: 09:00 às 15:00 (6 horas diárias)" />
          </div>
        </>
      )}
    </>
  );
}
