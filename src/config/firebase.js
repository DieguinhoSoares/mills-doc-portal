import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

let app = null;
let db = null;
let auth = null;
let storage = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  // experimentalForceLongPolling evita o erro "client is offline" em redes
  // corporativas/proxy que bloqueiam o streaming padrão do Firestore.
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
  auth = getAuth(app);
  storage = getStorage(app);
}

export { db, auth, storage, isConfigured };
