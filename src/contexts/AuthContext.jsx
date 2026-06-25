import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isConfigured as isFirebaseConfigured } from "../config/firebase";

const AuthContext = createContext(null);

export const ROLES = {
  MASTER: "master", // você - aprova/bloqueia/exclui consultantes, vê tudo
  GESTOR: "gestor", // vê Consulta + Upload + Gestão de Frotas
  ANALISTA: "analista", // vê Consulta + Upload
  CONSULTANTE: "consultante", // só vê Consulta - precisa ser aprovado pelo master
};

export const USER_STATUS = {
  PENDENTE: "pendente",
  ATIVO: "ativo",
  BLOQUEADO: "bloqueado",
};

// Mock usado só em modo demonstração (sem .env), pra você navegar pelos
// painéis sem precisar logar de verdade. Em produção isso nunca é usado.
const DEMO_USER = {
  uid: "demo-user",
  name: "Diego Soares (demo)",
  email: "diego.soares@mills.com.br",
  role: ROLES.MASTER,
  status: USER_STATUS.ATIVO,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isFirebaseConfigured ? null : DEMO_USER);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...userDoc.data() });
      } else {
        // Primeiro acesso desse e-mail: cria cadastro pendente de aprovação do master.
        const newProfile = {
          email: firebaseUser.email,
          name: firebaseUser.email.split("@")[0],
          role: ROLES.CONSULTANTE,
          status: USER_STATUS.PENDENTE,
          requestedAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
        setUser({ uid: firebaseUser.uid, ...newProfile });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email, password) {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(traduzErroAuth(err.code));
      throw err;
    }
  }

  async function signUp(email, password) {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged acima já cria o documento pendente em /users
    } catch (err) {
      setAuthError(traduzErroAuth(err.code));
      throw err;
    }
  }

  async function logout() {
    if (isFirebaseConfigured) await signOut(auth);
    setUser(null);
  }

  const value = {
    user,
    loading,
    authError,
    signIn,
    signUp,
    logout,
    isMaster: user?.role === ROLES.MASTER,
    isGestor: user?.role === ROLES.GESTOR || user?.role === ROLES.MASTER,
    isAnalista: user?.role === ROLES.ANALISTA || user?.role === ROLES.GESTOR || user?.role === ROLES.MASTER,
    isAprovado: user?.status === USER_STATUS.ATIVO,
    isPendente: user?.status === USER_STATUS.PENDENTE,
    isBloqueado: user?.status === USER_STATUS.BLOQUEADO,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function traduzErroAuth(code) {
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Esse e-mail já tem cadastro. Tente entrar em vez de criar conta.",
    "auth/weak-password": "Senha muito curta (mínimo 6 caracteres).",
  };
  return map[code] || "Erro ao autenticar. Tente novamente.";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
