import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp, getDocFromServer } from "firebase/firestore";
import { auth, db, isConfigured as isFirebaseConfigured } from "../config/firebase";

const AuthContext = createContext(null);

export const ROLES = {
  MASTER: "master",
  GESTOR: "gestor",
  ANALISTA: "analista",
  CONSULTANTE: "consultante",
};

export const USER_STATUS = {
  PENDENTE: "pendente",
  ATIVO: "ativo",
  BLOQUEADO: "bloqueado",
};

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

    let unsubscribeUserDoc = null;
    let creatingProfile = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);

      unsubscribeUserDoc = onSnapshot(
        userDocRef,
        async (snap) => {
          if (snap.exists()) {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() });
            setLoading(false);

            if (snap.metadata.hasPendingWrites) {
              try {
                await getDocFromServer(userDocRef);
              } catch (err) {
                console.error("Escrita não confirmada pelo servidor:", err);
                setAuthError(
                  "Seu cadastro foi criado localmente mas ainda não foi confirmado pelo servidor. Recarregue a página em alguns segundos."
                );
              }
            }
          } else if (!creatingProfile) {
            creatingProfile = true;
            try {
              const newProfile = {
                email: firebaseUser.email,
                name: firebaseUser.email.split("@")[0],
                role: ROLES.CONSULTANTE,
                status: USER_STATUS.PENDENTE,
                requestedAt: serverTimestamp(),
              };
              await setDoc(userDocRef, newProfile);
            } catch (err) {
              console.error("Erro ao criar perfil:", err);
              setAuthError(`Erro ao criar seu perfil (${err.code || err.message}).`);
              setLoading(false);
            }
          }
        },
        (err) => {
          console.error("Erro no listener do perfil:", err);
          setAuthError(`Erro ao carregar seu perfil (${err.code || err.message}).`);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
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
