import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../config/firebase";
import { buildDocumentPath } from "./pathHelpers";

/**
 * Adapter de storage: Firebase Storage (plano Spark, gratuito).
 * Limite real do tier gratuito: 5GB armazenados, 1GB/dia de download.
 * Pra ~250 ativos com renovação anual de documentos, deve caber — mas é
 * um teto existente, vale monitorar pelo Firebase Console.
 *
 * Interface comum aos dois adapters (ver sharepointStorageAdapter.js):
 *   - uploadFile({ file, placaOuTag, categoryId, year }) => { fileUrl, storagePath }
 *   - fetchFileBlob(doc) => Blob
 *   - deleteFile(doc) => void
 */
export const firebaseStorageAdapter = {
  name: "firebase",

  async uploadFile({ file, placaOuTag, categoryId, year }) {
    const storagePath = buildDocumentPath({
      placaOuTag,
      categoryId,
      year,
      fileName: file.name,
    });
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    return { fileUrl, storagePath };
  },

  async fetchFileBlob(doc) {
    // doc.fileUrl já é uma URL de download direta do Firebase Storage
    const response = await fetch(doc.fileUrl);
    if (!response.ok) throw new Error(`Falha ao buscar ${doc.fileName} do Storage`);
    return response.blob();
  },

  async deleteFile(doc) {
    const storageRef = ref(storage, doc.storagePath);
    await deleteObject(storageRef);
  },
};
