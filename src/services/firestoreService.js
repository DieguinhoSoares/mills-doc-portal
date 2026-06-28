import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  deleteDoc,
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

export async function createAsset({ placaOuTag, assetType, uf, cell, responsavel }) {
  const ref = await addDoc(collection(db, "assets"), {
    placaOuTag,
    assetType,
    uf: uf || "",
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

/**
 * Gestão de usuários (papel master, mesmo padrão de aprovação do mills-logistica).
 * IMPORTANTE: estas funções só apagam/alteram o DOCUMENTO em /users — elas não
 * apagam a conta de autenticação em si (isso exigiria Firebase Admin SDK, que
 * não roda no browser por segurança). Pra exclusão definitiva da conta de login,
 * use o Firebase Console > Authentication, ou peça que eu monte uma Cloud
 * Function/Action específica pra isso se for um caso recorrente.
 */
export async function listUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUserStatus(uid, status) {
  await updateDoc(doc(db, "users", uid), { status });
}

export async function updateUserRole(uid, role) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function deleteUserDoc(uid) {
  await deleteDoc(doc(db, "users", uid));
}
