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
  const snapshot = await getDocs(collection(db, "assets", assetId, "documents"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Carrega os documentos de todos os ativos de uma vez, no formato que o
 * alertEngine espera: { [assetId]: [documentos...] }
 *
 * IMPORTANTE: processa em LOTES pequenos (não tudo de uma vez) - com a frota
 * na faixa de 2.900+ ativos, disparar uma leitura por ativo simultaneamente
 * estoura o limite de requisições concorrentes do Firestore ("Too many
 * outstanding requests"). Isso é uma solução de contorno; o ideal mesmo,
 * pra esse volume, é migrar pra uma coleção plana /documents com campo
 * assetId, consultável com poucas queries em vez de N. Fazer isso é o
 * próximo passo recomendado se a frota continuar nesse tamanho.
 */
export async function listDocumentsByAssetId(assetIds) {
  const result = {};
  const TAMANHO_LOTE = 20;

  for (let i = 0; i < assetIds.length; i += TAMANHO_LOTE) {
    const lote = assetIds.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map(async (id) => {
        result[id] = await listDocumentsForAsset(id);
      })
    );
  }

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
 * rápido que gravar registro por registro (3.372 linhas em sequência levava
 * minutos; em lotes de até 450, leva segundos).
 * Busca todos os ativos UMA VEZ no início, em vez de uma consulta por linha.
 */
export async function bulkUpsertAssetsFromSim(records, onProgress) {
  const allAssets = await listAssets();
  const byPlaca = new Map(allAssets.map((a) => [a.placaOuTag, a]));

  const results = { criados: 0, atualizados: 0, erros: [] };
  const BATCH_SIZE = 450; // margem de segurança abaixo do limite de 500 do Firestore

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((record) => {
      const existing = byPlaca.get(record.placaOuTag);
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
