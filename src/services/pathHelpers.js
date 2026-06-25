import { getCategoryById } from "../config/categories";

/**
 * Monta o caminho de pastas padrão do portal: placa/categoria/ano/arquivo
 * Usado pelos dois adapters (Firebase e SharePoint) pra manter a mesma
 * organização de pastas independente de onde o arquivo é guardado de fato.
 */
export function buildDocumentPath({ placaOuTag, categoryId, year, fileName }) {
  const categoryLabel = getCategoryById(categoryId)?.label || categoryId;
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, "-").trim();
  return [safe(placaOuTag), safe(categoryLabel), safe(year || "sem-ano"), safe(fileName)].join("/");
}

export function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}
