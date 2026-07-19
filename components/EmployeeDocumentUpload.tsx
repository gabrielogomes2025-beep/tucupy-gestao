"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20MB

export function EmployeeDocumentUpload({
  employeeId,
  categoryOptions,
  createEmployeeDocumentUploadUrl,
  finalizeEmployeeDocumentUpload,
}: {
  employeeId: string;
  categoryOptions: [string, string][];
  createEmployeeDocumentUploadUrl: (formData: FormData) => Promise<{ storagePath: string; token: string }>;
  finalizeEmployeeDocumentUpload: (formData: FormData) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categoryOptions[0]?.[0] ?? "outro");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setError("Arquivo maior que 20MB.");
      return;
    }

    startTransition(async () => {
      try {
        const urlForm = new FormData();
        urlForm.set("employee_id", employeeId);
        urlForm.set("file_name", file.name);
        urlForm.set("file_size", String(file.size));
        const { storagePath, token } = await createEmployeeDocumentUploadUrl(urlForm);

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("employee-documents")
          .uploadToSignedUrl(storagePath, token, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(uploadError.message);

        const finalizeForm = new FormData();
        finalizeForm.set("employee_id", employeeId);
        finalizeForm.set("storage_path", storagePath);
        finalizeForm.set("file_name", file.name);
        finalizeForm.set("file_size", String(file.size));
        finalizeForm.set("content_type", file.type || "");
        finalizeForm.set("category", category);
        await finalizeEmployeeDocumentUpload(finalizeForm);

        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess("Documento enviado.");
      } catch (err: any) {
        setError(err?.message || "Falha ao enviar o documento.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select value={category} onChange={(e) => setCategory(e.target.value)}>
        {categoryOptions.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <input
        ref={fileInputRef}
        type="file"
        required
        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-1"
      />
      <Button type="submit" variant="ghost" disabled={isPending}>
        {isPending ? "Enviando..." : "Enviar documento"}
      </Button>
      {error && <p className="text-xs text-danger sm:col-span-3">{error}</p>}
      {success && <p className="text-xs text-success sm:col-span-3">{success}</p>}
    </form>
  );
}
