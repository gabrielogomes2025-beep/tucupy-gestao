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

export type TerminationReason =
  | "pedido_demissao"
  | "demissao_sem_justa_causa"
  | "demissao_justa_causa"
  | "termino_contrato"
  | "outro";

export type HiringType = "cnpj" | "estagiario";

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
  termination_date: string | null;
  termination_reason: TerminationReason | null;
  created_at: string;
  hiring_type: HiringType | null;
  address: string | null;
  marital_status: string | null;
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
  cnpj: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
  endereco: string | null;
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

export type TransactionType = "receita" | "despesa" | "aporte";
export type TransactionStatus = "pendente" | "pago";
export type EffectiveTransactionStatus = TransactionStatus | "vencido";

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

export type ProjectTeamMember = {
  id: string;
  project_id: string;
  employee_id: string;
  allocated_hours: number;
  hourly_cost_snapshot: number;
  created_at: string;
  employees?: { full_name: string } | null;
};

export type ProjectBudgetCategory = {
  id: string;
  project_id: string;
  category: string;
  budgeted_amount: number;
};

export type TransactionFile = {
  id: string;
  transaction_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  token: string;
  employee_id: string | null;
  financeiro_access: AccessLevel;
  rh_access: AccessLevel;
  projetos_access: AccessLevel;
  permissoes_access: AccessLevel;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

export type RecurringTransaction = {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  project_id: string | null;
  day_of_month: number;
  active: boolean;
  created_at: string;
  projects?: { name: string } | null;
};

export type EmployeeHistoryEntry = {
  id: string;
  employee_id: string;
  field: "role" | "monthly_salary" | "department";
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
};

export type ProjectTaskStatus = "todo" | "doing" | "done";

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  employees?: { full_name: string } | null;
};

export type EmployeeSensitiveData = {
  employee_id: string;
  cpf: string | null;
  rg: string | null;
  pix_key: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  updated_at: string;
};

export type EmployeeDocumentCategory =
  | "contrato"
  | "documento_pessoal"
  | "comprovante_endereco"
  | "cartao_cnpj"
  | "comprovante_matricula"
  | "outro";

export type EmployeeDocument = {
  id: string;
  employee_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  category: EmployeeDocumentCategory;
  created_at: string;
};

export type EmployeeContractData = {
  employee_id: string;
  cnpj_razao_social: string | null;
  cnpj_numero: string | null;
  cnpj_valor_mensal: number | null;
  cnpj_contract_start_date: string | null;
  cnpj_prazo_meses: number | null;
  cnpj_dia_pagamento: number | null;
  cnpj_bank_name: string | null;
  cnpj_bank_agency: string | null;
  cnpj_bank_account: string | null;
  cnpj_pix_key: string | null;
  estagio_instituicao: string | null;
  estagio_curso: string | null;
  estagio_start_date: string | null;
  estagio_end_date: string | null;
  estagio_bolsa_valor: number | null;
  estagio_carga_horaria_semanal: number | null;
  estagio_horario: string | null;
  contract_document_id: string | null;
  contract_generated_at: string | null;
  updated_at: string;
};

export type AuditAction = "insert" | "update" | "delete";

export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
};
