import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Preencha com as credenciais do projeto Firebase (Console → Configurações do projeto).
// Nunca commitar estes valores em repositório público — use variáveis de ambiente (.env)
// e adicione .env ao .gitignore, como nos outros projetos (mills-logistica, mills-reposicao).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Sem isso, o getAuth()/getFirestore() do Firebase quebram a aplicação inteira
// na hora de carregar (mesmo em tela em branco) quando o .env ainda não foi
// preenchido — é exatamente o que faz o portal funcionar em modo demonstração
// antes de você ter um projeto Firebase real configurado.
const isConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

let app = null;
let db = null;
let auth = null;
let storage = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { db, auth, storage, isConfigured };
