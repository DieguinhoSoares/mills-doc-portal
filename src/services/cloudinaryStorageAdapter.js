import { buildDocumentPath } from "./pathHelpers";

// Cloudinary free tier: 25 créditos/mês (1 crédito ≈ 1GB de storage OU 1GB de
// banda), sem cartão de crédito exigido. Se passar do limite, a conta é
// suspensa temporariamente (não cobra automaticamente) — bem mais seguro
// pra um projeto interno do que correr risco de fatura surpresa.
//
// Setup necessário (ver README, seção Cloudinary):
//   1. Conta gratuita em cloudinary.com
//   2. Anotar o "Cloud name" do dashboard
//   3. Criar um Upload Preset com Signing Mode = "Unsigned"
//      (Settings > Upload > Upload presets > Add upload preset)
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function assertConfigured() {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET não configurados no .env."
    );
  }
}

/**
 * PDF precisa ir como resource_type "raw" (Cloudinary trata PDF como arquivo
 * genérico, não como imagem). PNG/JPG vão como "image", o que também habilita
 * otimizações automáticas de entrega se um dia forem úteis.
 */
function resourceTypeFor(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    ? "raw"
    : "image";
}

/**
 * Interface comum aos três adapters (ver firebaseStorageAdapter.js e
 * sharepointStorageAdapter.js):
 *   - uploadFile({ file, placaOuTag, categoryId, year }) => { fileUrl, storagePath }
 *   - fetchFileBlob(doc) => Blob
 *   - deleteFile(doc) => void
 */
export const cloudinaryStorageAdapter = {
  name: "cloudinary",

  async uploadFile({ file, placaOuTag, categoryId, year }) {
    assertConfigured();

    const fullPath = buildDocumentPath({ placaOuTag, categoryId, year, fileName: file.name });
    const folder = fullPath.substring(0, fullPath.lastIndexOf("/"));
    const resourceType = resourceTypeFor(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Falha ao enviar pro Cloudinary (${response.status}): ${errBody.slice(0, 200)}`);
    }

    const result = await response.json();
    return { fileUrl: result.secure_url, storagePath: result.public_id };
  },

  async fetchFileBlob(doc) {
    // O secure_url do Cloudinary já é uma URL pública de download direto.
    // IMPORTANTE: assim como as URLs do Firebase Storage, qualquer pessoa
    // com o link consegue acessar o arquivo, mesmo sem estar logada no
    // portal — a proteção real está em quem tem acesso a esses links
    // (Firestore + login do portal), não no storage em si.
    const response = await fetch(doc.fileUrl);
    if (!response.ok) throw new Error(`Falha ao buscar ${doc.fileName} do Cloudinary`);
    return response.blob();
  },

  async deleteFile() {
    // Exclusão no Cloudinary exige requisição ASSINADA (com API secret),
    // que não pode ficar exposta no navegador por segurança. Pra excluir um
    // arquivo enviado por engano, use o Cloudinary Console (Media Library)
    // diretamente, ou me avise pra montarmos uma Cloud Function/Action
    // dedicada caso isso vire um caso recorrente.
    throw new Error(
      "Exclusão direta não suportada neste adapter. Use o Cloudinary Console (Media Library)."
    );
  },
};
