import { mockAssets, mockDocumentsByAssetId } from "../data/mockData";
import { listAssets, listAllDocuments } from "./firestoreService";

/**
 * Enquanto o Firebase não estiver configurado (sem VITE_FIREBASE_PROJECT_ID no .env),
 * o app inteiro continua funcionando com os dados mock — é o que permite demonstrar
 * o portal pro time/gestão antes de decidir credenciais reais ou esperar o TI.
 * Assim que o .env for preenchido, os painéis passam a ler do Firestore automaticamente,
 * sem nenhuma mudança de código.
 */
export const isBackendConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

/**
 * Cache em memória (válido só durante a sessão aberta no navegador) das duas
 * leituras "pesadas" (coleção inteira de ativos, coleção inteira de
 * documentos). Sem isso, toda troca de aba entre Consulta/Gestão/Upload
 * relia a coleção inteira de novo - com a frota na faixa de milhares, isso
 * esgota rápido a cota gratuita diária do Firestore (50 mil leituras/dia).
 * `forceRefresh` ignora o cache - usado depois de importar/editar algo.
 */
let cacheAssets = null;
let cacheDocumentos = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

function cacheValido() {
  return cacheAssets !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

export function invalidarCache() {
  cacheAssets = null;
  cacheDocumentos = null;
}

export async function getAssets({ incluirArquivados = false, forceRefresh = false } = {}) {
  if (!isBackendConfigured) {
    return incluirArquivados ? mockAssets : mockAssets.filter((a) => !a.arquivado);
  }

  if (forceRefresh || !cacheValido()) {
    cacheAssets = await listAssets();
    cacheDocumentos = null; // documentos também precisam recarregar junto
    cacheTimestamp = Date.now();
  }

  return incluirArquivados ? cacheAssets : cacheAssets.filter((a) => !a.arquivado);
}

export async function getDocumentsByAssetId(assets, { forceRefresh = false } = {}) {
  if (!isBackendConfigured) return mockDocumentsByAssetId;

  if (forceRefresh || !cacheDocumentos) {
    const allDocs = await listAllDocuments();
    cacheDocumentos = allDocs;
  }

  const assetIdSet = new Set(assets.map((a) => a.id));
  const result = {};
  assets.forEach((a) => {
    result[a.id] = [];
  });
  cacheDocumentos.forEach((d) => {
    if (assetIdSet.has(d.assetId)) result[d.assetId].push(d);
  });
  return result;
}
