import { getRequiredCategories } from "../config/categories";

export const ALERT_STATUS = {
  OK: "ok",
  VENCENDO: "vencendo", // dentro da janela de aviso (default 30 dias)
  VENCIDO: "vencido",
  FALTANTE: "faltante", // categoria obrigatória sem nenhum documento cadastrado
  NAO_SE_APLICA: "nao_se_aplica",
};

const DEFAULT_WARNING_WINDOW_DAYS = 30;

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula o status de um único documento com base na validade.
 * @param {object} doc - { categoryId, validUntil: 'YYYY-MM-DD' | null }
 * @param {number} warningWindowDays
 */
export function getDocumentStatus(doc, warningWindowDays = DEFAULT_WARNING_WINDOW_DAYS) {
  if (!doc.validUntil) return ALERT_STATUS.OK; // documento sem validade (ex: ficha técnica, NF)
  const diff = daysUntil(doc.validUntil);
  if (diff < 0) return ALERT_STATUS.VENCIDO;
  if (diff <= warningWindowDays) return ALERT_STATUS.VENCENDO;
  return ALERT_STATUS.OK;
}

/**
 * Para um ativo (placa/equipamento), cruza as categorias obrigatórias do seu tipo
 * com os documentos efetivamente cadastrados e retorna o painel de status completo.
 *
 * @param {object} asset - { id, placaOuTag, assetType }
 * @param {object[]} documents - documentos cadastrados para esse ativo: { categoryId, validUntil, fileUrl, year, ... }
 */
export function buildAssetAlertPanel(asset, documents, warningWindowDays) {
  const required = getRequiredCategories(asset.assetType);

  return required.map((cat) => {
    // pega o documento mais recente daquela categoria (maior ano de vigência)
    const docsOfCategory = documents
      .filter((d) => d.categoryId === cat.id)
      .sort((a, b) => (b.year || 0) - (a.year || 0));

    const latestDoc = docsOfCategory[0];

    if (!latestDoc) {
      return {
        categoryId: cat.id,
        categoryLabel: cat.label,
        status: ALERT_STATUS.FALTANTE,
        document: null,
      };
    }

    const status = cat.hasValidity
      ? getDocumentStatus(latestDoc, warningWindowDays)
      : ALERT_STATUS.OK;

    return {
      categoryId: cat.id,
      categoryLabel: cat.label,
      status,
      document: latestDoc,
    };
  });
}

/**
 * Roda o painel de alertas pra uma lista inteira de ativos.
 * Retorna um resumo agregado + detalhe por ativo, pronto pro dashboard de Gestão.
 */
export function buildFleetAlertSummary(assets, documentsByAssetId, warningWindowDays) {
  const detail = assets.map((asset) => {
    const docs = documentsByAssetId[asset.id] || [];
    const panel = buildAssetAlertPanel(asset, docs, warningWindowDays);
    const worstStatus = panel.reduce((worst, item) => {
      const priority = {
        [ALERT_STATUS.VENCIDO]: 3,
        [ALERT_STATUS.FALTANTE]: 3,
        [ALERT_STATUS.VENCENDO]: 2,
        [ALERT_STATUS.OK]: 1,
      };
      return priority[item.status] > priority[worst] ? item.status : worst;
    }, ALERT_STATUS.OK);

    return { asset, panel, worstStatus };
  });

  const summary = {
    totalAtivos: assets.length,
    vencidos: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.VENCIDO)).length,
    vencendo: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.VENCENDO)).length,
    faltantes: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.FALTANTE)).length,
    ok: detail.filter((d) => d.worstStatus === ALERT_STATUS.OK).length,
  };

  return { summary, detail };
}
