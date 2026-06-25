import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const ROLES = {
  ANALISTA: "analista",
  GESTOR: "gestor",
};

// TODO Fase 2: substituir por onAuthStateChanged do Firebase Auth real.
// O role do usuário deve vir de um documento em /users/{uid} no Firestore,
// nunca de claim editável no client.
export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    uid: "mock-user-1",
    name: "Diego Soares",
    email: "diego.soares@mills.com.br",
    role: ROLES.GESTOR, // troque para ROLES.ANALISTA para simular a outra visão
  });

  const value = { user, setUser, isGestor: user?.role === ROLES.GESTOR };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
