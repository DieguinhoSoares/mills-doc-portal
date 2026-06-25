import { getRequiredCategories } from "../config/categories";

export const ALERT_STATUS = {
  OK: "ok",
  VENCENDO_15: "vencendo_15", // vence em até 15 dias
  VENCENDO_30: "vencendo_30", // vence entre 16 e 30 dias
  VENCIDO: "vencido",
  FALTANTE: "faltante", // categoria obrigatória sem nenhum documento cadastrado
};

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula o status de um único documento com base na validade.
 * Dois patamares fixos de aviso: 15 e 30 dias (substituiu o seletor único
 * de janela única — agora os dois aparecem sempre, simultaneamente).
 * @param {object} doc - { categoryId, validUntil: 'YYYY-MM-DD' | null }
 */
export function getDocumentStatus(doc) {
  if (!doc.validUntil) return ALERT_STATUS.OK; // documento sem validade (ex: ficha técnica, NF)
  const diff = daysUntil(doc.validUntil);
  if (diff < 0) return ALERT_STATUS.VENCIDO;
  if (diff <= 15) return ALERT_STATUS.VENCENDO_15;
  if (diff <= 30) return ALERT_STATUS.VENCENDO_30;
  return ALERT_STATUS.OK;
}

/**
 * Para um ativo (placa/equipamento), cruza as categorias obrigatórias do seu tipo
 * com os documentos efetivamente cadastrados e retorna o painel de status completo.
 *
 * @param {object} asset - { id, placaOuTag, assetType }
 * @param {object[]} documents - documentos cadastrados para esse ativo
 */
export function buildAssetAlertPanel(asset, documents) {
  const required = getRequiredCategories(asset.assetType);

  return required.map((cat) => {
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

    const status = cat.hasValidity ? getDocumentStatus(latestDoc) : ALERT_STATUS.OK;

    return {
      categoryId: cat.id,
      categoryLabel: cat.label,
      status,
      document: latestDoc,
    };
  });
}

const STATUS_PRIORITY = {
  [ALERT_STATUS.VENCIDO]: 5,
  [ALERT_STATUS.FALTANTE]: 5,
  [ALERT_STATUS.VENCENDO_15]: 4,
  [ALERT_STATUS.VENCENDO_30]: 3,
  [ALERT_STATUS.OK]: 1,
};

/**
 * Roda o painel de alertas pra uma lista inteira de ativos.
 * Retorna um resumo agregado (com os dois patamares de aviso já separados)
 * + detalhe por ativo, pronto pro dashboard de Gestão e pro script de e-mail.
 */
export function buildFleetAlertSummary(assets, documentsByAssetId) {
  const detail = assets.map((asset) => {
    const docs = documentsByAssetId[asset.id] || [];
    const panel = buildAssetAlertPanel(asset, docs);
    const worstStatus = panel.reduce(
      (worst, item) =>
        STATUS_PRIORITY[item.status] > STATUS_PRIORITY[worst] ? item.status : worst,
      ALERT_STATUS.OK
    );
    return { asset, panel, worstStatus };
  });

  const summary = {
    totalAtivos: assets.length,
    vencidos: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.VENCIDO)).length,
    vencendo15: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.VENCENDO_15)).length,
    vencendo30: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.VENCENDO_30)).length,
    faltantes: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.FALTANTE)).length,
    ok: detail.filter((d) => d.worstStatus === ALERT_STATUS.OK).length,
  };

  return { summary, detail };
}
