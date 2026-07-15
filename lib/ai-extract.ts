import Anthropic from "@anthropic-ai/sdk";

export type ExtractedEmployeeFields = {
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  address: string | null;
  marital_status: string | null;
  cnpj_razao_social: string | null;
  cnpj_numero: string | null;
  estagio_instituicao: string | null;
  estagio_curso: string | null;
};

export type DocForExtraction = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
  fileName: string;
};

const EMPTY_RESULT: ExtractedEmployeeFields = {
  full_name: null,
  cpf: null,
  rg: null,
  address: null,
  marital_status: null,
  cnpj_razao_social: null,
  cnpj_numero: null,
  estagio_instituicao: null,
  estagio_curso: null,
};

export async function extractFieldsFromDocuments(docs: DocForExtraction[]): Promise<ExtractedEmployeeFields> {
  if (docs.length === 0) return { ...EMPTY_RESULT };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não está configurada no servidor.");
  }

  const client = new Anthropic({ apiKey });

  const content: Anthropic.MessageParam["content"] = [];
  for (const doc of docs) {
    if (doc.mediaType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: doc.mediaType, data: doc.base64 },
      });
    }
  }

  content.push({
    type: "text",
    text:
      "Estes são documentos anexados de um colaborador (podem incluir RG/CPF, cartão CNPJ, comprovante de matrícula, comprovante de endereço). " +
      "Extraia os dados abaixo e responda APENAS com um objeto JSON válido, sem markdown, sem explicação, sem texto antes ou depois. " +
      "Se não encontrar um campo com certeza, use null. Não invente valores.\n\n" +
      "Formato exato de resposta:\n" +
      `{
  "full_name": string ou null (nome completo da pessoa),
  "cpf": string ou null,
  "rg": string ou null,
  "address": string ou null (endereço completo: rua, número, bairro, cidade/UF, CEP),
  "marital_status": string ou null (ex: Solteiro(a), Casado(a)),
  "cnpj_razao_social": string ou null (razão social da empresa no cartão CNPJ),
  "cnpj_numero": string ou null (número do CNPJ, formato 00.000.000/0001-00),
  "estagio_instituicao": string ou null (instituição de ensino no comprovante de matrícula),
  "estagio_curso": string ou null (nome do curso)
}`,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("A IA não retornou uma resposta em texto.");

  let raw = textBlock.text.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) raw = fenceMatch[1].trim();

  let parsed: Partial<ExtractedEmployeeFields>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Não foi possível interpretar a resposta da IA. Tente novamente.");
  }

  return {
    full_name: parsed.full_name ?? null,
    cpf: parsed.cpf ?? null,
    rg: parsed.rg ?? null,
    address: parsed.address ?? null,
    marital_status: parsed.marital_status ?? null,
    cnpj_razao_social: parsed.cnpj_razao_social ?? null,
    cnpj_numero: parsed.cnpj_numero ?? null,
    estagio_instituicao: parsed.estagio_instituicao ?? null,
    estagio_curso: parsed.estagio_curso ?? null,
  };
}
