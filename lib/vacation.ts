export type VacationBalance = {
  diasDireito: number;
  diasGozados: number;
  saldoDias: number;
  deadline: Date | null;
  status: "ok" | "vencendo" | "vencida" | "sem_periodo";
};

/**
 * Estimativa simplificada de saldo de férias (regra geral CLT: 30 dias por período
 * aquisitivo de 12 meses, a usar nos 12 meses seguintes). Não considera faltas,
 * afastamentos, ou regras de proporcionalidade — para fins legais, confirme com
 * a contabilidade/RH responsável.
 */
export function calcVacationBalance(hireDate: string, daysTakenApproved: number, today: Date = new Date()): VacationBalance {
  const hire = new Date(hireDate + "T00:00:00");

  let monthsSinceHire =
    (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
  if (today.getDate() < hire.getDate()) monthsSinceHire -= 1;
  monthsSinceHire = Math.max(0, monthsSinceHire);

  const completedPeriods = Math.floor(monthsSinceHire / 12);
  const diasDireito = completedPeriods * 30;
  const saldoDias = diasDireito - daysTakenApproved;

  if (completedPeriods === 0) {
    return { diasDireito, diasGozados: daysTakenApproved, saldoDias, deadline: null, status: "sem_periodo" };
  }

  const periodsFullyUsed = Math.floor(daysTakenApproved / 30);
  let deadline: Date | null = null;
  let status: VacationBalance["status"] = "ok";

  if (saldoDias > 0 && periodsFullyUsed < completedPeriods) {
    deadline = new Date(hire);
    deadline.setMonth(deadline.getMonth() + 12 * (periodsFullyUsed + 2));
    const daysUntilDeadline = Math.floor((deadline.getTime() - today.getTime()) / 86400000);
    if (daysUntilDeadline < 0) status = "vencida";
    else if (daysUntilDeadline <= 90) status = "vencendo";
  }

  return { diasDireito, diasGozados: daysTakenApproved, saldoDias, deadline, status };
}
