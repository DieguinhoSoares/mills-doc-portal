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
  writeBatch,
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

export async function updateAsset(assetId, data) {
  await updateDoc(doc(db, "assets", assetId), data);
}

export async function listDocumentsForAsset(assetId) {
  const q = query(collection(db, "documents"), where("assetId", "==", assetId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Busca TODOS os documentos da frota numa única leitura, e agrupa por ativo
 * no cliente. Substitui o modelo antigo (subcoleção /assets/{id}/documents,
 * que exigia uma consulta por ativo) - escala bem pra frotas de milhares de
 * ativos, já que o custo agora é O(1) consulta em vez de O(N).
 */
export async function listAllDocuments() {
  const snapshot = await getDocs(collection(db, "documents"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listDocumentsByAssetId(assetIds) {
  const allDocs = await listAllDocuments();
  const assetIdSet = new Set(assetIds);
  const result = {};
  assetIds.forEach((id) => {
    result[id] = [];
  });
  allDocs.forEach((d) => {
    if (assetIdSet.has(d.assetId)) {
      result[d.assetId].push(d);
    }
  });
  return result;
}

/**
 * Salva o metadado de um documento já enviado ao storage (Firebase ou SharePoint).
 * `storageResult` vem de storageAdapter.uploadFile() - contém fileUrl/storagePath
 * e, no caso do SharePoint, graphItemId (necessário pra buscar o blob depois).
 * Grava na coleção plana /documents (não mais como subcoleção do ativo).
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
  const ref = await addDoc(collection(db, "documents"), {
    assetId,
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
 * Importação do CSV do SIM (semanal). Pra cada registro do CSV:
 * - se já existe ativo com essa placa/tag, atualiza familia/uf/status/arquivado
 * - se não existe, cria um novo ativo
 * Não toca em campos que o portal controla por conta própria (cell,
 * responsavel, categoriasExcecao) - só nos campos que vêm do SIM.
 */
export async function upsertAssetFromSim(record) {
  const existing = await findAssetByPlaca(record.placaOuTag);

  const dadosSim = {
    placaOuTag: record.placaOuTag,
    numeroFrota: record.numeroFrota,
    familia: record.familia,
    assetType: record.assetType,
    uf: record.uf || existing?.uf || "",
    statusOperacional: record.statusOperacional,
    arquivado: record.arquivado,
    fabricante: record.fabricante,
    modelo: record.modelo,
  };

  if (existing) {
    await updateDoc(doc(db, "assets", existing.id), dadosSim);
    return { id: existing.id, action: "atualizado" };
  }

  const ref = await addDoc(collection(db, "assets"), {
    ...dadosSim,
    cell: "",
    responsavel: "",
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, action: "criado" };
}

/**
 * Importação do CSV do SIM (semanal), em LOTES via writeBatch - muito mais
 * rápido que gravar registro por registro.
 * Busca todos os ativos UMA VEZ no início, em vez de uma consulta por linha.
 *
 * Chave de combinação: Código ativo (campo fixo do SIM, nunca muda) é a
 * referência principal. placaOuTag só serve de fallback pra ativos criados
 * manualmente pelo Upload, que ainda não passaram por nenhuma importação do
 * SIM. Usar placaOuTag como chave principal foi o que causou duplicados
 * antes - ele é recalculado conforme a regra de exibição muda, então não é
 * estável o suficiente pra identificar "é o mesmo ativo de antes".
 */
export async function bulkUpsertAssetsFromSim(records, onProgress) {
  const allAssets = await listAssets();
  const byCodigoAtivo = new Map(
    allAssets.filter((a) => a.codigoAtivo).map((a) => [a.codigoAtivo, a])
  );
  const byPlacaOuTag = new Map(allAssets.map((a) => [a.placaOuTag, a]));

  const results = { criados: 0, atualizados: 0, erros: [] };
  const BATCH_SIZE = 450; // margem de segurança abaixo do limite de 500 do Firestore

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((record) => {
      const existing =
        (record.codigoAtivo && byCodigoAtivo.get(record.codigoAtivo)) ||
        byPlacaOuTag.get(record.placaOuTag);

      const dadosSim = {
        placaOuTag: record.placaOuTag,
        placa: record.placa || "",
        numeroFrota: record.numeroFrota,
        codigoAtivo: record.codigoAtivo || "",
        familia: record.familia,
        assetType: record.assetType,
        uf: record.uf || existing?.uf || "",
        statusOperacional: record.statusOperacional,
        arquivado: record.arquivado,
        fabricante: record.fabricante,
        modelo: record.modelo,
      };

      if (existing) {
        batch.update(doc(db, "assets", existing.id), dadosSim);
        results.atualizados += 1;
      } else {
        const newRef = doc(collection(db, "assets"));
        batch.set(newRef, { ...dadosSim, cell: "", responsavel: "", createdAt: serverTimestamp() });
        results.criados += 1;
      }
    });

    try {
      await batch.commit();
    } catch (err) {
      chunk.forEach((r) => results.erros.push({ placaOuTag: r.placaOuTag, erro: err.message }));
    }

    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, records.length), records.length);
  }

  return results;
}

/**
 * Apaga todos os ativos que vieram de uma importação do SIM (têm o campo
 * `familia` preenchido) - usado pra "começar do zero" e eliminar duplicados
 * acumulados de versões anteriores da importação. Não toca em ativos criados
 * manualmente pelo Upload (sem familia).
 */
export async function deleteAllSimImportedAssets(onProgress) {
  const allAssets = await listAssets();
  const simAssets = allAssets.filter((a) => a.familia);
  const BATCH_SIZE = 450;

  for (let i = 0; i < simAssets.length; i += BATCH_SIZE) {
    const chunk = simAssets.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((a) => batch.delete(doc(db, "assets", a.id)));
    await batch.commit();
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, simAssets.length), simAssets.length);
  }

  return { apagados: simAssets.length };
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
