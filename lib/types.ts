export type AccessLevel = "none" | "view" | "edit";
export type Module = "financeiro" | "rh" | "projetos" | "permissoes";

export type Profile = {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  email: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export type Permission = {
  user_id: string;
  module: Module;
  access_level: AccessLevel;
};

export type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  department: string | null;
  hire_date: string | null;
  monthly_salary: number;
  hourly_cost: number;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export type LeaveType = "ferias" | "atestado" | "falta_justificada" | "falta_injustificada" | "outro";
export type LeaveStatus = "pendente" | "aprovado" | "rejeitado";

export type LeaveRequest = {
  id: string;
  employee_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  notes: string | null;
  created_at: string;
  employees?: { full_name: string } | null;
};

export type PayrollStatus = "pendente" | "pago";

export type PayrollEntry = {
  id: string;
  employee_id: string;
  ref_month: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_amount: number;
  status: PayrollStatus;
  paid_date: string | null;
  notes: string | null;
  employees?: { full_name: string } | null;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ProjectStatus = "prospeccao" | "em_andamento" | "pausado" | "concluido" | "cancelado";

export type Project = {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  budget_total: number;
  start_date: string | null;
  end_date: string | null;
  clients?: { name: string } | null;
};

export type TransactionType = "receita" | "despesa";
export type TransactionStatus = "previsto" | "realizado";

export type Transaction = {
  id: string;
  project_id: string | null;
  category: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string | null;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  projects?: { name: string } | null;
};

export type ProjectFileCategory = "orcamento" | "contrato" | "nota_fiscal" | "proposta" | "outro";

export type ProjectFile = {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  category: ProjectFileCategory;
  created_at: string;
};
