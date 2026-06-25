import { firebaseStorageAdapter } from "./firebaseStorageAdapter";
import { sharepointStorageAdapter } from "./sharepointStorageAdapter";

// VITE_STORAGE_PROVIDER = "firebase" | "sharepoint"
// Esta é a única linha que muda quando o TI decidir se libera o Graph API.
// Todo o resto do app (UploadPanel, ConsultaPanel) chama sempre o mesmo objeto
// `storageAdapter`, sem saber qual dos dois está por trás.
const PROVIDER = import.meta.env.VITE_STORAGE_PROVIDER || "firebase";

const ADAPTERS = {
  firebase: firebaseStorageAdapter,
  sharepoint: sharepointStorageAdapter,
};

export const storageAdapter = ADAPTERS[PROVIDER] || firebaseStorageAdapter;

if (!ADAPTERS[PROVIDER]) {
  console.warn(
    `VITE_STORAGE_PROVIDER="${PROVIDER}" não reconhecido. Usando "firebase" como padrão.`
  );
}
