import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ConsultaPanel from "./components/ConsultaPanel";
import GestaoPanel from "./components/GestaoPanel";
import UploadPanel from "./components/UploadPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import LoginScreen from "./components/LoginScreen";
import "./styles/theme.css";

function GateScreen({ title, message, showLogout }) {
  const { logout } = useAuth();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6" }}>
      <div style={{ background: "white", padding: 32, borderRadius: 8, boxShadow: "var(--shadow-card)", maxWidth: 420, textAlign: "center" }}>
        <h2 style={{ color: "var(--mills-verde-escuro)" }}>{title}</h2>
        <p style={{ color: "#777" }}>{message}</p>
        {showLogout && <button className="btn secondary" onClick={logout}>Sair</button>}
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, isMaster, isGestor, isAnalista, isAprovado, isPendente, isBloqueado, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("consulta");

  if (loading) return <div className="empty-state">Carregando...</div>;
  if (!user) return <LoginScreen />;

  if (isPendente) {
    return (
      <GateScreen
        title="Acesso pendente de aprovação"
        message="Seu cadastro foi criado e está esperando a aprovação do administrador do portal. Você será avisado quando puder entrar."
        showLogout
      />
    );
  }

  if (isBloqueado) {
    return (
      <GateScreen
        title="Acesso bloqueado"
        message="Seu acesso a este portal foi bloqueado. Fale com o administrador se acredita que isso é um engano."
        showLogout
      />
    );
  }

  if (!isAprovado) {
    return (
      <GateScreen
        title="Acesso não autorizado"
        message="Sua conta ainda não tem um status reconhecido pelo portal. Fale com o administrador."
        showLogout
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">mills <span>· portal de documentos</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{user.name || user.email}</span>
          <button className="btn secondary" onClick={logout}>Sair</button>
        </div>
      </header>

      <nav className="tabs">
        <div
          className={`tab ${activeTab === "consulta" ? "active" : ""}`}
          onClick={() => setActiveTab("consulta")}
        >
          Consulta
        </div>
        {isAnalista && (
          <div
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload de Documentos
          </div>
        )}
        {isGestor && (
          <div
            className={`tab ${activeTab === "gestao" ? "active" : ""}`}
            onClick={() => setActiveTab("gestao")}
          >
            Gestão de Frotas
          </div>
        )}
        {isMaster && (
          <div
            className={`tab ${activeTab === "usuarios" ? "active" : ""}`}
            onClick={() => setActiveTab("usuarios")}
          >
            Gestão de Usuários
          </div>
        )}
      </nav>

      <main className="content">
        {activeTab === "consulta" && <ConsultaPanel />}
        {activeTab === "upload" && isAnalista && <UploadPanel />}
        {activeTab === "gestao" && isGestor && <GestaoPanel />}
        {activeTab === "usuarios" && isMaster && <UserManagementPanel />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
