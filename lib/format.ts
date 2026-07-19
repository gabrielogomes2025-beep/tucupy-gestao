export function formatCurrency(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

export function monthLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatFileSize(bytes: number | null | undefined) {
  const n = Number(bytes ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function addMonthsIso(dateIso: string, months: number): string {
  const d = new Date(dateIso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateIso: string): number {
  const target = new Date(dateIso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function effectiveTransactionStatus(
  status: "pendente" | "pago",
  dueDate: string | null | undefined
): "pendente" | "pago" | "vencido" {
  if (status !== "pendente" || !dueDate) return status;
  return daysUntil(dueDate) < 0 ? "vencido" : "pendente";
}

export const TRANSACTION_STATUS_LABEL: Record<"pendente" | "pago" | "vencido", string> = {
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
};

export const TRANSACTION_STATUS_TONE: Record<"pendente" | "pago" | "vencido", "good" | "bad" | "warn"> = {
  pendente: "warn",
  pago: "good",
  vencido: "bad",
};
