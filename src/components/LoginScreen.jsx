import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const { signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch {
      // authError já vem populado pelo AuthContext
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6" }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: "white", padding: 32, borderRadius: 8, boxShadow: "var(--shadow-card)", width: 360 }}
      >
        <h2 style={{ marginTop: 0, color: "var(--mills-verde-escuro)" }}>
          mills <span style={{ color: "var(--mills-laranja)" }}>· portal de documentos</span>
        </h2>

        <label style={{ display: "block", fontSize: 13, marginBottom: 12 }}>
          <span style={{ display: "block", color: "#777", marginBottom: 4 }}>E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "block", fontSize: 13, marginBottom: 16 }}>
          <span style={{ display: "block", color: "#777", marginBottom: 4 }}>Senha</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
          />
        </label>

        {authError && <p style={{ color: "var(--status-vencido)", fontSize: 13 }}>{authError}</p>}

        <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
        </button>

        <p style={{ fontSize: 13, textAlign: "center", marginTop: 16 }}>
          {mode === "signin" ? (
            <>Não tem conta ainda? <a href="#" onClick={() => setMode("signup")}>Solicitar acesso</a></>
          ) : (
            <>Já tem conta? <a href="#" onClick={() => setMode("signin")}>Entrar</a></>
          )}
        </p>

        {mode === "signup" && (
          <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>
            Após criar a conta, seu acesso fica pendente até o master autorizar.
          </p>
        )}
      </form>
    </div>
  );
}
