import { firebaseStorageAdapter } from "./firebaseStorageAdapter";
import { sharepointStorageAdapter } from "./sharepointStorageAdapter";
import { cloudinaryStorageAdapter } from "./cloudinaryStorageAdapter";

// VITE_STORAGE_PROVIDER = "firebase" | "sharepoint" | "cloudinary"
// Esta é a única linha que muda quando decidir qual storage usar.
// Todo o resto do app (UploadPanel, ConsultaPanel) chama sempre o mesmo objeto
// `storageAdapter`, sem saber qual dos três está por trás.
const PROVIDER = import.meta.env.VITE_STORAGE_PROVIDER || "cloudinary";

const ADAPTERS = {
  firebase: firebaseStorageAdapter,
  sharepoint: sharepointStorageAdapter,
  cloudinary: cloudinaryStorageAdapter,
};

export const storageAdapter = ADAPTERS[PROVIDER] || cloudinaryStorageAdapter;

if (!ADAPTERS[PROVIDER]) {
  console.warn(
    `VITE_STORAGE_PROVIDER="${PROVIDER}" não reconhecido. Usando "cloudinary" como padrão.`
  );
}
