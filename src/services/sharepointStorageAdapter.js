import { getGraphToken } from "./sharepointAuth";
import { buildDocumentPath } from "./pathHelpers";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ID do site do SharePoint onde vive a biblioteca de documentos da frota.
// Obtenha via: GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{nome-do-site}
const SITE_ID = import.meta.env.VITE_SHAREPOINT_SITE_ID;
const DRIVE_ROOT_FOLDER = "FrotaDocs"; // pasta raiz dentro da biblioteca de documentos do site

function assertConfigured() {
  if (!SITE_ID) {
    throw new Error(
      "VITE_SHAREPOINT_SITE_ID não configurado. Só é necessário se o TI liberar o " +
        "app registration no Azure AD da Mills (ver README, seção SharePoint/Graph API)."
    );
  }
}

/**
 * Upload simples (até 4MB) via PUT direto no conteúdo do arquivo.
 * Para arquivos maiores que 4MB, o Graph exige "upload session" (multipart
 * resumable) — não implementado aqui ainda porque documentos de frota
 * (CRLV, IPVA, laudos) raramente passam disso; adicionar se for preciso.
 */
async function uploadSmallFile(token, fullPath, file) {
  const url = `${GRAPH_BASE}/sites/${SITE_ID}/drive/root:/${DRIVE_ROOT_FOLDER}/${fullPath}:/content`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Falha ao enviar pro SharePoint (${response.status}): ${errBody.slice(0, 200)}`);
  }
  return response.json(); // contém id, webUrl, @microsoft.graph.downloadUrl, etc.
}

/**
 * Interface comum aos dois adapters (ver firebaseStorageAdapter.js):
 *   - uploadFile({ file, placaOuTag, categoryId, year }) => { fileUrl, storagePath }
 *   - fetchFileBlob(doc) => Blob
 *   - deleteFile(doc) => void
 */
export const sharepointStorageAdapter = {
  name: "sharepoint",

  async uploadFile({ file, placaOuTag, categoryId, year }) {
    assertConfigured();
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(
        `${file.name} tem mais de 4MB. Upload de arquivos grandes via SharePoint ainda não ` +
          "está implementado neste adapter — fala comigo pra adicionar upload session."
      );
    }
    const token = await getGraphToken();
    const fullPath = buildDocumentPath({ placaOuTag, categoryId, year, fileName: file.name });
    const result = await uploadSmallFile(token, fullPath, file);

    return {
      fileUrl: result["@microsoft.graph.downloadUrl"] || result.webUrl,
      storagePath: fullPath,
      graphItemId: result.id,
    };
  },

  async fetchFileBlob(doc) {
    assertConfigured();
    const token = await getGraphToken();
    const url = `${GRAPH_BASE}/sites/${SITE_ID}/drive/items/${doc.graphItemId}/content`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Falha ao buscar ${doc.fileName} do SharePoint`);
    return response.blob();
  },

  async deleteFile(doc) {
    assertConfigured();
    const token = await getGraphToken();
    const url = `${GRAPH_BASE}/sites/${SITE_ID}/drive/items/${doc.graphItemId}`;
    await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  },
};
