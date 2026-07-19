"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { formatFileSize } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionFile } from "@/lib/types";

type FileWithUrl = TransactionFile & { signedUrl: string | null };

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export function TransactionDetailsModal({
  transaction,
  projects,
  categories,
  files,
  updateTransaction,
  createTransactionFileUploadUrl,
  finalizeTransactionFileUpload,
  deleteTransactionFile,
}: {
  transaction: Transaction;
  projects: { id: string; name: string }[];
  categories: string[];
  files: FileWithUrl[];
  updateTransaction: (formData: FormData) => Promise<void>;
  createTransactionFileUploadUrl: (formData: FormData) => Promise<{ storagePath: string; token: string }>;
  finalizeTransactionFileUpload: (formData: FormData) => Promise<void>;
  deleteTransactionFile: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Selecione um arquivo.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("Arquivo maior que 20MB.");
      return;
    }

    startUpload(async () => {
      try {
        const urlForm = new FormData();
        urlForm.set("transaction_id", transaction.id);
        urlForm.set("file_name", file.name);
        urlForm.set("file_size", String(file.size));
        const { storagePath, token } = await createTransactionFileUploadUrl(urlForm);

        const supabase = createClient();
        const { error } = await supabase.storage
          .from("transaction-files")
          .uploadToSignedUrl(storagePath, token, file, { contentType: file.type || undefined });
        if (error) throw new Error(error.message);

        const finalizeForm = new FormData();
        finalizeForm.set("transaction_id", transaction.id);
        finalizeForm.set("storage_path", storagePath);
        finalizeForm.set("file_name", file.name);
        finalizeForm.set("file_size", String(file.size));
        finalizeForm.set("content_type", file.type || "");
        await finalizeTransactionFileUpload(finalizeForm);

        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err: any) {
        setUploadError(err?.message || "Falha ao enviar o arquivo.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        type="button"
        className="px-2 py-1 text-xs"
        onClick={() => dialogRef.current?.showModal()}
      >
        Detalhes{files.length > 0 ? ` (${files.length})` : ""}
      </Button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[440px] max-w-[92vw] rounded-2xl border border-border bg-surface p-0 text-ink backdrop:bg-black/60 open:animate-none"
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">{transaction.category}</h3>
              <p className="text-xs text-muted">Editar lançamento e gerenciar anexos</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg px-2 py-1 text-muted hover:bg-surface2 hover:text-ink"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <form action={updateTransaction} className="space-y-3">
            <input type="hidden" name="id" value={transaction.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select name="type" defaultValue={transaction.type}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                  <option value="aporte">Aporte de sócio</option>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={transaction.status}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select name="category" defaultValue={transaction.category}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input name="amount" type="number" step="0.01" min="0" required defaultValue={transaction.amount} />
            </div>
            <div>
              <Label>Projeto (opcional)</Label>
              <Select name="project_id" defaultValue={transaction.project_id ?? ""}>
                <option value="">— nenhum —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input name="due_date" type="date" defaultValue={transaction.due_date ?? ""} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea name="description" rows={2} defaultValue={transaction.description ?? ""} />
            </div>
            <Button type="submit" className="w-full">
              Salvar alterações
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-4">
            <Label>Anexos ({files.length})</Label>
            <form onSubmit={handleUpload} className="mt-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                required
                className="w-full flex-1 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button type="submit" className="shrink-0 px-3 py-2 text-xs" disabled={isUploading}>
                {isUploading ? "Enviando..." : "Enviar"}
              </Button>
            </form>
            <p className="mt-1 text-xs text-muted">Máx. 20MB.</p>
            {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-xs">
                    <div className="min-w-0">
                      {f.signedUrl ? (
                        <a
                          href={f.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-ink hover:text-primary hover:underline"
                        >
                          {f.file_name}
                        </a>
                      ) : (
                        <span className="truncate text-ink">{f.file_name}</span>
                      )}
                      <div className="text-muted">{formatFileSize(f.file_size)}</div>
                    </div>
                    <form action={deleteTransactionFile}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="storage_path" value={f.storage_path} />
                      <Button variant="danger" className="px-1.5 py-0.5 text-[10px]" type="submit">
                        Excluir
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
