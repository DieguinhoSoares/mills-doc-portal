import { getRequiredCategoriesForAsset } from "../config/categories";

export const ALERT_STATUS = {
  OK: "ok",
  PREVENTIVO: "preventivo",   // <=60 dias - agendar vistorias/providências operacionais
  FINANCEIRO: "financeiro",   // <=30 dias - liberar pagamento, aguardar compensação bancária
  CRITICO: "critico",         // <=15 dias - risco real de bloqueio em breve, avisar diretoria
  BLOQUEIO: "bloqueio",       // vencido (<=0 dias) - bloqueio de rodagem recomendado
  FALTANTE: "faltante",       // categoria obrigatória sem nenhum documento cadastrado
};

const LIMIARES_DIAS = {
  PREVENTIVO: 60,
  FINANCEIRO: 30,
  CRITICO: 15,
};

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula o status de um único documento com base na validade, em FAIXAS
 * (<=60, <=30, <=15, <=0) em vez de igualdade exata - assim o alerta nunca
 * "passa batido" se o sistema não rodar no dia exato do limiar.
 */
export function getDocumentStatus(doc) {
  if (!doc.validUntil) return ALERT_STATUS.OK; // documento sem validade (ex: ficha técnica, NF)
  const diff = daysUntil(doc.validUntil);
  if (diff <= 0) return ALERT_STATUS.BLOQUEIO;
  if (diff <= LIMIARES_DIAS.CRITICO) return ALERT_STATUS.CRITICO;
  if (diff <= LIMIARES_DIAS.FINANCEIRO) return ALERT_STATUS.FINANCEIRO;
  if (diff <= LIMIARES_DIAS.PREVENTIVO) return ALERT_STATUS.PREVENTIVO;
  return ALERT_STATUS.OK;
}

/**
 * Para um ativo (placa/equipamento), cruza as categorias obrigatórias do seu tipo
 * com os documentos efetivamente cadastrados e retorna o painel de status completo.
 */
export function buildAssetAlertPanel(asset, documents) {
  const required = getRequiredCategoriesForAsset(asset);

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
  [ALERT_STATUS.BLOQUEIO]: 6,
  [ALERT_STATUS.FALTANTE]: 6,
  [ALERT_STATUS.CRITICO]: 5,
  [ALERT_STATUS.FINANCEIRO]: 4,
  [ALERT_STATUS.PREVENTIVO]: 3,
  [ALERT_STATUS.OK]: 1,
};

/**
 * Roda o painel de alertas pra uma lista inteira de ativos.
 * Retorna um resumo agregado (com os 4 patamares já separados) + detalhe por
 * ativo, pronto pro dashboard de Gestão e pro script de e-mail.
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
    bloqueio: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.BLOQUEIO)).length,
    critico: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.CRITICO)).length,
    financeiro: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.FINANCEIRO)).length,
    preventivo: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.PREVENTIVO)).length,
    faltantes: detail.filter((d) => d.panel.some((p) => p.status === ALERT_STATUS.FALTANTE)).length,
    ok: detail.filter((d) => d.worstStatus === ALERT_STATUS.OK).length,
  };

  return { summary, detail };
}
