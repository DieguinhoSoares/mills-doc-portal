import { ASSET_TYPES } from "../config/categories";

export const mockAssets = [
  { id: "1", placaOuTag: "ABC1D23", assetType: ASSET_TYPES.CAMINHAO, uf: "SP", cell: "Logística", responsavel: "Noelio" },
  { id: "2", placaOuTag: "XYZ9F88", assetType: ASSET_TYPES.VAN, uf: "SP", cell: "Logística", responsavel: "Noelio" },
  { id: "3", placaOuTag: "ESC-336-014", assetType: ASSET_TYPES.PESADO, uf: "SP", cell: "Gestão de Ativos", responsavel: "Bianca" },
  { id: "4", placaOuTag: "TRT-D6T-007", assetType: ASSET_TYPES.PESADO, uf: "SP", cell: "Gestão de Ativos", responsavel: "Rudkeler" },
  { id: "5", placaOuTag: "TQ-CONT-002", assetType: ASSET_TYPES.CONTAINER_TANQUE, uf: "SP", cell: "Gestão de Ativos", responsavel: "João Pedro" },
];

const todayPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const mockDocumentsByAssetId = {
  "1": [
    { categoryId: "crlv", year: 2026, validUntil: todayPlus(120), fileUrl: "#", fileName: "CRLV_ABC1D23_2026.pdf" },
    { categoryId: "ipva", year: 2026, validUntil: todayPlus(-5), fileUrl: "#", fileName: "IPVA_ABC1D23_2026.pdf" },
    { categoryId: "tacografo", year: 2025, validUntil: todayPlus(15), fileUrl: "#", fileName: "Tacografo_ABC1D23_2025.pdf" },
  ],
  "2": [
    { categoryId: "crlv", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "CRLV_XYZ9F88_2026.pdf" },
    { categoryId: "ipva", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "IPVA_XYZ9F88_2026.pdf" },
    { categoryId: "tacografo", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "Tacografo_XYZ9F88_2026.pdf" },
    { categoryId: "antt_rntrc", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "RNTRC_XYZ9F88_2026.pdf" },
    { categoryId: "licenciamento", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "Licenciamento_XYZ9F88_2026.pdf" },
    { categoryId: "certificado_inspecao", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "CertInspecao_XYZ9F88_2026.pdf" },
    { categoryId: "civ", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "CIV_XYZ9F88_2026.pdf" },
    { categoryId: "seguro_apolice", year: 2026, validUntil: todayPlus(200), fileUrl: "#", fileName: "Apolice_XYZ9F88_2026.pdf" },
  ],
  "3": [
    { categoryId: "seguro_apolice", year: 2026, validUntil: todayPlus(45), fileUrl: "#", fileName: "Apolice_ESC336014_2026.pdf" },
    { categoryId: "nf_aquisicao", year: 2022, validUntil: null, fileUrl: "#", fileName: "NF_ESC336014.pdf" },
    { categoryId: "ficha_tecnica", year: 2022, validUntil: null, fileUrl: "#", fileName: "FichaTecnica_ESC336014.pdf" },
  ],
  "4": [],
  "5": [
    { categoryId: "cipp", year: 2025, validUntil: todayPlus(-10), fileUrl: "#", fileName: "CIPP_TQCONT002_2025.pdf" },
    { categoryId: "seguro_apolice", year: 2026, validUntil: todayPlus(300), fileUrl: "#", fileName: "Apolice_TQCONT002_2026.pdf" },
  ],
};
