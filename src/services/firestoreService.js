import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Metadados de documentos ficam SEMPRE no Firestore, independente de onde o
 * arquivo físico está guardado (Firebase Storage ou SharePoint). Isso é o que
 * permite trocar o storage adapter sem tocar no motor de alertas nem nos
 * painéis de Consulta/Gestão — eles só leem deste serviço.
 */

export async function listAssets() {
  const snapshot = await getDocs(collection(db, "assets"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAsset(assetId) {
  const snap = await getDoc(doc(db, "assets", assetId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findAssetByPlaca(placaOuTag) {
  const q = query(collection(db, "assets"), where("placaOuTag", "==", placaOuTag));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function createAsset({ placaOuTag, assetType, cell, responsavel }) {
  const ref = await addDoc(collection(db, "assets"), {
    placaOuTag,
    assetType,
    cell,
    responsavel,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listDocumentsForAsset(assetId) {
  const snapshot = await getDocs(collection(db, "assets", assetId, "documents"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Carrega os documentos de todos os ativos de uma vez, no formato que o
 * alertEngine espera: { [assetId]: [documentos...] }
 * Atenção: isso faz N+1 leituras (uma por ativo). Pra frotas grandes, considere
 * migrar pra uma coleção plana /documents com campo assetId e where('assetId','in',...).
 */
export async function listDocumentsByAssetId(assetIds) {
  const result = {};
  await Promise.all(
    assetIds.map(async (id) => {
      result[id] = await listDocumentsForAsset(id);
    })
  );
  return result;
}

/**
 * Salva o metadado de um documento já enviado ao storage (Firebase ou SharePoint).
 * `storageResult` vem de storageAdapter.uploadFile() - contém fileUrl/storagePath
 * e, no caso do SharePoint, graphItemId (necessário pra buscar o blob depois).
 */
export async function saveDocumentMetadata({
  assetId,
  categoryId,
  year,
  validUntil,
  fileName,
  storageResult,
  uploadedBy,
}) {
  const ref = await addDoc(collection(db, "assets", assetId, "documents"), {
    categoryId,
    year,
    validUntil: validUntil || null,
    fileName,
    fileUrl: storageResult.fileUrl,
    storagePath: storageResult.storagePath,
    graphItemId: storageResult.graphItemId || null,
    uploadedBy,
    uploadedAt: serverTimestamp(),
  });
  return ref.id;
}
