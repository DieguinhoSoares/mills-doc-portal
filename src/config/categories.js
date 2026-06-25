// Tipos de ativo suportados pelo portal
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
];

// Retorna as categorias exigidas para um determinado tipo de ativo
export function getRequiredCategories(assetType) {
  return DOCUMENT_CATEGORIES.filter((cat) => cat.appliesTo.includes(assetType));
}

export function getCategoryById(id) {
  return DOCUMENT_CATEGORIES.find((cat) => cat.id === id);
}
