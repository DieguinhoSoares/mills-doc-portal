// Tipos de ativo suportados pelo portal
import { getCategoriasPorFamilia } from "./familiaDocumentos";

export const ASSET_TYPES = {
  CAMINHAO: "caminhao",
  VAN: "van",
  PESADO: "pesado", // escavadeiras, tratores, etc.
  CONTAINER_TANQUE: "container_tanque",
};

export const ASSET_TYPE_LABELS = {
  [ASSET_TYPES.CAMINHAO]: "Caminhão",
  [ASSET_TYPES.VAN]: "Van",
  [ASSET_TYPES.PESADO]: "Equipamento Pesado",
  [ASSET_TYPES.CONTAINER_TANQUE]: "Container/Tanque",
};

// Catálogo de categorias de documento.
// `appliesTo`: lista de ASSET_TYPES que exigem este documento.
// `hasValidity`: true = documento tem data de vencimento (entra no motor de alertas)
//                false = documento é "permanente" (ex: ficha técnica), só entra no check de "faltante"
export const DOCUMENT_CATEGORIES = [
  {
    id: "crlv",
    label: "CRLV",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
    // O CRLV-e não tem data de vencimento impressa - ele só confirma que o
    // "exercício" (ano) está pago. A validade real é calculada a partir do
    // calendário de licenciamento do estado (ver calendarioLicenciamento.js),
    // não extraída do documento pela IA. O UploadPanel trata essa categoria
    // de forma especial por esse motivo.
    validityFromCalendar: true,
  },
  {
    id: "ipva",
    label: "IPVA",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "seguro_apolice",
    label: "Seguro/Apólice",
    appliesTo: [
      ASSET_TYPES.CAMINHAO,
      ASSET_TYPES.VAN,
      ASSET_TYPES.PESADO,
      ASSET_TYPES.CONTAINER_TANQUE,
    ],
    hasValidity: true,
  },
  {
    id: "licenciamento",
    label: "Licenciamento",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "tacografo",
    label: "Laudo de Tacógrafo",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "antt_rntrc",
    label: "ANTT/RNTRC",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "certificado_inspecao",
    label: "Certificado de Inspeção",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "civ",
    label: "CIV",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.VAN],
    hasValidity: true,
  },
  {
    id: "cipp",
    label: "CIPP",
    appliesTo: [ASSET_TYPES.CONTAINER_TANQUE],
    hasValidity: true,
  },
  {
    id: "nf_aquisicao",
    label: "NF de Aquisição",
    appliesTo: [
      ASSET_TYPES.CAMINHAO,
      ASSET_TYPES.VAN,
      ASSET_TYPES.PESADO,
      ASSET_TYPES.CONTAINER_TANQUE,
    ],
    hasValidity: false,
  },
  {
    id: "ficha_tecnica",
    label: "Ficha Técnica",
    appliesTo: [
      ASSET_TYPES.CAMINHAO,
      ASSET_TYPES.VAN,
      ASSET_TYPES.PESADO,
      ASSET_TYPES.CONTAINER_TANQUE,
    ],
    hasValidity: false,
  },
  // Autorizações Especiais de Trânsito - exigidas pra transporte de carga
  // indivisível/excesso de peso ou dimensão (ex: caminhão-prancha levando
  // equipamento pesado). Assumi que se aplicam a caminhão (o veículo que
  // transporta) e a pesado (o equipamento sendo transportado, já que a AET
  // costuma referenciar o conjunto). Me avise se algum desses não fizer
  // sentido ou se faltar algum órgão (ex: outro estado).
  {
    id: "aet_der_sp",
    label: "AET DER-SP",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.PESADO],
    hasValidity: true,
  },
  {
    id: "aet_der_pr",
    label: "AET DER-PR",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.PESADO],
    hasValidity: true,
  },
  {
    id: "aet_der_mg",
    label: "AET DER-MG",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.PESADO],
    hasValidity: true,
  },
  {
    id: "agetop_go",
    label: "AGETOP-GO",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.PESADO],
    hasValidity: true,
  },
  {
    id: "dnit",
    label: "DNIT",
    appliesTo: [ASSET_TYPES.CAMINHAO, ASSET_TYPES.PESADO],
    hasValidity: true,
  },
];

// Retorna as categorias exigidas para um determinado tipo de ativo (modo antigo,
// usado como fallback quando o ativo não tem Família cadastrada ainda - ex:
// ativos criados manualmente pelo Upload antes da importação do SIM)
export function getRequiredCategories(assetType) {
  return DOCUMENT_CATEGORIES.filter((cat) => cat.appliesTo.includes(assetType));
}

/**
 * Versão nova, que usa a Família (subtipo do SIM) como fonte principal,
 * com exceções pontuais por veículo (categoriasExcecao no documento do
 * ativo: { adicionar: [...], remover: [...] }) - é o que cobre o caso do
 * "basculante específico que não tem CIV" sem mexer na regra geral.
 *
 * @param {object} asset - precisa ter .familia (opcional) e .assetType
 *   (sempre, fallback) e pode ter .categoriasExcecao
 */
export function getRequiredCategoriesForAsset(asset) {
  const baseIds = asset.familia
    ? getCategoriasPorFamilia(asset.familia)
    : getRequiredCategories(asset.assetType).map((c) => c.id);

  const excecao = asset.categoriasExcecao || {};
  const remover = new Set(excecao.remover || []);
  const adicionar = excecao.adicionar || [];

  const finalIds = [...new Set([...baseIds, ...adicionar])].filter((id) => !remover.has(id));

  return finalIds.map((id) => getCategoryById(id)).filter(Boolean);
}

export function getCategoryById(id) {
  return DOCUMENT_CATEGORIES.find((cat) => cat.id === id);
}
