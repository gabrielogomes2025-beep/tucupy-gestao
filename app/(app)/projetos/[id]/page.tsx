import { getAccessContext } from "@/lib/access";
import { Card, PageHeader, Badge, Button, Input, Label, Select, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatFileSize, formatDateTime } from "@/lib/format";
import type { Client, Project, ProjectFile } from "@/lib/types";
import { uploadProjectFile, deleteProjectFile } from "../actions";
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
        action={<Badge tone={project.status === "em_andamento" ? "good" : "default"}>{STATUS_LABEL[project.status]}</Badge>}
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
