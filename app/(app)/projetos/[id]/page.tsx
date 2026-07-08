import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, Textarea, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatFileSize, formatDateTime } from "@/lib/format";
import type { Client, Project, ProjectFile } from "@/lib/types";
import { uploadProjectFile, deleteProjectFile, updateProject } from "../actions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const CATEGORY_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  contrato: "Contrato",
  nota_fiscal: "Nota fiscal",
  proposta: "Proposta",
  outro: "Outro",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, can } = await getAccessContext();
  if (!can("projetos", "view")) redirect("/dashboard");
  const canEdit = can("projetos", "edit");

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name)")
    .eq("id", id)
    .single<Project & { clients: Pick<Client, "name"> | null }>();

  if (!project) notFound();

  const { data: clients } = await supabase.from("clients").select("*").order("name").returns<Client[]>();

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .returns<ProjectFile[]>();

  const fileList = files ?? [];

  const signedUrls = await Promise.all(
    fileList.map((f) =>
      supabase.storage.from("project-files").createSignedUrl(f.storage_path, 60 * 60)
    )
  );

  return (
    <div>
      <Link href="/projetos" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← Voltar para Projetos
      </Link>

      <PageHeader
        title={project.name}
        description={project.clients?.name ? `Cliente: ${project.clients.name}` : "Sem cliente vinculado"}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={project.status === "em_andamento" ? "good" : "default"}>{STATUS_LABEL[project.status]}</Badge>
            {canEdit && (
              <details className="relative">
                <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface2">
                  Editar projeto
                </summary>
                <Card className="absolute right-0 z-10 mt-2 w-[380px]">
                  <form action={updateProject} className="space-y-3">
                    <input type="hidden" name="id" value={project.id} />
                    <div>
                      <Label>Nome do projeto</Label>
                      <Input name="name" defaultValue={project.name} required />
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Select name="client_id" defaultValue={project.client_id ?? ""}>
                        <option value="">— nenhum —</option>
                        {(clients ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue={project.status}>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Orçamento (R$)</Label>
                        <Input name="budget_total" type="number" step="0.01" min="0" defaultValue={project.budget_total} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Início</Label>
                        <Input name="start_date" type="date" defaultValue={project.start_date ?? ""} />
                      </div>
                      <div>
                        <Label>Previsão de fim</Label>
                        <Input name="end_date" type="date" defaultValue={project.end_date ?? ""} />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea name="description" rows={2} defaultValue={project.description ?? ""} />
                    </div>
                    <Button type="submit" className="w-full">
                      Salvar alterações
                    </Button>
                  </form>
                </Card>
              </details>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Orçamento do projeto</div>
          <div className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(project.budget_total)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Início</div>
          <div className="mt-2 text-lg font-medium">{formatDate(project.start_date)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-muted">Previsão de fim</div>
          <div className="mt-2 text-lg font-medium">{formatDate(project.end_date)}</div>
        </Card>
      </div>

      {project.description && (
        <Card className="mb-6">
          <div className="text-xs uppercase tracking-wide text-muted">Descrição</div>
          <p className="mt-2 text-sm text-ink">{project.description}</p>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Anexos ({fileList.length})</h2>
          {canEdit && (
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-primary-dark">
                + Anexar arquivo
              </summary>
              <Card className="absolute right-0 z-10 mt-2 w-[340px]">
                <form action={uploadProjectFile} className="space-y-3" encType="multipart/form-data">
                  <input type="hidden" name="project_id" value={project.id} />
                  <div>
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue="orcamento">
                      {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Arquivo</Label>
                    <Input name="file" type="file" required />
                    <p className="mt-1 text-xs text-muted">Máx. 20MB.</p>
                  </div>
                  <Button type="submit" className="w-full">
                    Enviar
                  </Button>
                </form>
              </Card>
            </details>
          )}
        </div>

        {fileList.length === 0 ? (
          <EmptyState>Nenhum arquivo anexado ainda. Envie orçamentos, contratos ou notas fiscais.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {fileList.map((f, i) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  {signedUrls[i]?.data?.signedUrl ? (
                    <a
                      href={signedUrls[i]!.data!.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-ink hover:text-primary hover:underline"
                    >
                      {f.file_name}
                    </a>
                  ) : (
                    <span className="truncate font-medium text-ink">{f.file_name}</span>
                  )}
                  <div className="text-xs text-muted">
                    {formatFileSize(f.file_size)} · {formatDateTime(f.created_at)}
                  </div>
                </div>
                <Badge>{CATEGORY_LABEL[f.category] || f.category}</Badge>
                {canEdit && (
                  <form action={deleteProjectFile}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="storage_path" value={f.storage_path} />
                    <Button variant="danger" type="submit" className="px-2 py-1 text-xs">
                      Excluir
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
