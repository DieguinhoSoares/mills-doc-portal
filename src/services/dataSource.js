import { mockAssets, mockDocumentsByAssetId } from "../data/mockData";
import { listAssets, listDocumentsByAssetId } from "./firestoreService";

/**
 * Enquanto o Firebase não estiver configurado (sem VITE_FIREBASE_PROJECT_ID no .env),
 * o app inteiro continua funcionando com os dados mock — é o que permite demonstrar
 * o portal pro time/gestão antes de decidir credenciais reais ou esperar o TI.
 * Assim que o .env for preenchido, os painéis passam a ler do Firestore automaticamente,
 * sem nenhuma mudança de código.
 */
export const isBackendConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

export async function getAssets() {
  if (!isBackendConfigured) return mockAssets;
  return listAssets();
}

export async function getDocumentsByAssetId(assets) {
  if (!isBackendConfigured) return mockDocumentsByAssetId;
  return listDocumentsByAssetId(assets.map((a) => a.id));
}
